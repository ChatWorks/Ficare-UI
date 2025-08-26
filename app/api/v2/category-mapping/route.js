import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { performance } from 'perf_hooks';
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

// Function to map multiple categories using Gemini 2.5 Flash (batch processing)
async function mapCategoriesWithAI(categoriesBatch) {
  try {
    console.log(`[CATEGORY-MAPPING] AI batch mapping for ${categoriesBatch.length} categories`);
    
    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });

    const categoryOptions = Object.entries(ENHANCED_PNL_CATEGORIES)
      .map(([name, info]) => `${name}: ${info.description}`)
      .join('\n');

    // Create the batch mapping request
    const categoriesText = categoriesBatch.map((cat, index) => 
      `${index + 1}. "${cat.category_3}" (${cat.type_rekening})`
    ).join('\n');

    const prompt = `Je bent een expert in Nederlandse boekhouding. Map elke AFAS categorie naar de beste Enhanced P&L categorie.

AFAS Categorieën om te mappen:
${categoriesText}

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

ANTWOORD FORMAT - ALLEEN NUMMERS EN CATEGORIENAMEN:
1. Omzet
2. Kantoorkosten
3. Autokosten
etc.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log(`[CATEGORY-MAPPING] AI batch response:\n${text}`);
    
    // Parse the response
    const lines = text.split('\n').filter(line => line.trim());
    const results = [];
    
    for (let i = 0; i < categoriesBatch.length; i++) {
      const category = categoriesBatch[i];
      let mappedCategory = 'Algemene kosten'; // Default fallback
      
      // Find the corresponding line in the response
      const responseLine = lines.find(line => line.trim().startsWith(`${i + 1}.`));
      if (responseLine) {
        const extractedCategory = responseLine.replace(/^\d+\.\s*/, '').trim();
        
        // Validate against available categories
        if (Object.keys(ENHANCED_PNL_CATEGORIES).includes(extractedCategory)) {
          mappedCategory = extractedCategory;
        }
      }
      
      // Additional validation for type_rekening logic
      if (category.type_rekening === 'Opbrengsten' && !['Omzet', 'Provisies'].includes(mappedCategory)) {
        console.warn(`[CATEGORY-MAPPING] Correcting Opbrengsten "${category.category_3}" to Omzet`);
        mappedCategory = 'Omzet';
      }
      
      results.push({
        category_3: category.category_3,
        type_rekening: category.type_rekening,
        mapped_category: mappedCategory,
        reasoning: `AI batch mapped "${category.category_3}" to "${mappedCategory}"`
      });
    }
    
    return results;
    
  } catch (error) {
    console.error(`[CATEGORY-MAPPING] AI batch mapping error:`, error);
    
    // Fallback mapping for the entire batch
    return categoriesBatch.map(category => ({
      category_3: category.category_3,
      type_rekening: category.type_rekening,
      mapped_category: category.type_rekening === 'Opbrengsten' ? 'Omzet' : 'Algemene kosten',
      reasoning: `Fallback mapping due to AI error: ${error.message}`
    }));
  }
}

// GET: Retrieve existing mappings for user
export async function GET(request) {
  const startTime = performance.now();
  console.log('[CATEGORY-MAPPING] GET: Starting request');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get existing mappings
    const { data: mappings, error: mappingError } = await supabase
      .from('category_mapping')
      .select('*')
      .eq('user_id', user.id)
      .order('category_3');

    if (mappingError) {
      console.error('[CATEGORY-MAPPING] GET: Database error:', mappingError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[CATEGORY-MAPPING] GET: Retrieved ${mappings?.length || 0} mappings in ${duration}ms`);

    return NextResponse.json({
      mappings: mappings || [],
      categories: ENHANCED_PNL_CATEGORIES,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error('[CATEGORY-MAPPING] GET: Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', duration: `${duration}ms` },
      { status: 500 }
    );
  }
}

