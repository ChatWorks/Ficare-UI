// AI Chat endpoint powered by Gemini 2.5 Flash with function calling, wired to AFAS financial tools
import { getToolsForGemini, executeToolCall, setToolsBaseUrl } from '@/lib/finance/tools';

// Helper functions to handle enhanced financial data tools
function handleEnhancedPnLData(args, financialData) {
  const { months = [], categories = [] } = args;
  
  // Filter monthly data by requested months
  let monthlyData = financialData.monthlyData || [];
  if (months.length > 0) {
    monthlyData = monthlyData.filter(m => {
      const monthKey = `${m.year}-${String(m.month).padStart(2, '0')}`;
      return months.includes(monthKey);
    });
  }
  
  // Get category mappings from financialData
  const categoryMappings = financialData.categoryMappings || [];
  const mappingLookup = categoryMappings.reduce((acc, mapping) => {
    acc[mapping.category_3] = mapping.mapped_category;
    return acc;
  }, {});
  
  // CRITICAL: Use EXACT same calculation logic as EnhancedProfitLoss.jsx
  const getMappedAmountForMonth = (monthKey, mappedCategory) => {
    const monthData = monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    if (!monthData) return 0;
    
    const categoryRecords = monthData.records?.filter(r => {
      const category3 = r.Omschrijving_3 || 'Overig';
      return mappingLookup[category3] === mappedCategory;
    }) || [];
    
    return categoryRecords.reduce((sum, r) => {
      // For revenue: credit - debet (positive revenue)
      // For costs: debet - credit (positive costs, will be made negative in display)
      if (mappedCategory === 'Omzet' || mappedCategory === 'Provisies') {
        return sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0));
      } else {
        return sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0));
      }
    }, 0);
  };
  
  const result = {
    period: `${financialData.originalPeriod?.startYear}-${String(financialData.originalPeriod?.startMonth || 1).padStart(2, '0')} tot ${financialData.originalPeriod?.endYear}-${String(financialData.originalPeriod?.endMonth || 12).padStart(2, '0')}`,
    rows: [], // CRITICAL: Use 'rows' format for clickable parsing
    summary: {},
    source_refs: [] // CRITICAL: Add source references for drill-down
  };
  
  // EXACT SAME CALCULATIONS AS EnhancedProfitLoss.jsx - INCLUDING FORMATTING
  
  // Helper functions for exact same calculations
  const getAmountForMonth = (monthKey, category) => {
    return getMappedAmountForMonth(monthKey, category);
  };
  
  const getTotalAmount = (category) => {
    return monthlyData.reduce((sum, monthData) => {
      const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
      return sum + getMappedAmountForMonth(monthKey, category);
    }, 0);
  };
  
  // Create month headers for calculations
  const monthHeaders = monthlyData.map(m => ({
    key: `${m.year}-${String(m.month).padStart(2, '0')}`,
    name: `${String(m.month).padStart(2, '0')}-${m.year}`
  }));
  
  // EXACT SAME ROWS AS EnhancedProfitLoss.jsx
  
  // 1. Omzet (positive as-is)
  const omzetMonths = monthHeaders.map(month => getAmountForMonth(month.key, 'Omzet'));
  const omzetTotal = getTotalAmount('Omzet');
  result.rows.push({
    post: 'Omzet',
    key: 'omzet',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, omzetMonths[i]])),
    total: omzetTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, omzetMonths[i]]))
  });
  
  // 2. Inkoopwaarde omzet (negative with -Math.abs)
  const inkoopMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Inkoopwaarde omzet')));
  const inkoopTotal = -Math.abs(getTotalAmount('Inkoopwaarde omzet'));
  result.rows.push({
    post: 'Inkoopwaarde omzet',
    key: 'inkoopwaarde_omzet',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, inkoopMonths[i]])),
    total: inkoopTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, inkoopMonths[i]]))
  });
  
  // 3. Provisies (negative with -Math.abs)
  const provisieMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Provisies')));
  const provisieTotal = -Math.abs(getTotalAmount('Provisies'));
  result.rows.push({
    post: 'Provisies',
    key: 'provisies',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, provisieMonths[i]])),
    total: provisieTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, provisieMonths[i]]))
  });
  
  // 4. Personeelskosten direct (negative with -Math.abs)
  const personeelDirectMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Personeelskosten direct')));
  const personeelDirectTotal = -Math.abs(getTotalAmount('Personeelskosten direct'));
  result.rows.push({
    post: 'Personeelskosten direct',
    key: 'personeelskosten_direct',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, personeelDirectMonths[i]])),
    total: personeelDirectTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, personeelDirectMonths[i]]))
  });
  
  // 5. MARGE (calculated - EXACT same formula)
  const margeMonths = monthHeaders.map((month, index) => 
    omzetMonths[index] + inkoopMonths[index] + provisieMonths[index] + personeelDirectMonths[index]
  );
  const margeTotal = omzetTotal + inkoopTotal + provisieTotal + personeelDirectTotal;
  result.rows.push({
    post: 'Marge',
    key: 'marge',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, margeMonths[i]])),
    total: margeTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, margeMonths[i]]))
  });
  
  // 6. Autokosten (negative with -Math.abs)
  const autoMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Autokosten')));
  const autoTotal = -Math.abs(getTotalAmount('Autokosten'));
  result.rows.push({
    post: 'Autokosten',
    key: 'autokosten',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, autoMonths[i]])),
    total: autoTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, autoMonths[i]]))
  });
  
  // 7. Marketingkosten (negative with -Math.abs)
  const marketingMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Marketingkosten')));
  const marketingTotal = -Math.abs(getTotalAmount('Marketingkosten'));
  result.rows.push({
    post: 'Marketingkosten',
    key: 'marketingkosten',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, marketingMonths[i]])),
    total: marketingTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, marketingMonths[i]]))
  });
  
  // 8. Operationele personeelskosten (negative with -Math.abs)
  const personeelOpMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Operationele personeelskosten')));
  const personeelOpTotal = -Math.abs(getTotalAmount('Operationele personeelskosten'));
  result.rows.push({
    post: 'Operationele personeelskosten',
    key: 'operationele_personeelskosten',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, personeelOpMonths[i]])),
    total: personeelOpTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, personeelOpMonths[i]]))
  });
  
  // 9. CONTRIBUTIEMARGE (calculated - EXACT same formula)
  const contributieMonths = monthHeaders.map((month, index) => 
    margeMonths[index] + autoMonths[index] + marketingMonths[index] + personeelOpMonths[index]
  );
  const contributieTotal = margeTotal + autoTotal + marketingTotal + personeelOpTotal;
  result.rows.push({
    post: 'Contributiemarge',
    key: 'contributiemarge',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, contributieMonths[i]])),
    total: contributieTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, contributieMonths[i]]))
  });
  
  // 10. Huisvestingskosten (negative with -Math.abs)
  const huisvestingMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Huisvestingskosten')));
  const huisvestingTotal = -Math.abs(getTotalAmount('Huisvestingskosten'));
  result.rows.push({
    post: 'Huisvestingskosten',
    key: 'huisvestingskosten',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, huisvestingMonths[i]])),
    total: huisvestingTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, huisvestingMonths[i]]))
  });
  
  // 11. Kantoorkosten (negative with -Math.abs)
  const kantoorMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Kantoorkosten')));
  const kantoorTotal = -Math.abs(getTotalAmount('Kantoorkosten'));
  result.rows.push({
    post: 'Kantoorkosten',
    key: 'kantoorkosten',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, kantoorMonths[i]])),
    total: kantoorTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, kantoorMonths[i]]))
  });
  
  // 12. Algemene kosten (negative with -Math.abs)
  const algemeneMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Algemene kosten')));
  const algemeneTotal = -Math.abs(getTotalAmount('Algemene kosten'));
  result.rows.push({
    post: 'Algemene kosten',
    key: 'algemene_kosten',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, algemeneMonths[i]])),
    total: algemeneTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, algemeneMonths[i]]))
  });
  
  // 13. EBITDA (calculated - EXACT same formula)
  const totaleKostenMonths = monthHeaders.map((month, index) => 
    huisvestingMonths[index] + kantoorMonths[index] + algemeneMonths[index]
  );
  const totaleKostenTotal = huisvestingTotal + kantoorTotal + algemeneTotal;
  const ebitdaMonths = monthHeaders.map((month, index) => 
    contributieMonths[index] + totaleKostenMonths[index]
  );
  const ebitdaTotal = contributieTotal + totaleKostenTotal;
  result.rows.push({
    post: 'EBITDA',
    key: 'ebitda',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, ebitdaMonths[i]])),
    total: ebitdaTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, ebitdaMonths[i]]))
  });
  
  // 14. Afschrijvingskosten (negative with -Math.abs)
  const afschrijvingMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Afschrijvingskosten')));
  const afschrijvingTotal = -Math.abs(getTotalAmount('Afschrijvingskosten'));
  result.rows.push({
    post: 'Afschrijvingskosten',
    key: 'afschrijvingskosten',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, afschrijvingMonths[i]])),
    total: afschrijvingTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, afschrijvingMonths[i]]))
  });
  
  // 15. Financieringskosten (negative with -Math.abs)
  const financieringMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Financieringskosten')));
  const financieringTotal = -Math.abs(getTotalAmount('Financieringskosten'));
  result.rows.push({
    post: 'Financieringskosten',
    key: 'financieringskosten',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, financieringMonths[i]])),
    total: financieringTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, financieringMonths[i]]))
  });
  
  // 16. EBIT (calculated - EXACT same formula)
  const ebitMonths = monthHeaders.map((month, index) => 
    ebitdaMonths[index] + afschrijvingMonths[index] + financieringMonths[index]
  );
  const ebitTotal = ebitdaTotal + afschrijvingTotal + financieringTotal;
  result.rows.push({
    post: 'EBIT',
    key: 'ebit',
    months: Object.fromEntries(monthHeaders.map((m, i) => [m.key, ebitMonths[i]])),
    total: ebitTotal,
    ...Object.fromEntries(monthHeaders.map((m, i) => [m.key, ebitMonths[i]]))
  });
  
  // Add all source references
  result.rows.forEach(row => {
    Object.keys(row.months).forEach(monthKey => {
      result.source_refs.push({
        category: row.post,
        month: monthKey,
        amount: row.months[monthKey],
        calculation_method: 'enhanced_pnl_exact_copy'
      });
    });
  });
  
  // Update summary
  result.rows.forEach(row => {
    result.summary[row.post] = row.total;
  });
  
  return JSON.stringify(result);
}

