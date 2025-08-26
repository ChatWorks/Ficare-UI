import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';

// Enhanced P&L categories with descriptions for better AI mapping
const ENHANCED_PNL_CATEGORIES = {
  // Direct Revenue Categories
  'Omzet': {
    description: 'Directe omzet uit verkoop van producten of diensten, facturatie aan klanten',
    keywords: ['omzet', 'verkoop', 'facturatie', 'diensten', 'producten', 'revenue']
  },
  'Inkoopwaarde omzet': {
    description: 'Directe kosten gerelateerd aan verkochte goederen, inkoopprijs van producten',
    keywords: ['inkoop', 'cogs', 'cost of goods', 'inkoopprijs', 'materiaalkosten', 'handelsgoederen']
  },
  'Provisies': {
    description: 'Commissies en provisies betaald aan verkopers of partners',
    keywords: ['provisie', 'commissie', 'verkoop commissie', 'partner fee', 'affiliate']
  },
  'Personeelskosten direct': {
    description: 'Directe loonkosten gerelateerd aan productie of dienstverlening',
    keywords: ['loon', 'salaris', 'personeel', 'direct labor', 'productie personeel', 'loonkosten']
  },

  // Operating Costs
  'Autokosten': {
    description: 'Kosten gerelateerd aan voertuigen: brandstof, onderhoud, verzekering, lease',
    keywords: ['auto', 'voertuig', 'brandstof', 'benzine', 'diesel', 'lease auto', 'auto onderhoud', 'autoverzekering']
  },
  'Marketingkosten': {
    description: 'Marketing en reclame uitgaven, promotie kosten',
    keywords: ['marketing', 'reclame', 'advertentie', 'promotie', 'website', 'social media', 'google ads']
  },
  'Operationele personeelskosten': {
    description: 'Indirecte personeelskosten: HR, training, kantoorpersoneel',
    keywords: ['hr', 'training', 'kantoor personeel', 'administratie', 'management', 'overhead personeel']
  },

  // Fixed Costs  
  'Huisvestingskosten': {
    description: 'Kosten voor kantoor/bedrijfspand: huur, energie, onderhoud',
    keywords: ['huur', 'kantoor', 'pand', 'energie', 'gas', 'water', 'elektra', 'onderhoud pand', 'huisvesting']
  },
  'Kantoorkosten': {
    description: 'Kantoorbenodigdheden, ICT, telefoon, internet, software',
    keywords: ['kantoor', 'ict', 'computer', 'software', 'telefoon', 'internet', 'printer', 'kantoorartikelen']
  },
  'Algemene kosten': {
    description: 'Overige bedrijfskosten: verzekeringen, juridisch, administratie',
    keywords: ['verzekering', 'juridisch', 'accountant', 'administratie', 'algemeen', 'overig', 'diversen']
  },

  // Financial Costs
  'Afschrijvingskosten': {
    description: 'Afschrijvingen op materiële en immateriële vaste activa',
    keywords: ['afschrijving', 'depreciation', 'amortisatie', 'vaste activa', 'machines', 'inventaris']
  },
  'Financieringskosten': {
    description: 'Rente en kosten van leningen, financiering, bankkosten',
    keywords: ['rente', 'lening', 'hypotheek', 'bank', 'financiering', 'krediet', 'interest']
  }
};