// POST: Create AI mappings for all category_3 values
export async function POST(request) {
  const startTime = performance.now();
  console.log('[CATEGORY-MAPPING] POST: Starting AI mapping request');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { category3List, forceRemap = false } = await request.json();

    if (!category3List || !Array.isArray(category3List)) {
      return NextResponse.json({ error: 'Invalid category3List' }, { status: 400 });
    }

    console.log(`[CATEGORY-MAPPING] POST: Processing ${category3List.length} categories, forceRemap=${forceRemap}`);

    const results = [];
    const errors = [];

    // Check existing mappings if not forcing remap
    let existingMappings = {};
    if (!forceRemap) {
      const { data: existing } = await supabase
        .from('category_mapping')
        .select('category_3, mapped_category, ai_confidence')
        .eq('user_id', user.id);
      
      if (existing) {
        existingMappings = existing.reduce((acc, mapping) => {
          acc[mapping.category_3] = mapping;
          return acc;
        }, {});
      }
    }

    // Filter categories that need mapping
    const categoriesToMap = category3List.filter(categoryInfo => {
      const { category_3 } = categoryInfo;
      return forceRemap || !existingMappings[category_3];
    });

    // Add skipped categories to results
    category3List.forEach(categoryInfo => {
      const { category_3 } = categoryInfo;
      if (!forceRemap && existingMappings[category_3]) {
        console.log(`[CATEGORY-MAPPING] POST: Skipping existing mapping for "${category_3}"`);
        results.push({
          category_3,
          status: 'skipped',
          mapping: existingMappings[category_3]
        });
      }
    });

    console.log(`[CATEGORY-MAPPING] POST: Processing ${categoriesToMap.length} categories in batches of 5`);

    // Process in batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < categoriesToMap.length; i += BATCH_SIZE) {
      const batch = categoriesToMap.slice(i, i + BATCH_SIZE);
      
      try {
        console.log(`[CATEGORY-MAPPING] POST: Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(categoriesToMap.length/BATCH_SIZE)}`);
        
        // Get AI mappings for the batch
        const aiResults = await mapCategoriesWithAI(batch);
        
        // Process each result in the batch
        for (const aiResult of aiResults) {
          try {
            // Upsert mapping to database
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
              console.error(`[CATEGORY-MAPPING] POST: Upsert error for "${aiResult.category_3}":`, upsertError);
              errors.push({
                category_3: aiResult.category_3,
                error: upsertError.message
              });
            } else {
              results.push({
                category_3: aiResult.category_3,
                status: forceRemap ? 'remapped' : 'mapped',
                mapping: {
                  ...mapping,
                  ai_reasoning: aiResult.reasoning
                }
              });
            }
          } catch (error) {
            console.error(`[CATEGORY-MAPPING] POST: Error saving "${aiResult.category_3}":`, error);
            errors.push({
              category_3: aiResult.category_3,
              error: error.message
            });
          }
        }

        // Small delay between batches to avoid overwhelming the AI
        if (i + BATCH_SIZE < categoriesToMap.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`[CATEGORY-MAPPING] POST: Error processing batch:`, error);
        // Add all categories in this batch to errors
        batch.forEach(categoryInfo => {
          errors.push({
            category_3: categoryInfo.category_3,
            error: error.message
          });
        });
      }
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[CATEGORY-MAPPING] POST: Completed in ${duration}ms - ${results.length} processed, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        total: category3List.length,
        processed: results.length,
        errors: errors.length,
        skipped: results.filter(r => r.status === 'skipped').length,
        mapped: results.filter(r => r.status === 'mapped').length,
        remapped: results.filter(r => r.status === 'remapped').length
      },
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error('[CATEGORY-MAPPING] POST: Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message,
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

// PUT: Update specific mapping (user verification/override)
export async function PUT(request) {
  const startTime = performance.now();
  console.log('[CATEGORY-MAPPING] PUT: Starting update request');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { category_3, mapped_category, user_verified = true } = await request.json();

    if (!category_3 || !mapped_category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!Object.keys(ENHANCED_PNL_CATEGORIES).includes(mapped_category)) {
      return NextResponse.json({ error: 'Invalid mapped_category' }, { status: 400 });
    }

    // Update mapping
    const { data: mapping, error: updateError } = await supabase
      .from('category_mapping')
      .update({
        mapped_category,
        user_verified,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('category_3', category_3)
      .select()
      .single();

    if (updateError) {
      console.error('[CATEGORY-MAPPING] PUT: Update error:', updateError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[CATEGORY-MAPPING] PUT: Updated mapping for "${category_3}" in ${duration}ms`);

    return NextResponse.json({
      success: true,
      mapping,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error('[CATEGORY-MAPPING] PUT: Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message,
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}
