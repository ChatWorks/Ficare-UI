'use client';

import { formatCurrency } from '../utils/formatters';
import { useState } from 'react';

export default function FinancialChecks({ data }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showInfo, setShowInfo] = useState({});

  if (!data || !data.monthlyData || data.monthlyData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#222c56]">
            Financiële Controles
          </h2>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <div className="text-slate-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-600 text-lg">
            Geen data beschikbaar voor financiële controles.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Laad eerst financiële data om controles uit te voeren.
          </p>
        </div>
      </div>
    );
  }

  // Get current and previous month data
  const getCurrentMonthData = (monthIndex) => {
    if (!data.monthlyData || monthIndex >= data.monthlyData.length) return null;
    return data.monthlyData[monthIndex];
  };

  const getPreviousMonthData = (monthIndex) => {
    if (!data.monthlyData || monthIndex + 1 >= data.monthlyData.length) return null;
    return data.monthlyData[monthIndex + 1];
  };

  // Helper function to get category value from categorieBreakdown
  const getCategoryValue = (monthData, categoryName) => {
    if (!monthData || !monthData.categorieBreakdown) return 0;
    const category = monthData.categorieBreakdown[categoryName];
    return category ? category.netAmount : 0;
  };

  // Helper function to get balance sheet value from accountTypeBreakdown
  const getBalanceValue = (monthData, categoryName) => {
    if (!monthData || !monthData.accountTypeBreakdown) return 0;
    
    // For balance sheet items, we use accountTypeBreakdown
    // Map common balance sheet terms to account types
    const balanceSheetMapping = {
      'Debiteuren': 'Activa',
      'Crediteuren': 'Passiva', 
      'Liquide middelen': 'Activa',
      'Materiële vaste activa': 'Activa',
      'Immateriële vaste activa': 'Activa',
      'Overlopende activa': 'Activa',
      'Overlopende passiva': 'Passiva',
      'Rekening-courant directie': 'Passiva',
      'Eigen vermogen': 'eigen_vermogen' // Special case
    };
    
    // Special case for Eigen vermogen - calculate from activa minus passiva
    if (categoryName === 'Eigen vermogen') {
      const activa = monthData.accountTypeBreakdown['Activa']?.netAmount || 0;
      const passiva = monthData.accountTypeBreakdown['Passiva']?.netAmount || 0;
      return activa - Math.abs(passiva);
    }
    
    // For specific balance sheet items, try to find in categorieBreakdown first
    if (monthData.categorieBreakdown[categoryName]) {
      return monthData.categorieBreakdown[categoryName].netAmount;
    }
    
    // Fallback to account type breakdown
    const accountType = balanceSheetMapping[categoryName];
    if (accountType && monthData.accountTypeBreakdown[accountType]) {
      return monthData.accountTypeBreakdown[accountType].netAmount;
    }
    
    return 0;
  };

  // Financial check functions
  const performFinancialChecks = (currentMonth, previousMonth) => {
    const checks = [];

    if (!currentMonth) return checks;

    // Calculate net result from account types (Opbrengsten - Kosten)
    const opbrengsten = Math.abs(currentMonth.accountTypeBreakdown['Opbrengsten']?.netAmount || 0);
    const kosten = Math.abs(currentMonth.accountTypeBreakdown['Kosten']?.netAmount || 0);
    const nettoresultaat = opbrengsten - kosten;
    
    // 1. P&L vs. Balanscontrole
    const eigenVermogenHuidig = getBalanceValue(currentMonth, 'Eigen vermogen');
    const eigenVermogenVorig = previousMonth ? getBalanceValue(previousMonth, 'Eigen vermogen') : 0;
    const plBalansDiff = Math.abs(nettoresultaat - (eigenVermogenHuidig - eigenVermogenVorig));
    
    checks.push({
      id: 'pl_balance_check',
      name: 'P&L vs. Balanscontrole',
      value: plBalansDiff,
      formula: 'Nettoresultaat - (Eigen vermogen deze maand - Eigen vermogen vorige maand)',
      status: plBalansDiff < 1000 ? 'groen' : plBalansDiff < 5000 ? 'geel' : 'rood',
      info: 'Controleert of het nettoresultaat uit de W&V overeenkomt met de verandering in eigen vermogen.',
      threshold: 'Groen: < €1.000, Geel: €1.000-€5.000, Rood: > €5.000',
      calculation: [
        { label: 'Opbrengsten', value: formatCurrency(opbrengsten) },
        { label: 'Kosten', value: formatCurrency(kosten) },
        { label: 'Nettoresultaat', value: formatCurrency(nettoresultaat) },
        { label: 'Eigen vermogen huidig', value: formatCurrency(eigenVermogenHuidig) },
        { label: 'Eigen vermogen vorig', value: formatCurrency(eigenVermogenVorig) },
        { label: 'EV mutatie', value: formatCurrency(eigenVermogenHuidig - eigenVermogenVorig) },
        { label: 'Verschil', value: formatCurrency(plBalansDiff) }
      ],
      dataSources: [
        { name: 'Opbrengsten', value: formatCurrency(opbrengsten), source: 'Account type: Opbrengsten' },
        { name: 'Kosten', value: formatCurrency(kosten), source: 'Account type: Kosten' },
        { name: 'Eigen vermogen huidig', value: formatCurrency(eigenVermogenHuidig), source: 'Berekend: Activa - |Passiva|' },
        { name: 'Eigen vermogen vorig', value: formatCurrency(eigenVermogenVorig), source: 'Berekend: Activa - |Passiva| (vorige maand)' }
      ]
    });

    // 2. Omzet vs. COGS-verhouding (Brutomarge)
    // Use the total revenue from account type
    const omzet = opbrengsten;
    
    // Try to get specific cost categories, fallback to searching in categorieBreakdown
    const findCategoryValue = (keywords, monthData = currentMonth) => {
      if (!monthData || !monthData.categorieBreakdown) return { value: 0, source: 'Geen data beschikbaar', categoryName: null };
      for (const [categoryName, categoryData] of Object.entries(monthData.categorieBreakdown)) {
        const lowerName = categoryName.toLowerCase();
        if (keywords.some(keyword => lowerName.includes(keyword.toLowerCase()))) {
          return { 
            value: Math.abs(categoryData.netAmount), 
            source: `Categorie: "${categoryName}"`,
            categoryName: categoryName,
            debet: categoryData.totalDebet,
            credit: categoryData.totalCredit
          };
        }
      }
      return { value: 0, source: `Geen categorie gevonden voor: ${keywords.join(', ')}`, categoryName: null };
    };
    
    const inkoopwaarde = findCategoryValue(['inkoop', 'cogs', 'inkoopwaarde', 'handelsgoederen']);
    const provisies = findCategoryValue(['provisie', 'commissie']);
    const personeelskosten = findCategoryValue(['personeel', 'loon', 'salaris', 'personeelskosten']);
    const brutomarge = omzet > 0 ? ((omzet - inkoopwaarde.value - provisies.value - personeelskosten.value) / omzet) * 100 : 0;
    
    checks.push({
      id: 'gross_margin_check',
      name: 'Brutomarge percentage',
      value: brutomarge,
      formula: '((Omzet - Inkoopwaarde - Provisies - Personeelskosten) / Omzet) * 100',
      status: brutomarge > 50 ? 'groen' : brutomarge > 30 ? 'geel' : 'rood',
      info: 'Meet de winstgevendheid na aftrek van directe kosten.',
      threshold: 'Groen: > 50%, Geel: 30-50%, Rood: < 30%',
      isPercentage: true,
      calculation: [
        { label: 'Omzet', value: formatCurrency(omzet) },
        { label: 'Inkoopwaarde', value: formatCurrency(inkoopwaarde.value) },
        { label: 'Provisies', value: formatCurrency(provisies.value) },
        { label: 'Personeelskosten', value: formatCurrency(personeelskosten.value) },
        { label: 'Marge (€)', value: formatCurrency(omzet - inkoopwaarde.value - provisies.value - personeelskosten.value) },
        { label: 'Brutomarge (%)', value: `${brutomarge.toFixed(1)}%` }
      ],
      dataSources: [
        { name: 'Omzet', value: formatCurrency(omzet), source: 'Account type: Opbrengsten' },
        { name: 'Inkoopwaarde', value: formatCurrency(inkoopwaarde.value), source: inkoopwaarde.source },
        { name: 'Provisies', value: formatCurrency(provisies.value), source: provisies.source },
        { name: 'Personeelskosten', value: formatCurrency(personeelskosten.value), source: personeelskosten.source }
      ]
    });

    // 3. Debiteurenomloop check (DSO)
    const debiteuren = findCategoryValue(['debiteuren', 'klanten', 'vorderingen']);
    const dso = omzet > 0 ? (debiteuren.value / omzet) * 30 : 0;
    
    checks.push({
      id: 'dso_check',
      name: 'Debiteurenomloop (DSO)',
      value: dso,
      formula: '(Debiteuren / Omzet) * 30',
      status: dso < 30 ? 'groen' : dso < 60 ? 'geel' : 'rood',
      info: 'Gemiddelde betalingstermijn van klanten in dagen.',
      threshold: 'Groen: < 30 dagen, Geel: 30-60 dagen, Rood: > 60 dagen',
      isDays: true,
      calculation: [
        { label: 'Debiteuren', value: formatCurrency(debiteuren.value) },
        { label: 'Omzet', value: formatCurrency(omzet) },
        { label: 'Verhouding', value: (debiteuren.value / omzet * 100).toFixed(2) + '%' },
        { label: 'DSO (dagen)', value: Math.round(dso) + ' dagen' }
      ],
      dataSources: [
        { name: 'Debiteuren', value: formatCurrency(debiteuren.value), source: debiteuren.source },
        { name: 'Omzet', value: formatCurrency(omzet), source: 'Account type: Opbrengsten' }
      ]
    });

    // 4. Crediteurenomloop check (DPO)
    const crediteuren = findCategoryValue(['crediteuren', 'leveranciers', 'schulden']);
    const dpo = inkoopwaarde.value > 0 ? (crediteuren.value / inkoopwaarde.value) * 30 : 0;
    
    checks.push({
      id: 'dpo_check',
      name: 'Crediteurenomloop (DPO)',
      value: dpo,
      formula: '(Crediteuren / Inkoopwaarde) * 30',
      status: dpo > 30 ? 'groen' : dpo > 15 ? 'geel' : 'rood',
      info: 'Gemiddelde betalingstermijn aan leveranciers in dagen.',
      threshold: 'Groen: > 30 dagen, Geel: 15-30 dagen, Rood: < 15 dagen',
      isDays: true,
      calculation: [
        { label: 'Crediteuren', value: formatCurrency(crediteuren.value) },
        { label: 'Inkoopwaarde', value: formatCurrency(inkoopwaarde.value) },
        { label: 'Verhouding', value: (crediteuren.value / inkoopwaarde.value * 100).toFixed(2) + '%' },
        { label: 'DPO (dagen)', value: Math.round(dpo) + ' dagen' }
      ],
      dataSources: [
        { name: 'Crediteuren', value: formatCurrency(crediteuren.value), source: crediteuren.source },
        { name: 'Inkoopwaarde', value: formatCurrency(inkoopwaarde.value), source: inkoopwaarde.source }
      ]
    });

    // 5. Liquide middelen mutatie
    const liquideMiddelenHuidig = findCategoryValue(['liquide', 'kas', 'bank', 'giro']);
    const liquideMiddelenVorig = previousMonth ? findCategoryValue(['liquide', 'kas', 'bank', 'giro'], previousMonth) : { value: 0, source: 'Geen vorige maand data' };
    const liquideMutatie = liquideMiddelenHuidig.value - liquideMiddelenVorig.value;
    
    checks.push({
      id: 'liquidity_change',
      name: 'Liquide middelen mutatie',
      value: liquideMutatie,
      formula: 'Liquide middelen deze maand - Liquide middelen vorige maand',
      status: liquideMutatie > 0 ? 'groen' : liquideMutatie > -10000 ? 'geel' : 'rood',
      info: 'Verandering in beschikbare liquide middelen.',
      threshold: 'Groen: Positief, Geel: -€10.000 tot €0, Rood: < -€10.000',
      calculation: [
        { label: 'Liquide middelen huidig', value: formatCurrency(liquideMiddelenHuidig.value) },
        { label: 'Liquide middelen vorig', value: formatCurrency(liquideMiddelenVorig.value) },
        { label: 'Mutatie', value: formatCurrency(liquideMutatie) }
      ],
      dataSources: [
        { name: 'Liquide middelen huidig', value: formatCurrency(liquideMiddelenHuidig.value), source: liquideMiddelenHuidig.source },
        { name: 'Liquide middelen vorig', value: formatCurrency(liquideMiddelenVorig.value), source: liquideMiddelenVorig.source }
      ]
    });

    // 6. Mutatie vaste activa + afschrijvingen
    const materieleVasteActiva = findCategoryValue(['materiële', 'materieel', 'machines', 'inventaris', 'vaste activa']);
    const immaterieleVasteActiva = findCategoryValue(['immateriële', 'immaterieel', 'goodwill', 'software', 'licenties']);
    const afschrijvingskosten = findCategoryValue(['afschrijving', 'depreciation', 'amortisatie']);
    const totaleVasteActiva = materieleVasteActiva.value + immaterieleVasteActiva.value;
    const maxAfschrijving = totaleVasteActiva * 0.1;
    
    checks.push({
      id: 'depreciation_check',
      name: 'Afschrijvingen controle',
      value: afschrijvingskosten.value,
      formula: 'Afschrijvingskosten vs. (Materiële + Immateriële vaste activa) * 10%',
      status: afschrijvingskosten.value <= maxAfschrijving ? 'groen' : afschrijvingskosten.value <= maxAfschrijving * 1.5 ? 'geel' : 'rood',
      info: 'Controleert of afschrijvingskosten realistisch zijn ten opzichte van vaste activa.',
      threshold: 'Groen: ≤ 10% van vaste activa, Geel: 10-15%, Rood: > 15%',
      calculation: [
        { label: 'Materiële vaste activa', value: formatCurrency(materieleVasteActiva.value) },
        { label: 'Immateriële vaste activa', value: formatCurrency(immaterieleVasteActiva.value) },
        { label: 'Totale vaste activa', value: formatCurrency(totaleVasteActiva) },
        { label: 'Max afschrijving (10%)', value: formatCurrency(maxAfschrijving) },
        { label: 'Werkelijke afschrijving', value: formatCurrency(afschrijvingskosten.value) },
        { label: 'Percentage', value: totaleVasteActiva > 0 ? `${(afschrijvingskosten.value / totaleVasteActiva * 100).toFixed(1)}%` : '0%' }
      ],
      dataSources: [
        { name: 'Materiële vaste activa', value: formatCurrency(materieleVasteActiva.value), source: materieleVasteActiva.source },
        { name: 'Immateriële vaste activa', value: formatCurrency(immaterieleVasteActiva.value), source: immaterieleVasteActiva.source },
        { name: 'Afschrijvingskosten', value: formatCurrency(afschrijvingskosten.value), source: afschrijvingskosten.source }
      ]
    });

    // 7. BTW-saldi check
    const belastingenPremies = findCategoryValue(['belasting', 'btw', 'premie', 'tax', 'vat']);
    const maxBelastingen = omzet * 0.25;
    
    checks.push({
      id: 'tax_check',
      name: 'BTW-saldi controle',
      value: belastingenPremies.value,
      formula: 'Belastingen & Premies vs. Omzet * 25%',
      status: belastingenPremies.value <= maxBelastingen ? 'groen' : belastingenPremies.value <= maxBelastingen * 1.2 ? 'geel' : 'rood',
      info: 'Controleert of belastingen en premies niet te hoog zijn ten opzichte van omzet.',
      threshold: 'Groen: ≤ 25% van omzet, Geel: 25-30%, Rood: > 30%',
      calculation: [
        { label: 'Omzet', value: formatCurrency(omzet) },
        { label: 'Max belastingen (25%)', value: formatCurrency(maxBelastingen) },
        { label: 'Werkelijke belastingen', value: formatCurrency(belastingenPremies.value) },
        { label: 'Percentage van omzet', value: omzet > 0 ? `${(belastingenPremies.value / omzet * 100).toFixed(1)}%` : '0%' }
      ],
      dataSources: [
        { name: 'Belastingen & Premies', value: formatCurrency(belastingenPremies.value), source: belastingenPremies.source },
        { name: 'Omzet', value: formatCurrency(omzet), source: 'Account type: Opbrengsten' }
      ]
    });

    // 8. Balansposten consistentie
    const debiteurenCheck = debiteuren.value > 0;
    const crediteurenCheck = crediteuren.value > 0;
    const balansConsistent = debiteurenCheck && crediteurenCheck;
    
    checks.push({
      id: 'balance_consistency',
      name: 'Balansposten consistentie',
      value: balansConsistent ? 1 : 0,
      formula: 'Controleert of Debiteuren > 0 en Crediteuren > 0',
      status: balansConsistent ? 'groen' : 'rood',
      info: 'Controleert of belangrijke balansposten aanwezig zijn.',
      threshold: 'Groen: Beide > 0, Rood: Een of beide = 0',
      isBoolean: true,
      calculation: [
        { label: 'Debiteuren > 0', value: debiteurenCheck ? 'Ja' : 'Nee' },
        { label: 'Crediteuren > 0', value: crediteurenCheck ? 'Ja' : 'Nee' },
        { label: 'Beide aanwezig', value: balansConsistent ? 'Ja' : 'Nee' }
      ],
      dataSources: [
        { name: 'Debiteuren', value: formatCurrency(debiteuren.value), source: debiteuren.source },
        { name: 'Crediteuren', value: formatCurrency(crediteuren.value), source: crediteuren.source }
      ]
    });

    // 9. Kasstroomconsistentie check
    const kasstroomVerschil = Math.abs(liquideMutatie - nettoresultaat);
    
    checks.push({
      id: 'cashflow_consistency',
      name: 'Kasstroomconsistentie',
      value: kasstroomVerschil,
      formula: '|(Liquide middelen mutatie) - Nettoresultaat|',
      status: kasstroomVerschil < omzet * 0.1 ? 'groen' : kasstroomVerschil < omzet * 0.2 ? 'geel' : 'rood',
      info: 'Controleert de consistentie tussen kasstroom en resultaat.',
      threshold: 'Groen: < 10% van omzet, Geel: 10-20%, Rood: > 20%'
    });

    // 10. Accruals/voorzieningen check
    const overlopendeActivaCheck = findCategoryValue(['overlopend', 'vooruit', 'accruals']);
    const overlopendePassivaCheck = findCategoryValue(['overlopend', 'vooruit', 'accruals', 'voorziening']);
    const totaalOverlopend = overlopendeActivaCheck.value + overlopendePassivaCheck.value;
    const maxOverlopend = omzet * 0.3;
    
    checks.push({
      id: 'accruals_check',
      name: 'Accruals/voorzieningen',
      value: totaalOverlopend,
      formula: '(Overlopende activa + Overlopende passiva) vs. Omzet * 30%',
      status: totaalOverlopend <= maxOverlopend ? 'groen' : totaalOverlopend <= maxOverlopend * 1.5 ? 'geel' : 'rood',
      info: 'Controleert of overlopende posten niet te hoog zijn.',
      threshold: 'Groen: ≤ 30% van omzet, Geel: 30-45%, Rood: > 45%',
      calculation: [
        { label: 'Overlopende activa', value: formatCurrency(overlopendeActivaCheck.value) },
        { label: 'Overlopende passiva', value: formatCurrency(overlopendePassivaCheck.value) },
        { label: 'Totaal overlopend', value: formatCurrency(totaalOverlopend) },
        { label: 'Max toegestaan (30%)', value: formatCurrency(maxOverlopend) }
      ],
      dataSources: [
        { name: 'Overlopende activa', value: formatCurrency(overlopendeActivaCheck.value), source: overlopendeActivaCheck.source },
        { name: 'Overlopende passiva', value: formatCurrency(overlopendePassivaCheck.value), source: overlopendePassivaCheck.source }
      ]
    });

    // 11. Intercompany check
    const rekeningCourantDirectie = findCategoryValue(['rekening-courant', 'directie', 'intercompany', 'aandeelhouder']);
    const maxIntercompany = omzet * 0.5;
    
    checks.push({
      id: 'intercompany_check',
      name: 'Intercompany controle',
      value: rekeningCourantDirectie.value,
      formula: '|Rekening-courant directie| vs. Omzet * 50%',
      status: rekeningCourantDirectie.value <= maxIntercompany ? 'groen' : rekeningCourantDirectie.value <= maxIntercompany * 1.2 ? 'geel' : 'rood',
      info: 'Controleert of rekening-courant met directie niet te hoog is.',
      threshold: 'Groen: ≤ 50% van omzet, Geel: 50-60%, Rood: > 60%',
      calculation: [
        { label: 'Rekening-courant directie', value: formatCurrency(rekeningCourantDirectie.value) },
        { label: 'Max toegestaan (50%)', value: formatCurrency(maxIntercompany) },
        { label: 'Percentage van omzet', value: omzet > 0 ? `${(rekeningCourantDirectie.value / omzet * 100).toFixed(1)}%` : '0%' }
      ],
      dataSources: [
        { name: 'Rekening-courant directie', value: formatCurrency(rekeningCourantDirectie.value), source: rekeningCourantDirectie.source },
        { name: 'Omzet', value: formatCurrency(omzet), source: 'Account type: Opbrengsten' }
      ]
    });

    // 12. Onevenredige mutaties check
    const omzetVorig = previousMonth ? Math.abs(previousMonth.accountTypeBreakdown['Opbrengsten']?.netAmount || 0) : 0;
    const omzetMutatie = omzetVorig > 0 ? ((omzet - omzetVorig) / omzetVorig) * 100 : 0;
    
    checks.push({
      id: 'revenue_variance',
      name: 'Omzetmutatie controle',
      value: Math.abs(omzetMutatie),
      formula: '|((Omzet deze maand - Omzet vorige maand) / Omzet vorige maand) * 100|',
      status: Math.abs(omzetMutatie) < 20 ? 'groen' : Math.abs(omzetMutatie) < 50 ? 'geel' : 'rood',
      info: 'Controleert op onevenredige omzetschommelingen.',
      threshold: 'Groen: < 20%, Geel: 20-50%, Rood: > 50%',
      isPercentage: true
    });

    // 13. Kostenstructuur check
    // Use total costs from account type breakdown
    const totaleKosten = kosten; // This is already the total from accountTypeBreakdown
    const kostenPercentage = omzet > 0 ? (totaleKosten / omzet) * 100 : 0;
    
    checks.push({
      id: 'cost_structure',
      name: 'Kostenstructuur',
      value: kostenPercentage,
      formula: '(Totale kosten / Omzet) * 100',
      status: kostenPercentage < 80 ? 'groen' : kostenPercentage < 95 ? 'geel' : 'rood',
      info: 'Controleert of de kostenstructuur gezond is.',
      threshold: 'Groen: < 80%, Geel: 80-95%, Rood: > 95%',
      isPercentage: true,
      debug: `Totale kosten: ${totaleKosten}, Omzet: ${omzet}`
    });

    // 14. Ratio-analyse (Current Ratio)
    const overlopendeActivaRatio = findCategoryValue(['overlopend', 'vooruit', 'accruals']);
    const overlopendePassivaRatio = findCategoryValue(['overlopend', 'vooruit', 'accruals', 'voorziening']);
    const vlottendeActiva = debiteuren.value + liquideMiddelenHuidig.value + overlopendeActivaRatio.value;
    const kortlopendeSchulden = crediteuren.value + overlopendePassivaRatio.value;
    const currentRatio = kortlopendeSchulden > 0 ? vlottendeActiva / kortlopendeSchulden : 0;
    
    checks.push({
      id: 'current_ratio',
      name: 'Current Ratio',
      value: currentRatio,
      formula: '(Debiteuren + Liquide middelen + Overlopende activa) / (Crediteuren + Overlopende passiva)',
      status: currentRatio > 1.2 ? 'groen' : currentRatio > 1.0 ? 'geel' : 'rood',
      info: 'Meet de liquiditeit van de onderneming.',
      threshold: 'Groen: > 1.2, Geel: 1.0-1.2, Rood: < 1.0',
      isRatio: true,
      calculation: [
        { label: 'Debiteuren', value: formatCurrency(debiteuren.value) },
        { label: 'Liquide middelen', value: formatCurrency(liquideMiddelenHuidig.value) },
        { label: 'Overlopende activa', value: formatCurrency(overlopendeActivaRatio.value) },
        { label: 'Totaal vlottende activa', value: formatCurrency(vlottendeActiva) },
        { label: 'Crediteuren', value: formatCurrency(crediteuren.value) },
        { label: 'Overlopende passiva', value: formatCurrency(overlopendePassivaRatio.value) },
        { label: 'Totaal kortlopende schulden', value: formatCurrency(kortlopendeSchulden) },
        { label: 'Current Ratio', value: currentRatio.toFixed(2) }
      ],
      dataSources: [
        { name: 'Debiteuren', value: formatCurrency(debiteuren.value), source: debiteuren.source },
        { name: 'Liquide middelen', value: formatCurrency(liquideMiddelenHuidig.value), source: liquideMiddelenHuidig.source },
        { name: 'Overlopende activa', value: formatCurrency(overlopendeActivaRatio.value), source: overlopendeActivaRatio.source },
        { name: 'Crediteuren', value: formatCurrency(crediteuren.value), source: crediteuren.source },
        { name: 'Overlopende passiva', value: formatCurrency(overlopendePassivaRatio.value), source: overlopendePassivaRatio.source }
      ]
    });

    // 15. Periodieke posten tijdigheid
    const personeelskostenCheck = personeelskosten.value > 0;
    const huisvestingskosten = findCategoryValue(['huisvesting', 'huur', 'kantoor', 'pand']);
    const kantoorkosten = findCategoryValue(['kantoor', 'ict', 'computer', 'telefoon', 'internet']);
    const overheadCheck = huisvestingskosten.value > 0 || kantoorkosten.value > 0;
    const periodiekePostenOk = personeelskostenCheck && overheadCheck;
    
    checks.push({
      id: 'periodic_costs',
      name: 'Periodieke posten tijdigheid',
      value: periodiekePostenOk ? 1 : 0,
      formula: 'Controleert of Personeelskosten > 0 en (Huisvestingskosten > 0 of Kantoorkosten > 0)',
      status: periodiekePostenOk ? 'groen' : 'rood',
      info: 'Controleert of periodieke kosten zijn geboekt.',
      threshold: 'Groen: Alle posten geboekt, Rood: Ontbrekende posten',
      isBoolean: true,
      calculation: [
        { label: 'Personeelskosten > 0', value: personeelskostenCheck ? 'Ja' : 'Nee' },
        { label: 'Huisvestingskosten > 0', value: huisvestingskosten.value > 0 ? 'Ja' : 'Nee' },
        { label: 'Kantoorkosten > 0', value: kantoorkosten.value > 0 ? 'Ja' : 'Nee' },
        { label: 'Overhead aanwezig', value: overheadCheck ? 'Ja' : 'Nee' },
        { label: 'Alle posten OK', value: periodiekePostenOk ? 'Ja' : 'Nee' }
      ],
      dataSources: [
        { name: 'Personeelskosten', value: formatCurrency(personeelskosten.value), source: personeelskosten.source },
        { name: 'Huisvestingskosten', value: formatCurrency(huisvestingskosten.value), source: huisvestingskosten.source },
        { name: 'Kantoorkosten', value: formatCurrency(kantoorkosten.value), source: kantoorkosten.source }
      ]
    });

    return checks;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'groen': return 'bg-green-100 text-green-800 border-green-200';
      case 'geel': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rood': return 'bg-red-100 text-red-800 border-red-200';
      case 'blauw': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'groen': 
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'geel':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'rood':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const formatValue = (check) => {
    if (check.isBoolean) {
      return check.value ? 'Voldoet' : 'Voldoet niet';
    } else if (check.isPercentage) {
      return `${check.value.toFixed(1)}%`;
    } else if (check.isDays) {
      return `${Math.round(check.value)} dagen`;
    } else if (check.isRatio) {
      return check.value.toFixed(2);
    } else {
      return formatCurrency(check.value);
    }
  };

  const toggleInfo = (checkId) => {
    setShowInfo(prev => ({
      ...prev,
      [checkId]: !prev[checkId]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#222c56]">
          Financiële Controles
        </h2>
        <div className="text-sm text-slate-600">
          15 maandelijkse controles voor financiële gezondheid
        </div>
      </div>

      {/* Month selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-slate-700">Selecteer maand:</span>
          <div className="flex gap-2 flex-wrap">
            {data.monthlyData.map((month, index) => (
              <button
                key={index}
                onClick={() => setSelectedMonth(index)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  selectedMonth === index
                    ? 'bg-[#222c56] text-white border-[#222c56]'
                    : 'bg-white text-[#222c56] border-slate-300 hover:bg-slate-50 hover:border-[#82cff4]'
                }`}
              >
                {month.monthName}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Financial checks results */}
      {selectedMonth !== null && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[#222c56] mb-4">
              Controles voor {data.monthlyData[selectedMonth].monthName}
            </h3>
            
            {(() => {
              const currentMonth = getCurrentMonthData(selectedMonth);
              const previousMonth = getPreviousMonthData(selectedMonth);
              const checks = performFinancialChecks(currentMonth, previousMonth);
              
              // Group checks by category
              const balanceChecks = checks.filter(c => ['pl_balance_check', 'balance_consistency', 'cashflow_consistency'].includes(c.id));
              const operationalChecks = checks.filter(c => ['depreciation_check', 'tax_check', 'accruals_check', 'periodic_costs'].includes(c.id));
              const ratioChecks = checks.filter(c => ['gross_margin_check', 'dso_check', 'dpo_check', 'liquidity_change', 'current_ratio'].includes(c.id));
              const otherChecks = checks.filter(c => ['intercompany_check', 'revenue_variance', 'cost_structure'].includes(c.id));
              
              const checkGroups = [
                { title: 'Financiële en Balanscontroles', checks: balanceChecks },
                { title: 'Operationele en Kostencontroles', checks: operationalChecks },
                { title: 'Ratio en Liquiditeitsanalyse', checks: ratioChecks },
                { title: 'Overige Controles', checks: otherChecks }
              ];

              return (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-slate-100 border border-slate-200 rounded-lg p-6 mt-6">
                    <h4 className="text-lg font-semibold text-[#222c56] mb-4">Samenvatting</h4>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="bg-white rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600">
                          {checks.filter(c => c.status === 'groen').length}
                        </div>
                        <div className="text-sm text-slate-600">Groen</div>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <div className="text-2xl font-bold text-yellow-600">
                          {checks.filter(c => c.status === 'geel').length}
                        </div>
                        <div className="text-sm text-slate-600">Geel</div>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <div className="text-2xl font-bold text-red-600">
                          {checks.filter(c => c.status === 'rood').length}
                        </div>
                        <div className="text-sm text-slate-600">Rood</div>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <div className="text-2xl font-bold text-[#222c56]">
                          {checks.length}
                        </div>
                        <div className="text-sm text-slate-600">Totaal</div>
                      </div>
                    </div>
                  </div>
                  {checkGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-3">
                      <h4 className="text-md font-semibold text-slate-700 border-b border-slate-200 pb-2">
                        {group.title}
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {group.checks.map((check) => (
                          <div key={check.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h5 className="font-medium text-[#222c56] text-sm mb-1">
                                  {check.name}
                                </h5>
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(check.status)}`}>
                                  {getStatusIcon(check.status)}
                                  {formatValue(check)}
                                </div>
                              </div>
                              <button
                                onClick={() => toggleInfo(check.id)}
                                className="text-slate-400 hover:text-[#222c56] transition-colors p-1"
                                title="Toon informatie"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                              </button>
                            </div>
                            
                            {showInfo[check.id] && (
                              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                                <div className="text-xs text-slate-600">
                                  <strong>Uitleg:</strong> {check.info}
                                </div>
                                
                                {/* Detailed calculation breakdown */}
                                <div className="bg-green-50 border border-green-200 rounded p-3">
                                  <div className="text-xs font-semibold text-green-800 mb-2">Berekening stap-voor-stap:</div>
                                  {check.calculation && (
                                    <div className="text-xs text-green-700 space-y-1">
                                      {check.calculation.map((step, index) => (
                                        <div key={index} className="flex justify-between items-center">
                                          <span>{step.label}:</span>
                                          <span className="font-mono bg-white px-2 py-1 rounded">{step.value}</span>
                                        </div>
                                      ))}
                                      <div className="border-t border-green-300 pt-2 mt-2">
                                        <div className="flex justify-between items-center font-semibold">
                                          <span>Eindresultaat:</span>
                                          <span className="font-mono bg-green-100 px-2 py-1 rounded">{formatValue(check)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Data sources */}
                                {check.dataSources && (
                                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                    <div className="text-xs font-semibold text-blue-800 mb-2">Data bronnen:</div>
                                    <div className="text-xs text-blue-700 space-y-1">
                                      {check.dataSources.map((source, index) => (
                                        <div key={index} className="flex justify-between items-center">
                                          <span>{source.name}:</span>
                                          <div className="text-right">
                                            <div className="font-mono bg-white px-2 py-1 rounded">{source.value}</div>
                                            <div className="text-xs text-blue-600 mt-1">{source.source}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="text-xs text-slate-600">
                                  <strong>Formule:</strong> {check.formula}
                                </div>
                                <div className="text-xs text-slate-600">
                                  <strong>Drempelwaarden:</strong> {check.threshold}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {/* Debug section - show available categories */}
                  {currentMonth && currentMonth.categorieBreakdown && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">Debug: Beschikbare categorieën</h4>
                      <div className="text-xs text-blue-700 space-y-1">
                        {Object.entries(currentMonth.categorieBreakdown).slice(0, 10).map(([name, data]) => (
                          <div key={name} className="flex justify-between">
                            <span>{name}</span>
                            <span>{formatCurrency(data.netAmount)}</span>
                          </div>
                        ))}
                        {Object.keys(currentMonth.categorieBreakdown).length > 10 && (
                          <div className="text-blue-600">... en {Object.keys(currentMonth.categorieBreakdown).length - 10} meer</div>
                        )}
                      </div>
                      <div className="mt-3 pt-2 border-t border-blue-200">
                        <div className="text-xs text-blue-700">
                          <strong>Account types:</strong>
                          {currentMonth.accountTypeBreakdown && Object.entries(currentMonth.accountTypeBreakdown).map(([type, data]) => (
                            <span key={type} className="ml-2">{type}: {formatCurrency(data.netAmount)}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {selectedMonth === null && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <div className="text-slate-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-600 text-lg">
            Selecteer een maand om financiële controles uit te voeren.
          </p>
        </div>
      )}
    </div>
  );
}