function handleBalanceSheetData(args, financialData) {
  const { months = [], account_types = [] } = args;
  
  // Filter monthly data by requested months
  let monthlyData = financialData.monthlyData || [];
  if (months.length > 0) {
    monthlyData = monthlyData.filter(m => {
      const monthKey = `${m.year}-${String(m.month).padStart(2, '0')}`;
      return months.includes(monthKey);
    });
  }
  
  const result = {
    period: `${financialData.originalPeriod?.startYear}-${String(financialData.originalPeriod?.startMonth || 1).padStart(2, '0')} tot ${financialData.originalPeriod?.endYear}-${String(financialData.originalPeriod?.endMonth || 12).padStart(2, '0')}`,
    assets: [], // CRITICAL: Use 'assets' format for clickable parsing
    liabilities: [], // CRITICAL: Use 'liabilities' format for clickable parsing
    equity: [], // CRITICAL: Use 'equity' format for clickable parsing
    source_refs: [] // CRITICAL: Add source references for drill-down
  };
  
  // Collect all unique account types from all months
  const allAccountTypes = new Set();
  monthlyData.forEach(monthData => {
    if (monthData.accountTypeBreakdown) {
      Object.keys(monthData.accountTypeBreakdown).forEach(accountType => {
        if (account_types.length === 0 || account_types.includes(accountType)) {
          allAccountTypes.add(accountType);
        }
      });
    }
  });
  
  // Create balance sheet entries in the format expected by the parsing logic
  allAccountTypes.forEach(accountType => {
    const entry = {
      post: accountType, // CRITICAL: Use 'post' field for category recognition
      key: accountType,  // CRITICAL: Use 'key' field as backup
      months: {}
    };
    
    // Add monthly data
    monthlyData.forEach(monthData => {
      const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
      const accountData = monthData.accountTypeBreakdown?.[accountType];
      
      if (accountData) {
        entry.months[monthKey] = accountData.netAmount;
        entry[monthKey] = accountData.netAmount; // CRITICAL: Also add direct month access
        
        // Add source reference for drill-down functionality
        result.source_refs.push({
          account_type: accountType,
          month: monthKey,
          amount: accountData.netAmount,
          debet: accountData.totalDebet,
          credit: accountData.totalCredit
        });
      }
    });
    
    // Calculate total for this account type
    const total = Object.values(entry.months).reduce((sum, val) => sum + val, 0);
    entry.total = total;
    
    // Categorize into assets, liabilities, or equity based on account type
    const lowerAccountType = accountType.toLowerCase();
    if (lowerAccountType.includes('activa')) {
      result.assets.push(entry);
    } else if (lowerAccountType.includes('passiva')) {
      result.liabilities.push(entry);
    } else if (lowerAccountType.includes('eigen') || lowerAccountType.includes('vermogen')) {
      result.equity.push(entry);
    } else {
      // Default to assets for unknown types
      result.assets.push(entry);
    }
  });
  
  return JSON.stringify(result);
}