// Function to map a single category using Gemini 2.5 Flash
async function mapSingleCategoryWithAI(categoryInfo) {
  try {
    console.log(`[SINGLE-MAPPING] AI mapping for "${categoryInfo.category_3}"`);
    
    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });

    const categoryOptions = Object.entries(ENHANCED_PNL_CATEGORIES)
      .map(([name, info]) => `${name}: ${info.description}`)
      .join('\n');

    const prompt = `Je bent een expert in Nederlandse boekhouding. Map deze AFAS categorie naar de beste Enhanced P&L categorie.

AFAS Categorie: "${categoryInfo.category_3}" (${categoryInfo.type_rekening})

Beschikbare Enhanced P&L Categorieën:
${categoryOptions}

MAPPING REGELS:
- Opbrengsten: alleen "Omzet" of "Provisies" 
- Kosten van verkochte goederen/handelsgoederen → "Inkoopwaarde omzet"
- Lonen/salarissen/personeel → "Personeelskosten direct" (productie) of "Operationele personeelskosten" (kantoor)
- Auto/voertuig/brandstof → "Autokosten" 
- Marketing/reclame/website → "Marketingkosten"
- Huur/pand/energie/onderhoud → "Huisvestingskosten"
- Computer/telefoon/kantoor → "Kantoorkosten"
- Verzekering/juridisch/administratie → "Algemene kosten"
- Afschrijving/depreciation → "Afschrijvingskosten"
- Rente/lening/bank → "Financieringskosten"

ANTWOORD FORMAT - ALLEEN DE CATEGORIENAAM:
Omzet`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 50,
      },
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log(`[SINGLE-MAPPING] AI response for "${categoryInfo.category_3}": ${text}`);
    
    // Clean up the response and validate
    let mappedCategory = text.replace(/^["']|["']$/g, '').trim();
    
    // Validate against available categories
    if (!Object.keys(ENHANCED_PNL_CATEGORIES).includes(mappedCategory)) {
      console.warn(`[SINGLE-MAPPING] Invalid category "${mappedCategory}", using fallback`);
      mappedCategory = 'Algemene kosten'; // Default fallback
    }
    
    // Additional validation for type_rekening logic
    if (categoryInfo.type_rekening === 'Opbrengsten' && !['Omzet', 'Provisies'].includes(mappedCategory)) {
      console.warn(`[SINGLE-MAPPING] Correcting Opbrengsten "${categoryInfo.category_3}" to Omzet`);
      mappedCategory = 'Omzet';
    }
    
    return {
      category_3: categoryInfo.category_3,
      type_rekening: categoryInfo.type_rekening,
      mapped_category: mappedCategory,
      reasoning: `AI mapped "${categoryInfo.category_3}" to "${mappedCategory}"`
    };
    
  } catch (error) {
    console.error(`[SINGLE-MAPPING] AI mapping error for "${categoryInfo.category_3}":`, error);
    
    // Fallback mapping based on type
    const fallbackCategory = categoryInfo.type_rekening === 'Opbrengsten' ? 'Omzet' : 'Algemene kosten';
    
    return {
      category_3: categoryInfo.category_3,
      type_rekening: categoryInfo.type_rekening,
      mapped_category: fallbackCategory,
      reasoning: `Fallback mapping due to AI error: ${error.message}`
    };
  }
}

// POST: Map a single category with AI
export async function POST(request) {
  const startTime = performance.now();
  console.log('[SINGLE-MAPPING] POST: Starting single AI mapping request');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { categoryInfo, forceRemap = false } = await request.json();

    if (!categoryInfo || !categoryInfo.category_3) {
      return NextResponse.json({ error: 'Invalid categoryInfo' }, { status: 400 });
    }

    console.log(`[SINGLE-MAPPING] POST: Processing "${categoryInfo.category_3}", forceRemap=${forceRemap}`);

    // Check if mapping already exists and we're not forcing remap
    if (!forceRemap) {
      const { data: existing } = await supabase
        .from('category_mapping')
        .select('*')
        .eq('user_id', user.id)
        .eq('category_3', categoryInfo.category_3)
        .single();
      
      if (existing) {
        console.log(`[SINGLE-MAPPING] POST: Existing mapping found for "${categoryInfo.category_3}"`);
        const duration = (performance.now() - startTime).toFixed(2);
        return NextResponse.json({
          status: 'skipped',
          mapping: existing,
          duration: `${duration}ms`
        });
      }
    }

    // Get AI mapping
    const aiResult = await mapSingleCategoryWithAI(categoryInfo);
    
    // Save mapping to database
    const { data: mapping, error: upsertError } = await supabase
      .from('category_mapping')
      .upsert({
        user_id: user.id,
        category_3: aiResult.category_3,
        mapped_category: aiResult.mapped_category,
        type_rekening: aiResult.type_rekening,
        user_verified: false
      }, {
        onConflict: 'user_id,category_3'
      })
      .select()
      .single();

    if (upsertError) {
      console.error(`[SINGLE-MAPPING] POST: Upsert error:`, upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[SINGLE-MAPPING] POST: Successfully mapped "${categoryInfo.category_3}" to "${aiResult.mapped_category}" in ${duration}ms`);

    return NextResponse.json({
      status: forceRemap ? 'remapped' : 'mapped',
      mapping: {
        ...mapping,
        ai_reasoning: aiResult.reasoning
      },
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error('[SINGLE-MAPPING] POST: Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', duration: `${duration}ms` },
      { status: 500 }
    );
  }
}