function handleCashFlowData(args, financialData) {
  const { months = [] } = args;
  
  // Use extended data for calculations but only return requested months
  let monthlyData = financialData.monthlyData || [];
  let displayMonths = monthlyData;
  
  if (months.length > 0) {
    displayMonths = monthlyData.filter(m => {
      const monthKey = `${m.year}-${String(m.month).padStart(2, '0')}`;
      return months.includes(monthKey);
    });
  }
  
  // Get category mappings from financialData
  const categoryMappings = financialData.categoryMappings || [];
  const mappingLookup = categoryMappings.reduce((acc, mapping) => {
    acc[mapping.category_3] = mapping.mapped_category;
    return acc;
  }, {});
  
  // CRITICAL: Use EXACT same calculation logic as KasstroomOverzicht.jsx
  const getMappedAmountForMonth = (monthKey, mappedCategory) => {
    const monthData = monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    if (!monthData) return 0;
    
    const categoryRecords = monthData.records?.filter(r => {
      const category3 = r.Omschrijving_3 || 'Overig';
      return mappingLookup[category3] === mappedCategory;
    }) || [];
    
    return categoryRecords.reduce((sum, r) => {
      if (mappedCategory === 'Omzet' || mappedCategory === 'Provisies') {
        return sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0));
      } else {
        return sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0));
      }
    }, 0);
  };
  
  const getBalanceAmountForMonth = (monthKey, typeRekening, filterFunc = null) => {
    const monthData = monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    if (!monthData) return 0;
    
    let records = monthData.records?.filter(r => r.Type_rekening === typeRekening) || [];
    
    if (filterFunc) {
      records = records.filter(filterFunc);
    }
    
    return records.reduce((sum, r) => sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)), 0);
  };
  
  const getPreviousMonthKey = (monthKey) => {
    const [year, month] = monthKey.split('-').map(x => parseInt(x));
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const prevMonthExists = monthlyData.some(m => `${m.year}-${String(m.month).padStart(2, '0')}` === prevMonthKey);
    return prevMonthExists ? prevMonthKey : null;
  };
  
  const result = {
    period: `${financialData.originalPeriod?.startYear}-${String(financialData.originalPeriod?.startMonth || 1).padStart(2, '0')} tot ${financialData.originalPeriod?.endYear}-${String(financialData.originalPeriod?.endMonth || 12).padStart(2, '0')}`,
    rows: [], // CRITICAL: Use 'rows' format for clickable parsing
    source_refs: [] // CRITICAL: Add source references for drill-down
  };
  
  // EXACT SAME CALCULATIONS AS KasstroomOverzicht.jsx
  
  // 1. Resultaat na belasting
  const resultaatRow = { post: 'Resultaat na belasting', key: 'resultaat_na_belasting', months: {} };
  displayMonths.forEach(monthData => {
    const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
    
    // EXACT same calculation as in KasstroomOverzicht
    const omzet = getMappedAmountForMonth(monthKey, 'Omzet');
    const inkoop = -Math.abs(getMappedAmountForMonth(monthKey, 'Inkoopwaarde omzet'));
    const provisies = -Math.abs(getMappedAmountForMonth(monthKey, 'Provisies'));
    const personeelDirect = -Math.abs(getMappedAmountForMonth(monthKey, 'Personeelskosten direct'));
    const marge = omzet + inkoop + provisies + personeelDirect;
    
    const auto = -Math.abs(getMappedAmountForMonth(monthKey, 'Autokosten'));
    const marketing = -Math.abs(getMappedAmountForMonth(monthKey, 'Marketingkosten'));
    const personeelOp = -Math.abs(getMappedAmountForMonth(monthKey, 'Operationele personeelskosten'));
    const contributie = marge + auto + marketing + personeelOp;
    
    const huisvesting = -Math.abs(getMappedAmountForMonth(monthKey, 'Huisvestingskosten'));
    const kantoor = -Math.abs(getMappedAmountForMonth(monthKey, 'Kantoorkosten'));
    const algemeen = -Math.abs(getMappedAmountForMonth(monthKey, 'Algemene kosten'));
    const ebitda = contributie + huisvesting + kantoor + algemeen;
    
    const afschrijving = -Math.abs(getMappedAmountForMonth(monthKey, 'Afschrijvingskosten'));
    const financiering = -Math.abs(getMappedAmountForMonth(monthKey, 'Financieringskosten'));
    const ebit = ebitda + afschrijving + financiering;
    
    const vpb = ebit > 0 ? -(ebit * 0.23) : 0;
    const resultaat = ebit + vpb;
    
    resultaatRow.months[monthKey] = resultaat;
    resultaatRow[monthKey] = resultaat;
  });
  resultaatRow.total = Object.values(resultaatRow.months).reduce((sum, val) => sum + val, 0);
  result.rows.push(resultaatRow);
  
  // 2. Belastingen
  const belastingRow = { post: 'Belastingen', key: 'belastingen', months: {} };
  displayMonths.forEach(monthData => {
    const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
    
    // Same EBIT calculation as above
    const omzet = getMappedAmountForMonth(monthKey, 'Omzet');
    const inkoop = -Math.abs(getMappedAmountForMonth(monthKey, 'Inkoopwaarde omzet'));
    const provisies = -Math.abs(getMappedAmountForMonth(monthKey, 'Provisies'));
    const personeelDirect = -Math.abs(getMappedAmountForMonth(monthKey, 'Personeelskosten direct'));
    const marge = omzet + inkoop + provisies + personeelDirect;
    
    const auto = -Math.abs(getMappedAmountForMonth(monthKey, 'Autokosten'));
    const marketing = -Math.abs(getMappedAmountForMonth(monthKey, 'Marketingkosten'));
    const personeelOp = -Math.abs(getMappedAmountForMonth(monthKey, 'Operationele personeelskosten'));
    const contributie = marge + auto + marketing + personeelOp;
    
    const huisvesting = -Math.abs(getMappedAmountForMonth(monthKey, 'Huisvestingskosten'));
    const kantoor = -Math.abs(getMappedAmountForMonth(monthKey, 'Kantoorkosten'));
    const algemeen = -Math.abs(getMappedAmountForMonth(monthKey, 'Algemene kosten'));
    const ebitda = contributie + huisvesting + kantoor + algemeen;
    
    const afschrijving = -Math.abs(getMappedAmountForMonth(monthKey, 'Afschrijvingskosten'));
    const financiering = -Math.abs(getMappedAmountForMonth(monthKey, 'Financieringskosten'));
    const ebit = ebitda + afschrijving + financiering;
    
    const belasting = ebit > 0 ? (ebit * 0.23) : 0; // Positief maken
    
    belastingRow.months[monthKey] = belasting;
    belastingRow[monthKey] = belasting;
  });
  belastingRow.total = Object.values(belastingRow.months).reduce((sum, val) => sum + val, 0);
  result.rows.push(belastingRow);
  
  // 3. Afschrijvingen
  const afschrijvingRow = { post: 'Afschrijvingen', key: 'afschrijvingen', months: {} };
  displayMonths.forEach(monthData => {
    const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
    const afschrijving = Math.abs(getMappedAmountForMonth(monthKey, 'Afschrijvingskosten'));
    
    afschrijvingRow.months[monthKey] = afschrijving;
    afschrijvingRow[monthKey] = afschrijving;
  });
  afschrijvingRow.total = Object.values(afschrijvingRow.months).reduce((sum, val) => sum + val, 0);
  result.rows.push(afschrijvingRow);
  
  // 4. Mutatie netto werkkapitaal
  const mutatieWerkkapitaalRow = { post: 'Mutatie netto werkkapitaal', key: 'mutatie_werkkapitaal', months: {} };
  displayMonths.forEach(monthData => {
    const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
    const previousMonth = getPreviousMonthKey(monthKey);
    let mutatie = 0;
    
    if (previousMonth) {
      // Activa (exclusief liquid en vaste activa)
      const activaHuidige = getBalanceAmountForMonth(monthKey, 'Activa', (r) => {
        const cat3 = (r.Omschrijving_3 || '').toLowerCase();
        return !cat3.includes('liquid') && !cat3.includes('vaste activa');
      });
      
      const activaVorige = getBalanceAmountForMonth(previousMonth, 'Activa', (r) => {
        const cat3 = (r.Omschrijving_3 || '').toLowerCase();
        return !cat3.includes('liquid') && !cat3.includes('vaste activa');
      });
      
      // Passiva (exclusief eigen vermogen)
      const passivaHuidige = getBalanceAmountForMonth(monthKey, 'Passiva', (r) => {
        const cat3 = (r.Omschrijving_3 || '').toLowerCase();
        return !cat3.includes('eigen vermogen');
      });
      
      const passivaVorige = getBalanceAmountForMonth(previousMonth, 'Passiva', (r) => {
        const cat3 = (r.Omschrijving_3 || '').toLowerCase();
        return !cat3.includes('eigen vermogen');
      });
      
      mutatie = -((activaHuidige - activaVorige) - (passivaHuidige - passivaVorige));
    }
    
    mutatieWerkkapitaalRow.months[monthKey] = mutatie;
    mutatieWerkkapitaalRow[monthKey] = mutatie;
  });
  mutatieWerkkapitaalRow.total = Object.values(mutatieWerkkapitaalRow.months).reduce((sum, val) => sum + val, 0);
  result.rows.push(mutatieWerkkapitaalRow);
  
  // 5. Operationele kasstroom (berekend)
  const operationeleKasstroomRow = { post: 'Operationele kasstroom', key: 'operationele_kasstroom', months: {} };
  displayMonths.forEach(monthData => {
    const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
    
    const resultaat = resultaatRow.months[monthKey] || 0;
    const belasting = belastingRow.months[monthKey] || 0;
    const afschrijving = afschrijvingRow.months[monthKey] || 0;
    const mutatieWerkkapitaal = mutatieWerkkapitaalRow.months[monthKey] || 0;
    
    const operationeleKasstroom = resultaat + belasting + afschrijving + mutatieWerkkapitaal;
    
    operationeleKasstroomRow.months[monthKey] = operationeleKasstroom;
    operationeleKasstroomRow[monthKey] = operationeleKasstroom;
    
    // Add source reference
    result.source_refs.push({
      type: 'operationele_kasstroom',
      month: monthKey,
      amount: operationeleKasstroom,
      components: {
        resultaat,
        belasting,
        afschrijving,
        mutatieWerkkapitaal
      }
    });
  });
  operationeleKasstroomRow.total = Object.values(operationeleKasstroomRow.months).reduce((sum, val) => sum + val, 0);
  result.rows.push(operationeleKasstroomRow);
  
  return JSON.stringify(result);
}

// Helper function to calculate data size in bytes
function calculateDataSize(obj) {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

// Helper function to format bytes to human readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}



export async function POST(request) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [${requestId}] AI Chat Request Started`);
    
    const requestBody = await request.json();
    const { messages = [], period_from, period_to, financialData, financialCacheId, categoryMappings, baseUrl, currentDate, currentTime } = requestBody;
    
    // Get financial data from cache if cache ID is provided
    let actualFinancialData = financialData;
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (financialCacheId && !financialData) {
      console.log(`🔍 [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Retrieving cached financial data: ${financialCacheId}`);
      
      try {
        // Import Supabase for server-side usage
        const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs');
        const { cookies } = await import('next/headers');
        const supabase = createRouteHandlerClient({ cookies });
        
        // Get cached data with detailed logging
        console.log(`🔍 [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Executing cache query...`);
        const { data: cachedData, error } = await supabase
          .from('financial_cache')
          .select('data, data_size, user_id, created_at, expires_at')
          .eq('id', financialCacheId)
          .gt('expires_at', new Date().toISOString())
          .single();
        
        if (error) {
          console.error(`❌ [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Cache lookup failed:`, error.message);
          console.error(`❌ [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Cache error details:`, {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          
          // In production, try alternative approaches
          if (isProduction) {
            console.log(`🔄 [${requestId}] [PROD] Trying cache lookup without expiry check...`);
            const { data: fallbackCache, error: fallbackError } = await supabase
              .from('financial_cache')
              .select('data, data_size, created_at, expires_at')
              .eq('id', financialCacheId)
              .single();
            
            if (fallbackCache) {
              console.log(`🔍 [${requestId}] [PROD] Found cache entry (expires: ${fallbackCache.expires_at})`);
              const isExpired = new Date(fallbackCache.expires_at) < new Date();
              if (!isExpired) {
                actualFinancialData = fallbackCache.data;
                console.log(`✅ [${requestId}] [PROD] Using fallback cache: ${formatBytes(fallbackCache.data_size || 0)}`);
              } else {
                console.log(`⏰ [${requestId}] [PROD] Cache expired: ${fallbackCache.expires_at}`);
              }
            } else {
              console.log(`❌ [${requestId}] [PROD] No cache entry found at all`);
            }
          }
        } else if (cachedData) {
          actualFinancialData = cachedData.data;
          console.log(`✅ [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Cache hit! Retrieved ${formatBytes(cachedData.data_size || 0)} from cache`);
          console.log(`📊 [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Cache metadata:`, {
            user_id: cachedData.user_id?.substring(0, 8) + '...',
            created_at: cachedData.created_at,
            expires_at: cachedData.expires_at
          });
          
          // Skip hit count update for now (not critical for functionality)
        } else {
          console.log(`❌ [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Cache miss for ID: ${financialCacheId}`);
        }
      } catch (cacheError) {
        console.error(`💥 [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Cache retrieval error:`, cacheError);
        console.error(`💥 [${requestId}] [${isProduction ? 'PROD' : 'DEV'}] Cache error stack:`, cacheError.stack);
      }
    }
    
    // Calculate incoming request data size
    const requestDataSize = calculateDataSize(requestBody);
    const actualFinancialDataSize = actualFinancialData ? calculateDataSize(actualFinancialData) : 0;
    const categoryMappingsSize = categoryMappings ? calculateDataSize(categoryMappings) : 0;
    const messagesSize = calculateDataSize(messages);
    
    console.log(`📨 [${requestId}] Request Data Size Analysis:`, {
      totalRequestSize: formatBytes(requestDataSize),
      actualFinancialDataSize: formatBytes(actualFinancialDataSize),
      categoryMappingsSize: formatBytes(categoryMappingsSize),
      messagesSize: formatBytes(messagesSize),
      messageCount: messages.length,
      period_from,
      period_to,
      hasFinancialData: !!actualFinancialData,
      financialDataMonths: actualFinancialData?.monthlyData?.length || 0,
      categoryMappingsCount: categoryMappings?.length || 0,
      cacheUsed: !!financialCacheId,
      cacheId: financialCacheId || 'none',
      userMessage: messages[messages.length - 1]?.content?.substring(0, 100) + '...'
    });
    
    setToolsBaseUrl(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });

    // Get tools in Gemini format and add context-aware tools
    const tools = getToolsForGemini();
    
    // Add enhanced financial data tools if data is available
    if (actualFinancialData && categoryMappings) {
      tools.push({
        name: 'get_enhanced_pnl_data',
        description: 'Haal Enhanced P&L data op gebaseerd op category mappings voor specifieke maanden',
        parameters: {
          type: 'OBJECT',
          properties: {
            months: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Array van maanden in YYYY-MM formaat, of leeglaten voor alle beschikbare maanden'
            },
            categories: {
              type: 'ARRAY', 
              items: { type: 'STRING' },
              description: 'Specifieke Enhanced P&L categorieën om op te halen, of leeglaten voor alle'
            }
          }
        }
      });
      
      tools.push({
        name: 'get_balance_sheet_data',
        description: 'Haal balans data op voor specifieke maanden',
        parameters: {
          type: 'OBJECT',
          properties: {
            months: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Array van maanden in YYYY-MM formaat, of leeglaten voor alle beschikbare maanden'
            },
            account_types: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Account types: Activa, Passiva, of leeglaten voor beide'
            }
          }
        }
      });
      
      tools.push({
        name: 'get_cash_flow_data',
        description: 'Haal kasstroom data op inclusief mutaties tussen maanden',
        parameters: {
          type: 'OBJECT',
          properties: {
            months: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Array van maanden in YYYY-MM formaat, of leeglaten voor alle beschikbare maanden'
            }
          }
        }
      });
    }
    
    console.log(`🔧 [${requestId}] Loaded ${tools.length} financial tools (${actualFinancialData ? 'with enhanced data tools' : 'standard tools only'})`);
    
    // Prepare system message and conversation
    const systemText = `Je bent een financiële AI assistent. Gebruik ALLEEN de beschikbare tools voor berekeningen. Geef directe, concrete antwoorden zonder bronverwijzingen.

HUIDIGE CONTEXT:
- Huidige datum: ${currentDate || 'Onbekend'}
- Huidige tijd: ${currentTime || 'Onbekend'}
- Periode: ${period_from || 'Onbekend'} tot ${period_to || 'Onbekend'}
${actualFinancialData ? `- Enhanced P&L data beschikbaar: ${actualFinancialData.monthlyData?.length || 0} maanden` : ''}
${categoryMappings ? `- Category mappings beschikbaar: ${categoryMappings.length || 0} mappings` : ''}
${financialCacheId ? `- Data retrieved from cache: ${financialCacheId}` : ''}

BESCHIKBARE DATA TOOLS:
${actualFinancialData && categoryMappings ? `
- get_enhanced_pnl_data: Voor Enhanced P&L categorieën per maand
- get_balance_sheet_data: Voor balans data (Activa/Passiva) per maand  
- get_cash_flow_data: Voor kasstroom data inclusief mutaties tussen maanden
- Gebruik deze tools EERST voor snelle toegang tot de enhanced data

ENHANCED P&L CATEGORIEËN (gebruik deze EXACTE namen voor klikbare bedragen):
- Omzet (positief)
- Inkoopwaarde omzet (negatief)
- Provisies (negatief)  
- Personeelskosten direct (negatief)
- Marge (berekend: Omzet + Inkoop + Provisies + Personeel direct)
- Autokosten (negatief)
- Marketingkosten (negatief)
- Operationele personeelskosten (negatief)
- Contributiemarge (berekend: Marge + Auto + Marketing + Operationeel personeel)
- Huisvestingskosten (negatief)
- Kantoorkosten (negatief)
- Algemene kosten (negatief)
- EBITDA (berekend: Contributiemarge + Vaste kosten)
- Afschrijvingskosten (negatief)
- Financieringskosten (negatief)
- EBIT (berekend: EBITDA + Afschrijvingen + Financiering)

KRITIEK: Deze data is nu EXACT 1-op-1 hetzelfde als de Enhanced P&L tab!
` : ''}
- Standaard AFAS tools zijn ook beschikbaar voor diepere analyse

KRITIEKE FORMATTERING VOOR KLIKBARE BEDRAGEN:
- Presenteer bedragen EXACT in dit formaat: "Categorienaam: €X.XXX"
- Gebruik EXACT de categorienamen uit de Enhanced P&L data (bijv. "Omzet", "Autokosten", "Huisvestingskosten")
- Gebruik Nederlandse valutering (€) met punten als duizendtalscheidingsteken
- VOORBEELDEN van correcte formatting:
  * "Omzet: €125.000" (NIET "Netto-omzet" of "Revenue")
  * "Autokosten: €15.500" (NIET "Auto kosten" of "Transport costs")
  * "Huisvestingskosten: €8.200" (NIET "Huur" of "Housing costs")
- Dit is KRITIEK voor klikbare functionaliteit - gebruik exact de namen uit de tool results!

KRITIEKE WERKWIJZE:
- Begin ALTIJD met enhanced data tools als beschikbaar voor snelle overzichten
- Voor specifieke vragen over transacties, gebruik get_transaction_details
- Als user beweert "meer in periode X dan Y" - controleer dit EERST in de data
- GELOOF de user en zoek uit waarom de verschillen bestaan
- Geef concrete details: datum, type transactie, rekeningen, wat het betekent
- Zeg NOOIT "zonder verdere details" - haal altijd alle details op`;
    const periodHint = (period_from && period_to) ? `\nDefault period_from=${period_from}, period_to=${period_to}` : '';
    
    // Build conversation context with full message history
    const conversationContext = messages.map((msg, index) => {
      const role = msg.role === 'assistant' ? 'AI' : 'User';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
    
    console.log(`💬 [${requestId}] Conversation context:`, {
      totalMessages: messages.length,
      messageRoles: messages.map(m => m.role),
      conversationPreview: conversationContext.substring(0, 200) + '...'
    });
    
    const userMessage = messages[messages.length - 1]?.content || '';
    const prompt = `${systemText}${periodHint}\n\nConversatie geschiedenis:\n${conversationContext}\n\nBeantwoord de laatste vraag van de gebruiker in de context van de hele conversatie.`;
    console.log(`📝 [${requestId}] Prepared prompt with ${messages.length} messages (${prompt.length} chars)`);
    
    const toolResults = {};
    const maxHops = 6;
    
    // Track total data transferred to/from Gemini across all hops
    let totalGeminiRequestSize = 0;
    let totalGeminiResponseSize = 0;
    
    // Calculate data being sent to Gemini
    const geminiRequestPayload = {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.1,
        }
      }
    };
    const geminiRequestSize = calculateDataSize(geminiRequestPayload);
    const promptSize = calculateDataSize(prompt);
    const toolsSize = calculateDataSize(tools);
    
    console.log(`🤖 [${requestId}] Sending initial request to Gemini...`);
    console.log(`📊 [${requestId}] Gemini Request Size Analysis:`, {
      totalGeminiRequestSize: formatBytes(geminiRequestSize),
      promptSize: formatBytes(promptSize),
      toolsSize: formatBytes(toolsSize),
      toolsCount: tools.length,
      promptLength: prompt.length
    });
    
    let response = await ai.models.generateContent(geminiRequestPayload);
    
    // Calculate response size and add to totals
    const responseSize = calculateDataSize(response);
    totalGeminiRequestSize += geminiRequestSize;
    totalGeminiResponseSize += responseSize;
    
    console.log(`✅ [${requestId}] Gemini response received - Size: ${formatBytes(responseSize)}`);
    console.log(`🔍 [${requestId}] Function calls detected:`, response.functionCalls?.length || 0);
    
    for (let hop = 0; hop < maxHops; hop++) {
      console.log(`🔄 [${requestId}] Processing hop ${hop + 1}/${maxHops}`);
      
      // Check if there are function calls
      if (!response.functionCalls || response.functionCalls.length === 0) {
        // No more function calls, return the text response
        const answer = response.text || 'Kon geen definitief antwoord genereren.';
        const totalTime = Date.now() - startTime;
        
        // Create data statistics object
        const dataTransferStats = {
          requestSize: requestDataSize,
          geminiRequestSize: totalGeminiRequestSize,
          geminiResponseSize: totalGeminiResponseSize,
          totalGeminiData: totalGeminiRequestSize + totalGeminiResponseSize,
          toolsExecuted: Object.keys(toolResults).length,
          responseTime: totalTime,
          actualFinancialDataSize: actualFinancialDataSize,
          categoryMappingsSize: categoryMappingsSize,
          messagesSize: messagesSize,
          cacheUsed: !!financialCacheId,
          cacheId: financialCacheId || null
        };
        
        const responsePayload = { answer, toolResults, dataStats: dataTransferStats };
        const finalResponseSize = calculateDataSize(responsePayload);
        dataTransferStats.finalResponseSize = finalResponseSize;
        
        console.log(`✅ [${requestId}] Request completed in ${totalTime}ms`);
        console.log(`📊 [${requestId}] TOTAL DATA TRANSFER SUMMARY:`);
        console.log(`   📤 Total sent to Gemini: ${formatBytes(totalGeminiRequestSize)}`);
        console.log(`   📥 Total received from Gemini: ${formatBytes(totalGeminiResponseSize)}`);
        console.log(`   🔄 Total Gemini API data: ${formatBytes(totalGeminiRequestSize + totalGeminiResponseSize)}`);
        console.log(`   📨 Original request size: ${formatBytes(requestDataSize)}`);
        console.log(`   📤 Final response size: ${formatBytes(finalResponseSize)}`);
        console.log(`   🎯 Tool results: ${Object.keys(toolResults).length} tools executed`);
        
        return new Response(JSON.stringify(responsePayload), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Execute function calls
      console.log(`🛠️  [${requestId}] Executing ${response.functionCalls.length} function calls:`, 
        response.functionCalls.map(call => call.name));
      
      const functionResults = await Promise.all(
        response.functionCalls.map(async (call, index) => {
          const callStart = Date.now();
          console.log(`🔧 [${requestId}] Tool ${index + 1}: ${call.name} - Starting...`);
          console.log(`📋 [${requestId}] Tool ${index + 1}: Args:`, call.args);
          
          try {
            // Adapt Gemini function call to our format
            let output;
            
            // Handle enhanced data tools locally
            if (call.name === 'get_enhanced_pnl_data' && actualFinancialData) {
              output = handleEnhancedPnLData(call.args || {}, actualFinancialData);
            } else if (call.name === 'get_balance_sheet_data' && actualFinancialData) {
              output = handleBalanceSheetData(call.args || {}, actualFinancialData);
            } else if (call.name === 'get_cash_flow_data' && actualFinancialData) {
              output = handleCashFlowData(call.args || {}, actualFinancialData);
            } else {
              // Use existing tool execution for standard tools
              const adapted = {
                id: call.name,
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.args || {})
                }
              };
              output = await executeToolCall(adapted);
            }
            
            toolResults[call.name] = output;
            
            const callTime = Date.now() - callStart;
            const parsedOutput = JSON.parse(output);
            console.log(`✅ [${requestId}] Tool ${index + 1}: ${call.name} completed in ${callTime}ms`);
            console.log(`📊 [${requestId}] Tool ${index + 1}: Result summary:`, {
              hasRows: !!parsedOutput.rows,
              rowCount: parsedOutput.rows?.length || 0,
              hasTotals: !!parsedOutput.totals,
              hasSourceRefs: !!parsedOutput.source_refs,
              sourceRefCount: parsedOutput.source_refs?.length || 0,
              outputLength: output.length
            });
            
            return {
              name: call.name,
              output: output
            };
          } catch (err) {
            const callTime = Date.now() - callStart;
            console.error(`❌ [${requestId}] Tool ${index + 1}: ${call.name} failed after ${callTime}ms:`, err.message);
            return {
              name: call.name,
              output: `Error: ${String(err)}`
            };
          }
        })
      );
      
      console.log(`🏁 [${requestId}] All function calls completed`);

      // Create follow-up prompt with function results
      const resultsText = functionResults.map(fr => 
        `Function ${fr.name} result: ${fr.output}`
      ).join('\n\n');
      
      const followUpPrompt = `${systemText}${periodHint}

Conversatie geschiedenis:
${conversationContext}

Function call resultaten:
${resultsText}

Geef een uitgebreide analyse en beantwoord de laatste vraag van de gebruiker. Gebruik de function resultaten en houd rekening met de volledige conversatie context.

BELANGRIJK bij analyse:
- Valideer EERST wat user beweert met concrete cijfers uit de data
- Gebruik EXACT de categorienamen uit de tool results voor klikbare bedragen
- Format alle bedragen als "Exacte Categorienaam: €X.XXX"
- Voor ELKE boekstuknummer in de resultaten: gebruik get_transaction_details
- Leg uit wat elke transactie precies doet en waarom het verschil veroorzaakt
- Geef volledige context: datum, type, rekeningen, bedragen, betekenis
- KRITIEK: Bedragen zijn alleen klikbaar met exacte categorienamen uit de data!`;
      console.log(`📝 [${requestId}] Prepared follow-up prompt with context (${followUpPrompt.length} chars)`);
      
      // Continue conversation with function results
      const followUpPayload = {
        model: 'gemini-2.5-flash',
        contents: followUpPrompt,
        config: {
          tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.1,
          }
        }
      };
      const followUpRequestSize = calculateDataSize(followUpPayload);
      const followUpPromptSize = calculateDataSize(followUpPrompt);
      
      console.log(`🤖 [${requestId}] Sending follow-up request to Gemini...`);
      console.log(`📊 [${requestId}] Follow-up Request Size: ${formatBytes(followUpRequestSize)} (prompt: ${formatBytes(followUpPromptSize)})`);
      
      response = await ai.models.generateContent(followUpPayload);
      
      const followUpResponseSize = calculateDataSize(response);
      totalGeminiRequestSize += followUpRequestSize;
      totalGeminiResponseSize += followUpResponseSize;
      
      console.log(`✅ [${requestId}] Follow-up response received - Size: ${formatBytes(followUpResponseSize)}`);
      console.log(`🔍 [${requestId}] Additional function calls:`, response.functionCalls?.length || 0);
    }

    // Safety fallback
    console.log(`⚠️  [${requestId}] Reached max hops (${maxHops}) - returning current response`);
    const answer = response.text || 'Kon geen definitief antwoord genereren.';
    const totalTime = Date.now() - startTime;
    
    // Create data statistics object for fallback
    const dataTransferStats = {
      requestSize: requestDataSize,
      geminiRequestSize: totalGeminiRequestSize,
      geminiResponseSize: totalGeminiResponseSize,
      totalGeminiData: totalGeminiRequestSize + totalGeminiResponseSize,
      toolsExecuted: Object.keys(toolResults).length,
      responseTime: totalTime,
      actualFinancialDataSize: actualFinancialDataSize,
      categoryMappingsSize: categoryMappingsSize,
      messagesSize: messagesSize,
      cacheUsed: !!financialCacheId,
      cacheId: financialCacheId || null
    };
    
    const responsePayload = { answer, toolResults, dataStats: dataTransferStats };
    const finalResponseSize = calculateDataSize(responsePayload);
    dataTransferStats.finalResponseSize = finalResponseSize;
    
    console.log(`✅ [${requestId}] Request completed with fallback in ${totalTime}ms`);
    console.log(`📊 [${requestId}] TOTAL DATA TRANSFER SUMMARY (FALLBACK):`);
    console.log(`   📤 Total sent to Gemini: ${formatBytes(totalGeminiRequestSize)}`);
    console.log(`   📥 Total received from Gemini: ${formatBytes(totalGeminiResponseSize)}`);
    console.log(`   🔄 Total Gemini API data: ${formatBytes(totalGeminiRequestSize + totalGeminiResponseSize)}`);
    console.log(`   📨 Original request size: ${formatBytes(requestDataSize)}`);
    console.log(`   📤 Final response size: ${formatBytes(finalResponseSize)}`);
    console.log(`   🎯 Tool results: ${Object.keys(toolResults).length} tools executed`);
    
    return new Response(JSON.stringify(responsePayload), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${requestId}] AI chat route error after ${totalTime}ms:`, error.message);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      message: error.message,
      requestId: requestId
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
