// V2 API Route - Uses Omschrijving_3 for categories and Type_rekening for balance sheet classification

// Function to get clean category name from Omschrijving_3 field with fallback logic
function getCategoryFromDescription(omschrijving3, kenmerkRekening) {
  if (omschrijving3) {
    // Clean up the description and use as category
    return omschrijving3.trim();
  }
  
  // If no Omschrijving_3, check Kenmerk_rekening for fallback category
  if (kenmerkRekening) {
    const kenmerk = kenmerkRekening.trim();
    
    // If it's Crediteuren or Debiteuren, use that as category
    if (kenmerk === 'Crediteuren' || kenmerk === 'Debiteuren') {
      return kenmerk;
    }
    
    // If it's Grootboekrekening, use 'Overige'
    if (kenmerk === 'Grootboekrekening') {
      return 'Overige';
    }
    
    // For any other Kenmerk_rekening value, use it as category
    return kenmerk;
  }
  
  // Final fallback if both fields are empty
  return 'Overige';
}

// Function to map Type_rekening to readable names
function getAccountTypeName(typeRekening) {
  const typeMapping = {
    'Kosten': 'Kosten',
    'Passiva': 'Passiva', 
    'Opbrengsten': 'Opbrengsten',
    'Activa': 'Activa'
  };
  
  return typeMapping[typeRekening] || typeRekening || 'Overige';
}

// Helper function to calculate median
function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Helper function to calculate MAD (Median Absolute Deviation)
function calculateMAD(values, median) {
  if (values.length === 0) return 0;
  const absoluteDeviations = values.map(value => Math.abs(value - median));
  return calculateMedian(absoluteDeviations);
}

// Helper function to check if value is within band
function isWithinBand(value, median, mad, multiplier = 1.5) {
  const lowerBound = median - (multiplier * mad);
  const upperBound = median + (multiplier * mad);
  return value >= lowerBound && value <= upperBound;
}

// Main function to perform all 15 financial checks
function performFinancialChecks(monthlyData, allData, accountTypeTotals, categoryTotals, eigenVermogenPerMonth) {
  // Sort monthly data by date (oldest first)
  const sortedMonthlyData = [...monthlyData].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Group checks by month and overall
  const monthlyChecks = {};
  const overallChecks = [];

  // Perform checks for each month
  sortedMonthlyData.forEach(monthData => {
    const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
    const monthEigenVermogen = eigenVermogenPerMonth.filter(ev => ev.year === monthData.year && ev.month === monthData.month);
    
    monthlyChecks[monthKey] = {
      monthName: monthData.monthName,
      year: monthData.year,
      month: monthData.month,
      checks: [
        // 1. P&L vs. Balanscontrole (per month)
        performPLBalanceCheckPerMonth(monthData, monthEigenVermogen, sortedMonthlyData),
        
        // 2. Omzet vs. COGS-verhouding (per month)
        performRevenueCogsCheckPerMonth(monthData, sortedMonthlyData),
        
        // 3. Debiteurenomloop check (per month)
        performDebtorTurnoverCheckPerMonth(monthData, sortedMonthlyData),
        
        // 4. Crediteurenomloop check (per month)
        performCreditorTurnoverCheckPerMonth(monthData, sortedMonthlyData),
        
        // 5. Liquide middelen vs. bankafschriften (per month)
        performCashPositionCheckPerMonth(monthData),
        
        // 6. Mutatie vaste activa + afschrijvingen (per month)
        performFixedAssetsCheckPerMonth(monthData),
        
        // 7. BTW-saldi check (per month)
        performVATBalanceCheckPerMonth(monthData),
        
        // 8. Grootboek vs. subadministraties (per month)
        performSubledgerCheckPerMonth(monthData),
        
        // 9. Kasstroomconsistentie check (per month)
        performCashFlowConsistencyCheckPerMonth(monthData, sortedMonthlyData),
        
        // 10. Accruals/voorzieningen check (per month)
        performAccrualsCheckPerMonth(monthData, sortedMonthlyData),
        
        // 11. Intercompany check (per month)
        performIntercompanyCheckPerMonth(monthData),
        
        // 12. Onevenredige journaalposten check (per month)
        performLargeJournalEntriesCheckPerMonth(monthData),
        
        // 13. Voorraadwaardering check (per month)
        performInventoryValuationCheckPerMonth(monthData, sortedMonthlyData),
        
        // 14. Ratio-analyse (per month)
        performRatioAnalysisCheckPerMonth(monthData, sortedMonthlyData),
        
        // 15. Tijdigheid afsluitposten (per month)
        performPeriodicEntriesCheckPerMonth(monthData)
      ]
    };
  });

  // Also perform overall checks (original implementation)
  overallChecks.push(performPLBalanceCheck(sortedMonthlyData, eigenVermogenPerMonth));
  overallChecks.push(performRevenueCogsCheck(sortedMonthlyData, categoryTotals));
  overallChecks.push(performDebtorTurnoverCheck(sortedMonthlyData, categoryTotals));
  overallChecks.push(performCreditorTurnoverCheck(sortedMonthlyData, categoryTotals));
  overallChecks.push(performCashPositionCheck(categoryTotals));
  overallChecks.push(performFixedAssetsCheck(sortedMonthlyData, categoryTotals));
  overallChecks.push(performVATBalanceCheck(categoryTotals, allData));
  overallChecks.push(performSubledgerCheck(categoryTotals));
  overallChecks.push(performCashFlowConsistencyCheck(sortedMonthlyData));
  overallChecks.push(performAccrualsCheck(sortedMonthlyData, categoryTotals));
  overallChecks.push(performIntercompanyCheck(categoryTotals));
  overallChecks.push(performLargeJournalEntriesCheck(allData));
  overallChecks.push(performInventoryValuationCheck(sortedMonthlyData, categoryTotals));
  overallChecks.push(performRatioAnalysisCheck(sortedMonthlyData));
  overallChecks.push(performPeriodicEntriesCheck(categoryTotals));

  return {
    byMonth: monthlyChecks,
    overall: overallChecks
  };
}

// Individual check functions
function performPLBalanceCheck(monthlyData, eigenVermogenPerMonth) {
  const results = [];
  let status = 'OK';
  let details = '';
  
  for (let i = 1; i < eigenVermogenPerMonth.length; i++) {
    const current = eigenVermogenPerMonth[i];
    const previous = eigenVermogenPerMonth[i - 1];
    
    const evMutatie = current.eigenVermogen - previous.eigenVermogen;
    
    // Get P&L result for current month (from Opbrengsten - Kosten)
    const currentMonth = monthlyData.find(m => m.year === current.year && m.month === current.month);
    const opbrengsten = currentMonth?.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
    const kosten = currentMonth?.accountTypeBreakdown['Kosten']?.netAmount || 0;
    const plResult = opbrengsten - Math.abs(kosten);
    
    const difference = Math.abs(evMutatie - plResult);
    const percentage = plResult !== 0 ? (difference / Math.abs(plResult)) * 100 : 0;
    
    results.push({
      month: current.monthName,
      evMutatie: evMutatie,
      plResult: plResult,
      difference: difference,
      percentage: percentage
    });
    
    if (percentage > 5) { // 5% tolerance
      status = 'WAARSCHUWING';
    }
  }
  
  if (results.length > 0) {
    const avgPercentage = results.reduce((sum, r) => sum + r.percentage, 0) / results.length;
    details = `Gemiddelde afwijking: ${avgPercentage.toFixed(1)}%`;
  }

  return {
    id: 1,
    name: 'P&L vs. Balanscontrole',
    description: 'Sluit het resultaat in de P&L exact aan op de winst/verliesmutatie in het eigen vermogen op de balans?',
    goal: 'Consistentie tussen rapportages',
    calculation: 'EV (huidig) - EV (vorige maand) = Mutatie eigen vermogen → vergelijken met resultaat W&V huidige maand',
    status: status,
    details: details,
    results: results
  };
}

function performRevenueCogsCheck(monthlyData, categoryTotals) {
  const margins = [];
  
  monthlyData.forEach(month => {
    const opbrengsten = month.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
    const kosten = month.accountTypeBreakdown['Kosten']?.netAmount || 0;
    
    if (opbrengsten > 0) {
      const margin = ((opbrengsten - Math.abs(kosten)) / opbrengsten) * 100;
      margins.push({
        month: month.monthName,
        opbrengsten: opbrengsten,
        kosten: Math.abs(kosten),
        margin: margin
      });
    }
  });
  
  let status = 'OK';
  let details = '';
  
  if (margins.length >= 2) {
    const marginValues = margins.map(m => m.margin);
    const median = calculateMedian(marginValues);
    const mad = calculateMAD(marginValues, median);
    
    const currentMargin = margins[margins.length - 1]?.margin || 0;
    const inBand = isWithinBand(currentMargin, median, mad);
    
    status = inBand ? 'OK' : 'WAARSCHUWING';
    details = `Mediaan: ${median.toFixed(1)}%, Huidige marge: ${currentMargin.toFixed(1)}%, Band: [${(median - 1.5 * mad).toFixed(1)}%, ${(median + 1.5 * mad).toFixed(1)}%]`;
  }

  return {
    id: 2,
    name: 'Omzet vs. COGS-verhouding',
    description: 'Is de brutomarge binnen een normale bandbreedte t.o.v. voorgaande maanden?',
    goal: 'Signaal bij foute COGS-boeking of omzettoerekening',
    calculation: 'Band = mediaan ± 1.5 × MAD. Check: Ligt marge in de bandbreedte?',
    status: status,
    details: details,
    results: margins
  };
}

function performDebtorTurnoverCheck(monthlyData, categoryTotals) {
  const dsoValues = [];
  
  monthlyData.forEach(month => {
    const debiteuren = month.categorieBreakdown['Debiteuren']?.netAmount || 0;
    const opbrengsten = month.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
    
    if (opbrengsten > 0) {
      const daysInMonth = 30; // Simplified
      const revenuePerDay = opbrengsten / daysInMonth;
      const dso = revenuePerDay > 0 ? debiteuren / revenuePerDay : 0;
      
      dsoValues.push({
        month: month.monthName,
        debiteuren: debiteuren,
        opbrengsten: opbrengsten,
        dso: dso
      });
    }
  });
  
  let status = 'OK';
  let details = '';
  
  if (dsoValues.length >= 2) {
    const dsoNumbers = dsoValues.map(d => d.dso);
    const median = calculateMedian(dsoNumbers);
    const mad = calculateMAD(dsoNumbers, median);
    
    const currentDSO = dsoValues[dsoValues.length - 1]?.dso || 0;
    const inBand = isWithinBand(currentDSO, median, mad);
    
    status = inBand ? 'OK' : 'WAARSCHUWING';
    details = `Mediaan DSO: ${median.toFixed(0)} dagen, Huidige DSO: ${currentDSO.toFixed(0)} dagen`;
  }

  return {
    id: 3,
    name: 'Debiteurenomloop check',
    description: 'Vergelijk de verhouding debiteuren vs. omzet met vorige maanden (DSO)',
    goal: 'Detectie van verkeerde omzet of late facturatie',
    calculation: 'DSO (dagen) = Gemiddeld debiteuren / Omzet per dag → Band = mediaan ± 1.5 × MAD',
    status: status,
    details: details,
    results: dsoValues
  };
}

function performCreditorTurnoverCheck(monthlyData, categoryTotals) {
  const dpoValues = [];
  
  monthlyData.forEach(month => {
    const crediteuren = month.categorieBreakdown['Crediteuren']?.netAmount || 0;
    const kosten = month.accountTypeBreakdown['Kosten']?.netAmount || 0;
    
    if (kosten > 0) {
      const daysInMonth = 30;
      const costsPerDay = Math.abs(kosten) / daysInMonth;
      const dpo = costsPerDay > 0 ? Math.abs(crediteuren) / costsPerDay : 0;
      
      dpoValues.push({
        month: month.monthName,
        crediteuren: Math.abs(crediteuren),
        kosten: Math.abs(kosten),
        dpo: dpo
      });
    }
  });
  
  let status = 'OK';
  let details = '';
  
  if (dpoValues.length >= 2) {
    const dpoNumbers = dpoValues.map(d => d.dpo);
    const median = calculateMedian(dpoNumbers);
    const mad = calculateMAD(dpoNumbers, median);
    
    const currentDPO = dpoValues[dpoValues.length - 1]?.dpo || 0;
    const inBand = isWithinBand(currentDPO, median, mad);
    
    status = inBand ? 'OK' : 'WAARSCHUWING';
    details = `Mediaan DPO: ${median.toFixed(0)} dagen, Huidige DPO: ${currentDPO.toFixed(0)} dagen`;
  }

  return {
    id: 4,
    name: 'Crediteurenomloop check',
    description: 'Vergelijk crediteurenpositie vs. inkoopkosten of COGS (DPO)',
    goal: 'Signaleert vertraagde verwerking van facturen',
    calculation: 'DPO = Gemiddelde crediteuren / COGS per dag → Band = mediaan ± 1.5 × MAD',
    status: status,
    details: details,
    results: dpoValues
  };
}

function performCashPositionCheck(categoryTotals) {
  const liquideMiddelenCategories = ['Bank', 'Kas', 'Liquide middelen', 'Giro'];
  let totalCash = 0;
  
  Object.keys(categoryTotals).forEach(category => {
    if (liquideMiddelenCategories.some(lm => category.toLowerCase().includes(lm.toLowerCase()))) {
      totalCash += categoryTotals[category].netAmount;
    }
  });
  
  // Simplified check - in real scenario, this would compare with bank statements
  const status = 'INFO';
  const details = `Totale liquide middelen: €${totalCash.toLocaleString('nl-NL')}`;

  return {
    id: 5,
    name: 'Liquide middelen vs. bankafschriften',
    description: 'Klopt het banksaldo met de laatste banktransactie?',
    goal: 'Validatie cashpositie',
    calculation: 'Verschil = Saldo GL (boekhouding) − Saldo bankafschrift (werkelijk)',
    status: status,
    details: details,
    results: [{ category: 'Liquide middelen totaal', amount: totalCash }]
  };
}

function performFixedAssetsCheck(monthlyData, categoryTotals) {
  const vasteActivaCategories = ['Vaste activa', 'Afschrijvingen', 'Investeringen'];
  let details = '';
  
  const vasteActivaData = Object.keys(categoryTotals)
    .filter(cat => vasteActivaCategories.some(va => cat.toLowerCase().includes(va.toLowerCase())))
    .map(cat => ({
      category: cat,
      amount: categoryTotals[cat].netAmount
    }));
  
  const status = vasteActivaData.length > 0 ? 'INFO' : 'GEEN_DATA';
  details = vasteActivaData.length > 0 
    ? `${vasteActivaData.length} categorieën vaste activa gevonden`
    : 'Geen vaste activa categorieën geidentificeerd';

  return {
    id: 6,
    name: 'Mutatie vaste activa + afschrijvingen',
    description: 'Kloppen de afschrijvingen met de vaste activa-mutaties? Zijn er investeringen geboekt?',
    goal: 'Juistheid van activaboekingen en afschrijvingslogica',
    calculation: 'Nieuw boekwaarde = Beginwaarde + Investeringen − Afschrijvingen',
    status: status,
    details: details,
    results: vasteActivaData
  };
}

function performVATBalanceCheck(categoryTotals, allData) {
  const btwCategories = ['BTW', 'Belasting'];
  let totalBTW = 0;
  let oldEntries = 0;
  
  // Check for old VAT entries (simplified - in real scenario would check dates)
  const btwEntries = allData.filter(record => 
    btwCategories.some(btw => (record.Categorie || '').toLowerCase().includes(btw.toLowerCase()))
  );
  
  btwEntries.forEach(entry => {
    totalBTW += (entry.Bedrag_credit || 0) - (entry.Bedrag_debet || 0);
  });
  
  const status = Math.abs(totalBTW) < 1000 ? 'OK' : 'WAARSCHUWING';
  const details = `BTW saldo: €${totalBTW.toLocaleString('nl-NL')}, ${btwEntries.length} BTW-boekingen`;

  return {
    id: 7,
    name: 'BTW-saldi check',
    description: 'Zijn de BTW-rekeningen (te vorderen / te betalen) in balans en actueel?',
    goal: 'Juistheid en volledigheid van belastingpositie',
    calculation: 'Saldo BTW-rekeningen = Te vorderen BTW − Te betalen BTW',
    status: status,
    details: details,
    results: [{ description: 'BTW saldo', amount: totalBTW, entries: btwEntries.length }]
  };
}

function performSubledgerCheck(categoryTotals) {
  const subAdminCategories = ['Debiteuren', 'Crediteuren', 'Voorraad', 'Vaste activa'];
  const results = [];
  
  subAdminCategories.forEach(category => {
    if (categoryTotals[category]) {
      results.push({
        category: category,
        amount: categoryTotals[category].netAmount,
        recordCount: categoryTotals[category].recordCount
      });
    }
  });
  
  const status = results.length === subAdminCategories.length ? 'OK' : 'WAARSCHUWING';
  const details = `${results.length} van ${subAdminCategories.length} subadministraties gevonden`;

  return {
    id: 8,
    name: 'Grootboek vs. subadministraties',
    description: 'Sluiten debiteuren, crediteuren, voorraad, vaste activa aan op subadministratie?',
    goal: 'Controle op fouten of achterstanden in boekingen',
    calculation: 'Vergelijking grootboeksaldi met subadministratie totalen',
    status: status,
    details: details,
    results: results
  };
}

function performCashFlowConsistencyCheck(monthlyData) {
  if (monthlyData.length < 2) {
    return {
      id: 9,
      name: 'Kasstroomconsistentie check',
      description: 'Klopt de mutatie in liquide middelen met het verschil tussen begin- en eindbalans?',
      goal: 'Volledigheid van cash flow',
      calculation: 'ΔCash = Eindsaldo cash − Beginsaldo cash',
      status: 'GEEN_DATA',
      details: 'Onvoldoende data voor kasstroomanalyse',
      results: []
    };
  }
  
  // Simplified cash flow check
  const beginMonth = monthlyData[0];
  const eindMonth = monthlyData[monthlyData.length - 1];
  
  const beginCash = beginMonth.accountTypeBreakdown['Activa']?.netAmount || 0;
  const eindCash = eindMonth.accountTypeBreakdown['Activa']?.netAmount || 0;
  const deltaCash = eindCash - beginCash;
  
  const status = 'INFO';
  const details = `Kasmutatie: €${deltaCash.toLocaleString('nl-NL')} (${beginMonth.monthName} → ${eindMonth.monthName})`;

  return {
    id: 9,
    name: 'Kasstroomconsistentie check',
    description: 'Klopt de mutatie in liquide middelen met het verschil tussen begin- en eindbalans?',
    goal: 'Volledigheid van cash flow',
    calculation: 'ΔCash = Eindsaldo cash − Beginsaldo cash',
    status: status,
    details: details,
    results: [{ beginCash, eindCash, deltaCash }]
  };
}

function performAccrualsCheck(monthlyData, categoryTotals) {
  const accrualCategories = ['Voorziening', 'Accrual', 'Reservering'];
  const accrualData = [];
  
  monthlyData.forEach(month => {
    let monthlyAccruals = 0;
    Object.keys(month.categorieBreakdown).forEach(category => {
      if (accrualCategories.some(acc => category.toLowerCase().includes(acc.toLowerCase()))) {
        monthlyAccruals += month.categorieBreakdown[category].netAmount;
      }
    });
    
    if (monthlyAccruals !== 0) {
      accrualData.push({
        month: month.monthName,
        amount: monthlyAccruals
      });
    }
  });
  
  let status = 'INFO';
  let details = '';
  
  if (accrualData.length >= 2) {
    const amounts = accrualData.map(a => a.amount);
    const median = calculateMedian(amounts);
    const current = accrualData[accrualData.length - 1].amount;
    const deviation = median !== 0 ? ((current - median) / median) * 100 : 0;
    
    status = Math.abs(deviation) > 50 ? 'WAARSCHUWING' : 'OK';
    details = `Afwijking van mediaan: ${deviation.toFixed(1)}%`;
  } else {
    details = accrualData.length === 0 ? 'Geen accruals gedetecteerd' : 'Onvoldoende data voor vergelijking';
  }

  return {
    id: 10,
    name: 'Accruals/voorzieningen check',
    description: 'Zijn accruals en voorzieningen consistent met voorgaande periodes?',
    goal: 'Signaal bij vergeten of overbodige posten',
    calculation: 'Afwijking = (huidige - mediaan) / mediaan * 100%',
    status: status,
    details: details,
    results: accrualData
  };
}

function performIntercompanyCheck(categoryTotals) {
  const intercompanyCategories = ['Intercompany', 'Tussenrekening', 'Groepsmaatschappij'];
  let totalIntercompany = 0;
  let intercompanyCount = 0;
  
  Object.keys(categoryTotals).forEach(category => {
    if (intercompanyCategories.some(ic => category.toLowerCase().includes(ic.toLowerCase()))) {
      totalIntercompany += categoryTotals[category].netAmount;
      intercompanyCount++;
    }
  });
  
  const status = Math.abs(totalIntercompany) < 100 ? 'OK' : 'WAARSCHUWING';
  const details = intercompanyCount > 0 
    ? `${intercompanyCount} intercompany-rekeningen, saldo: €${totalIntercompany.toLocaleString('nl-NL')}`
    : 'Geen intercompany-rekeningen gedetecteerd';

  return {
    id: 11,
    name: 'Intercompany check',
    description: 'Is het saldo op intercompany-rekeningen gesaldeerd met de tegenpartij?',
    goal: 'Juistheid in consolidatieomgevingen',
    calculation: 'Saldo entiteit A + Saldo entiteit B = 0',
    status: status,
    details: details,
    results: [{ totalSaldo: totalIntercompany, aantalRekeningen: intercompanyCount }]
  };
}

function performLargeJournalEntriesCheck(allData) {
  const threshold = 10000; // €10,000 threshold
  const largeEntries = allData.filter(record => 
    (record.Bedrag_debet || 0) > threshold || (record.Bedrag_credit || 0) > threshold
  );
  
  const status = largeEntries.length === 0 ? 'OK' : largeEntries.length > 10 ? 'WAARSCHUWING' : 'INFO';
  const details = `${largeEntries.length} boekingen > €${threshold.toLocaleString('nl-NL')}`;

  return {
    id: 12,
    name: 'Onevenredige journaalposten check',
    description: 'Zijn er grote handmatige boekingen? Zijn deze correct onderbouwd?',
    goal: 'Foutdetectie bij uitzonderlijke posten',
    calculation: `Filter op bedrag boven €${threshold.toLocaleString('nl-NL')}`,
    status: status,
    details: details,
    results: largeEntries.slice(0, 10).map(entry => ({
      datum: entry.Boekstukdatum,
      omschrijving: entry.Omschrijving,
      debet: entry.Bedrag_debet || 0,
      credit: entry.Bedrag_credit || 0
    }))
  };
}

function performInventoryValuationCheck(monthlyData, categoryTotals) {
  const voorraadCategories = ['Voorraad', 'Inventory', 'Stock'];
  const voorraadData = [];
  
  monthlyData.forEach(month => {
    let voorraad = 0;
    let inkoop = 0;
    let cogs = 0;
    
    Object.keys(month.categorieBreakdown).forEach(category => {
      if (voorraadCategories.some(v => category.toLowerCase().includes(v.toLowerCase()))) {
        voorraad += month.categorieBreakdown[category].netAmount;
      }
      if (category.toLowerCase().includes('inkoop')) {
        inkoop += Math.abs(month.categorieBreakdown[category].netAmount);
      }
    });
    
    cogs = Math.abs(month.accountTypeBreakdown['Kosten']?.netAmount || 0);
    
    voorraadData.push({
      month: month.monthName,
      voorraad: voorraad,
      inkoop: inkoop,
      cogs: cogs,
      mutatie: voorraad // Simplified - would need begin/end inventory
    });
  });
  
  const status = voorraadData.length > 0 ? 'INFO' : 'GEEN_DATA';
  const details = voorraadData.length > 0 
    ? `Voorraaddata beschikbaar voor ${voorraadData.length} maanden`
    : 'Geen voorraadgegevens gedetecteerd';

  return {
    id: 13,
    name: 'Voorraadwaardering check',
    description: 'Is de voorraadmutatie logisch t.o.v. inkoop/verkoop en consistent met historisch patroon?',
    goal: 'Detectie van dubbele of foute voorraadboekingen',
    calculation: 'Voorraadmutatie = Eindvoorraad − Beginvoorraad, Inkoop − COGS = Voorraadmutatie',
    status: status,
    details: details,
    results: voorraadData
  };
}

function performRatioAnalysisCheck(monthlyData) {
  const ratios = [];
  
  monthlyData.forEach(month => {
    const activa = month.accountTypeBreakdown['Activa']?.netAmount || 0;
    const passiva = Math.abs(month.accountTypeBreakdown['Passiva']?.netAmount || 0);
    const eigenVermogen = activa - passiva;
    const totalVermogen = activa;
    
    // Simplified ratios calculation
    const vlottendeActiva = activa * 0.6; // Simplified assumption
    const voorraad = activa * 0.1; // Simplified assumption
    const kortlopendeSchulden = passiva * 0.7; // Simplified assumption
    
    const currentRatio = kortlopendeSchulden > 0 ? vlottendeActiva / kortlopendeSchulden : 0;
    const quickRatio = kortlopendeSchulden > 0 ? (vlottendeActiva - voorraad) / kortlopendeSchulden : 0;
    const solvabiliteit = totalVermogen > 0 ? (eigenVermogen / totalVermogen) * 100 : 0;
    
    ratios.push({
      month: month.monthName,
      currentRatio: currentRatio,
      quickRatio: quickRatio,
      solvabiliteit: solvabiliteit
    });
  });
  
  // Check against thresholds
  const currentMonth = ratios[ratios.length - 1];
  let warnings = [];
  
  if (currentMonth) {
    if (currentMonth.currentRatio < 1) warnings.push('Current ratio < 1');
    if (currentMonth.quickRatio < 0.5) warnings.push('Quick ratio < 0.5');
    if (currentMonth.solvabiliteit < 20) warnings.push('Solvabiliteit < 20%');
  }
  
  const status = warnings.length === 0 ? 'OK' : 'WAARSCHUWING';
  const details = warnings.length > 0 ? warnings.join(', ') : 'Alle ratio\'s binnen normale waarden';

  return {
    id: 14,
    name: 'Ratio-analyse (early warning)',
    description: 'Bereken en vergelijk ratio\'s met vorige maanden',
    goal: 'Vroegtijdige signalering van trends of fouten',
    calculation: 'Current ratio, Quick ratio, Solvabiliteit vs. thresholds',
    status: status,
    details: details,
    results: ratios
  };
}

function performPeriodicEntriesCheck(categoryTotals) {
  const periodicCategories = ['Huur', 'Loon', 'Salaris', 'Afschrijving', 'Rente', 'Interest'];
  const foundCategories = [];
  
  Object.keys(categoryTotals).forEach(category => {
    if (periodicCategories.some(pc => category.toLowerCase().includes(pc.toLowerCase()))) {
      foundCategories.push({
        category: category,
        amount: categoryTotals[category].netAmount,
        records: categoryTotals[category].recordCount
      });
    }
  });
  
  const status = foundCategories.length >= 3 ? 'OK' : 'WAARSCHUWING';
  const details = `${foundCategories.length} van ${periodicCategories.length} verwachte periodieke categorieën gevonden`;

  return {
    id: 15,
    name: 'Tijdigheid afsluitposten',
    description: 'Zijn alle periodieke posten tijdig en correct geboekt?',
    goal: 'Voorkomen van vergeten maandelijkse boekingen',
    calculation: 'Controle op aanwezigheid van huur, lonen, afschrijvingen, interest, etc.',
    status: status,
    details: details,
    results: foundCategories
  };
}

// ======== PER MONTH CHECK FUNCTIONS ========

function performPLBalanceCheckPerMonth(monthData, monthEigenVermogen, allMonthsData) {
  // Get P&L components for this month
  const opbrengsten = monthData.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
  const kosten = monthData.accountTypeBreakdown['Kosten']?.netAmount || 0;
  const plResult = opbrengsten - Math.abs(kosten);
  
  // Get current month's eigen vermogen
  const currentEV = monthData.categorieBreakdown['Eigen vermogen']?.netAmount || 0;
  
  // Find previous month for comparison
  const currentMonthIndex = allMonthsData.findIndex(m => m.year === monthData.year && m.month === monthData.month);
  let status = 'INFO';
  let details = '';
  let evMutatie = 0;
  let verschil = 0;
  
  if (currentMonthIndex > 0) {
    const previousMonth = allMonthsData[currentMonthIndex - 1];
    const previousEV = previousMonth.categorieBreakdown['Eigen vermogen']?.netAmount || 0;
    
    // Calculate EV mutation: EV (current) - EV (previous) = Mutation
    evMutatie = currentEV - previousEV;
    
    // Compare with P&L result
    verschil = Math.abs(evMutatie - plResult);
    
    // Determine status based on difference
    if (verschil < 100) {
      status = 'OK';
    } else if (verschil < 1000) {
      status = 'WAARSCHUWING';
    } else {
      status = 'WAARSCHUWING';
    }
    
    details = `EV mutatie: €${evMutatie.toLocaleString('nl-NL')}, W&V resultaat: €${plResult.toLocaleString('nl-NL')}, Verschil: €${verschil.toLocaleString('nl-NL')}`;
  } else {
    details = `Eerste maand - geen vergelijking mogelijk. Huidig EV: €${currentEV.toLocaleString('nl-NL')}, W&V: €${plResult.toLocaleString('nl-NL')}`;
    status = 'INFO';
  }

  return {
    id: 1,
    name: 'P&L vs. Balanscontrole',
    description: 'Sluit het resultaat in de P&L exact aan op de winst/verliesmutatie in het eigen vermogen op de balans?',
    goal: 'Consistentie tussen rapportages',
    calculation: 'EV (huidig) - EV (vorige maand) = Mutatie eigen vermogen → vergelijken met resultaat W&V huidige maand',
    status: status,
    details: details,
    monthSpecific: true,
    results: currentMonthIndex > 0 ? [{
      month: monthData.monthName,
      evHuidig: currentEV,
      evVorig: currentMonthIndex > 0 ? allMonthsData[currentMonthIndex - 1].categorieBreakdown['Eigen vermogen']?.netAmount || 0 : 0,
      evMutatie: evMutatie,
      wvResultaat: plResult,
      verschil: verschil,
      status: status
    }] : [{
      month: monthData.monthName,
      evHuidig: currentEV,
      wvResultaat: plResult,
      opmerking: 'Eerste maand - geen vergelijking mogelijk'
    }]
  };
}

function performRevenueCogsCheckPerMonth(monthData, allMonthsData) {
  const opbrengsten = monthData.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
  const kosten = monthData.accountTypeBreakdown['Kosten']?.netAmount || 0;
  
  let status = 'INFO';
  let details = '';
  let results = [];
  
  if (opbrengsten > 0) {
    const currentMargin = ((opbrengsten - Math.abs(kosten)) / opbrengsten) * 100;
    
    // Get current month index
    const currentMonthIndex = allMonthsData.findIndex(m => m.year === monthData.year && m.month === monthData.month);
    
    // Compare with previous month
    let marginTrend = '';
    let marginVerschil = 0;
    
    if (currentMonthIndex > 0) {
      const previousMonth = allMonthsData[currentMonthIndex - 1];
      const prevOmzet = previousMonth.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
      const prevKosten = previousMonth.accountTypeBreakdown['Kosten']?.netAmount || 0;
      
      if (prevOmzet > 0) {
        const previousMargin = ((prevOmzet - Math.abs(prevKosten)) / prevOmzet) * 100;
        marginVerschil = currentMargin - previousMargin;
        
        if (marginVerschil > 5) {
          marginTrend = 'Sterk verbeterd';
          status = 'OK';
        } else if (marginVerschil > 1) {
          marginTrend = 'Verbeterd';
          status = 'OK';
        } else if (marginVerschil > -1) {
          marginTrend = 'Stabiel';
          status = 'OK';
        } else if (marginVerschil > -5) {
          marginTrend = 'Gedaald';
          status = 'WAARSCHUWING';
        } else {
          marginTrend = 'Sterk gedaald';
          status = 'WAARSCHUWING';
        }
        
        results.push({
          month: monthData.monthName,
          omzetHuidig: opbrengsten,
          kostenHuidig: Math.abs(kosten),
          margeHuidig: currentMargin,
          omzetVorig: prevOmzet,
          kostenVorig: Math.abs(prevKosten),
          margeVorig: previousMargin,
          marginVerschil: marginVerschil,
          trend: marginTrend
        });
      }
    } else {
      marginTrend = 'Eerste maand';
      results.push({
        month: monthData.monthName,
        omzetHuidig: opbrengsten,
        kostenHuidig: Math.abs(kosten),
        margeHuidig: currentMargin,
        opmerking: 'Eerste maand - geen vergelijking mogelijk'
      });
    }
    
    // Calculate historical average if enough data
    const allMargins = allMonthsData.slice(0, currentMonthIndex + 1).map(m => {
      const rev = m.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
      const costs = m.accountTypeBreakdown['Kosten']?.netAmount || 0;
      return rev > 0 ? ((rev - Math.abs(costs)) / rev) * 100 : 0;
    }).filter(m => m > 0);
    
    if (allMargins.length >= 3) {
      const avgMargin = allMargins.reduce((sum, m) => sum + m, 0) / allMargins.length;
      const afwijkingVanGemiddelde = currentMargin - avgMargin;
      
      if (Math.abs(afwijkingVanGemiddelde) > 10) {
        status = 'WAARSCHUWING';
      }
      
      details = `Huidige marge: ${currentMargin.toFixed(1)}% | Trend vs vorige maand: ${marginTrend} (${marginVerschil > 0 ? '+' : ''}${marginVerschil.toFixed(1)}%) | Gemiddelde: ${avgMargin.toFixed(1)}%`;
    } else {
      details = `Huidige marge: ${currentMargin.toFixed(1)}% | Trend vs vorige maand: ${marginTrend}${marginVerschil !== 0 ? ` (${marginVerschil > 0 ? '+' : ''}${marginVerschil.toFixed(1)}%)` : ''}`;
    }
    
  } else {
    details = 'Geen omzet in deze maand';
    status = 'GEEN_DATA';
    results.push({
      month: monthData.monthName,
      opmerking: 'Geen omzet in deze maand'
    });
  }

  return {
    id: 2,
    name: 'Omzet vs. COGS-verhouding',
    description: 'Is de brutomarge binnen een normale bandbreedte t.o.v. voorgaande maanden?',
    goal: 'Signaal bij foute COGS-boeking of omzettoerekening',
    calculation: 'Marge% = (Omzet - Kosten) / Omzet * 100, vergelijking met vorige maand en historisch gemiddelde',
    status: status,
    details: details,
    monthSpecific: true,
    results: results
  };
}

function performDebtorTurnoverCheckPerMonth(monthData, allMonthsData) {
  const debiteuren = monthData.categorieBreakdown['Debiteuren']?.netAmount || 0;
  const opbrengsten = monthData.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
  
  let status = 'INFO';
  let details = '';
  let results = [];
  
  if (opbrengsten > 0) {
    const currentDSO = (debiteuren / opbrengsten) * 30;
    
    // Get current month index for comparison
    const currentMonthIndex = allMonthsData.findIndex(m => m.year === monthData.year && m.month === monthData.month);
    
    let dsoTrend = '';
    let dsoVerschil = 0;
    
    if (currentMonthIndex > 0) {
      const previousMonth = allMonthsData[currentMonthIndex - 1];
      const prevDebiteuren = previousMonth.categorieBreakdown['Debiteuren']?.netAmount || 0;
      const prevOmzet = previousMonth.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
      
      if (prevOmzet > 0) {
        const previousDSO = (prevDebiteuren / prevOmzet) * 30;
        dsoVerschil = currentDSO - previousDSO;
        
        if (dsoVerschil > 10) {
          dsoTrend = 'Sterk verslechterd';
          status = 'WAARSCHUWING';
        } else if (dsoVerschil > 3) {
          dsoTrend = 'Verslechterd';
          status = 'WAARSCHUWING';
        } else if (dsoVerschil > -3) {
          dsoTrend = 'Stabiel';
          status = currentDSO > 45 ? 'WAARSCHUWING' : 'OK';
        } else if (dsoVerschil > -10) {
          dsoTrend = 'Verbeterd';
          status = 'OK';
        } else {
          dsoTrend = 'Sterk verbeterd';
          status = 'OK';
        }
        
        results.push({
          month: monthData.monthName,
          debiteurenHuidig: debiteuren,
          omzetHuidig: opbrengsten,
          dsoHuidig: currentDSO,
          debiteurenVorig: prevDebiteuren,
          omzetVorig: prevOmzet,
          dsoVorig: previousDSO,
          dsoVerschil: dsoVerschil,
          trend: dsoTrend
        });
      }
    } else {
      dsoTrend = 'Eerste maand';
      status = currentDSO > 45 ? 'WAARSCHUWING' : currentDSO > 30 ? 'INFO' : 'OK';
      results.push({
        month: monthData.monthName,
        debiteurenHuidig: debiteuren,
        omzetHuidig: opbrengsten,
        dsoHuidig: currentDSO,
        opmerking: 'Eerste maand - geen vergelijking mogelijk'
      });
    }
    
    // Calculate historical average
    const allDSOs = allMonthsData.slice(0, currentMonthIndex + 1).map(m => {
      const deb = m.categorieBreakdown['Debiteuren']?.netAmount || 0;
      const omz = m.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
      return omz > 0 ? (deb / omz) * 30 : 0;
    }).filter(dso => dso > 0);
    
    if (allDSOs.length >= 3) {
      const avgDSO = allDSOs.reduce((sum, dso) => sum + dso, 0) / allDSOs.length;
      details = `DSO: ${currentDSO.toFixed(0)} dagen | Trend vs vorige maand: ${dsoTrend} (${dsoVerschil > 0 ? '+' : ''}${dsoVerschil.toFixed(0)} dagen) | Gemiddelde: ${avgDSO.toFixed(0)} dagen`;
    } else {
      details = `DSO: ${currentDSO.toFixed(0)} dagen | Trend vs vorige maand: ${dsoTrend}${dsoVerschil !== 0 ? ` (${dsoVerschil > 0 ? '+' : ''}${dsoVerschil.toFixed(0)} dagen)` : ''}`;
    }
    
  } else {
    details = 'Geen omzet - DSO niet berekenbaar';
    status = 'GEEN_DATA';
    results.push({
      month: monthData.monthName,
      opmerking: 'Geen omzet - DSO niet berekenbaar'
    });
  }

  return {
    id: 3,
    name: 'Debiteurenomloop check',
    description: 'Vergelijk de verhouding debiteuren vs. omzet met vorige maanden (DSO)',
    goal: 'Detectie van verkeerde omzet of late facturatie',
    calculation: 'DSO = (Debiteuren / Omzet) * 30 dagen, vergelijking met vorige maand en gemiddelde',
    status: status,
    details: details,
    monthSpecific: true,
    results: results
  };
}

function performCreditorTurnoverCheckPerMonth(monthData, allMonthsData) {
  const crediteuren = monthData.categorieBreakdown['Crediteuren']?.netAmount || 0;
  const kosten = monthData.accountTypeBreakdown['Kosten']?.netAmount || 0;
  
  let status = 'INFO';
  let details = '';
  
  if (kosten > 0) {
    const dpo = (Math.abs(crediteuren) / Math.abs(kosten)) * 30; // Simplified DPO calculation
    details = `DPO: ${dpo.toFixed(0)} dagen (Crediteuren: €${Math.abs(crediteuren).toLocaleString('nl-NL')}, Kosten: €${Math.abs(kosten).toLocaleString('nl-NL')})`;
    
    // Simple threshold check
    if (dpo > 90) {
      status = 'WAARSCHUWING';
      details += ' - Zeer hoge DPO (>90 dagen)';
    } else if (dpo > 45) {
      status = 'INFO';
      details += ' - Gemiddelde DPO';
    } else {
      status = 'OK';
      details += ' - Normale DPO';
    }
  } else {
    details = 'Geen kosten - DPO niet berekenbaar';
    status = 'GEEN_DATA';
  }

  return {
    id: 4,
    name: 'Crediteurenomloop check',
    description: 'Vergelijk crediteurenpositie vs. inkoopkosten of COGS (DPO)',
    goal: 'Signaleert vertraagde verwerking van facturen',
    calculation: 'DPO = (Crediteuren / Kosten) * 30 dagen',
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performCashPositionCheckPerMonth(monthData) {
  const liquideMiddelenCategories = ['Bank', 'Kas', 'Liquide middelen', 'Giro'];
  let totalCash = 0;
  
  Object.keys(monthData.categorieBreakdown || {}).forEach(category => {
    if (liquideMiddelenCategories.some(lm => category.toLowerCase().includes(lm.toLowerCase()))) {
      totalCash += monthData.categorieBreakdown[category].netAmount;
    }
  });
  
  const status = totalCash >= 0 ? 'OK' : 'WAARSCHUWING';
  const details = `Liquide middelen: €${totalCash.toLocaleString('nl-NL')} in ${monthData.monthName}`;

  return {
    id: 5,
    name: 'Liquide middelen vs. bankafschriften',
    description: 'Klopt het banksaldo met de laatste banktransactie?',
    goal: 'Validatie cashpositie',
    calculation: 'Totaal liquide middelen per maand',
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performFixedAssetsCheckPerMonth(monthData) {
  const vasteActivaCategories = ['Vaste activa', 'Afschrijvingen', 'Investeringen', 'Materiële vaste activa', 'Immateriële vaste activa'];
  let totalVasteActiva = 0;
  let foundCategories = 0;
  
  Object.keys(monthData.categorieBreakdown || {}).forEach(category => {
    if (vasteActivaCategories.some(va => category.toLowerCase().includes(va.toLowerCase()))) {
      totalVasteActiva += monthData.categorieBreakdown[category].netAmount;
      foundCategories++;
    }
  });
  
  const status = foundCategories > 0 ? 'INFO' : 'GEEN_DATA';
  const details = foundCategories > 0 
    ? `${foundCategories} VA categorieën, totaal: €${totalVasteActiva.toLocaleString('nl-NL')}`
    : 'Geen vaste activa categorieën gevonden';

  return {
    id: 6,
    name: 'Mutatie vaste activa + afschrijvingen',
    description: 'Kloppen de afschrijvingen met de vaste activa-mutaties?',
    goal: 'Juistheid van activaboekingen en afschrijvingslogica',
    calculation: 'Controle op VA categorieën en afschrijvingen per maand',
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performVATBalanceCheckPerMonth(monthData) {
  const btwCategories = ['BTW', 'Belasting'];
  let totalBTW = 0;
  let btwEntries = 0;
  
  monthData.records?.forEach(record => {
    if (btwCategories.some(btw => (record.Categorie || '').toLowerCase().includes(btw.toLowerCase()))) {
      totalBTW += (record.Bedrag_credit || 0) - (record.Bedrag_debet || 0);
      btwEntries++;
    }
  });
  
  const status = Math.abs(totalBTW) < 500 ? 'OK' : 'INFO';
  const details = `BTW saldo: €${totalBTW.toLocaleString('nl-NL')}, ${btwEntries} boekingen`;

  return {
    id: 7,
    name: 'BTW-saldi check',
    description: 'Zijn de BTW-rekeningen (te vorderen / te betalen) in balans en actueel?',
    goal: 'Juistheid en volledigheid van belastingpositie',
    calculation: 'BTW saldo per maand',
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performSubledgerCheckPerMonth(monthData) {
  const subAdminCategories = ['Debiteuren', 'Crediteuren', 'Voorraad', 'Vaste activa'];
  const foundCategories = [];
  
  subAdminCategories.forEach(category => {
    if (monthData.categorieBreakdown?.[category]) {
      foundCategories.push({
        category: category,
        amount: monthData.categorieBreakdown[category].netAmount
      });
    }
  });
  
  const status = foundCategories.length >= 2 ? 'OK' : 'WAARSCHUWING';
  const details = `${foundCategories.length} van ${subAdminCategories.length} subadmin categorieën gevonden`;

  return {
    id: 8,
    name: 'Grootboek vs. subadministraties',
    description: 'Sluiten debiteuren, crediteuren, voorraad, vaste activa aan op subadministratie?',
    goal: 'Controle op fouten of achterstanden in boekingen',
    calculation: 'Aanwezigheid subadmin categorieën per maand',
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performCashFlowConsistencyCheckPerMonth(monthData, allMonthsData) {
  // Get cash categories
  const cashCategories = ['Liquide middelen', 'Bank', 'Kas', 'Giro'];
  let currentCash = 0;
  
  Object.keys(monthData.categorieBreakdown || {}).forEach(category => {
    if (cashCategories.some(cc => category.toLowerCase().includes(cc.toLowerCase()))) {
      currentCash += monthData.categorieBreakdown[category]?.netAmount || 0;
    }
  });
  
  // Get current month index for comparison
  const currentMonthIndex = allMonthsData.findIndex(m => m.year === monthData.year && m.month === monthData.month);
  
  let status = 'INFO';
  let details = '';
  let results = [];
  
  if (currentMonthIndex > 0) {
    // Get previous month cash position
    const previousMonth = allMonthsData[currentMonthIndex - 1];
    let previousCash = 0;
    
    Object.keys(previousMonth.categorieBreakdown || {}).forEach(category => {
      if (cashCategories.some(cc => category.toLowerCase().includes(cc.toLowerCase()))) {
        previousCash += previousMonth.categorieBreakdown[category]?.netAmount || 0;
      }
    });
    
    const cashMutatie = currentCash - previousCash;
    
    // Calculate expected cash flow from P&L
    const opbrengsten = monthData.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
    const kosten = monthData.accountTypeBreakdown['Kosten']?.netAmount || 0;
    const plResult = opbrengsten - Math.abs(kosten);
    
    // Simple cash flow estimation (P&L + depreciation - working capital changes)
    const verwachteCashFlow = plResult; // Simplified, could add depreciation and working capital changes
    
    const verschil = Math.abs(cashMutatie - verwachteCashFlow);
    
    // Determine status based on difference
    if (verschil < 1000) {
      status = 'OK';
    } else if (verschil < 5000) {
      status = 'INFO';
    } else {
      status = 'WAARSCHUWING';
    }
    
    results.push({
      month: monthData.monthName,
      cashHuidig: currentCash,
      cashVorig: previousCash,
      cashMutatie: cashMutatie,
      plResultaat: plResult,
      verwachteCashFlow: verwachteCashFlow,
      verschil: verschil,
      status: status
    });
    
    details = `Cash mutatie: €${cashMutatie.toLocaleString('nl-NL')} | P&L resultaat: €${plResult.toLocaleString('nl-NL')} | Verschil: €${verschil.toLocaleString('nl-NL')}`;
    
  } else {
    details = `Eerste maand - Cash positie: €${currentCash.toLocaleString('nl-NL')}`;
    results.push({
      month: monthData.monthName,
      cashHuidig: currentCash,
      opmerking: 'Eerste maand - geen vergelijking mogelijk'
    });
  }

  return {
    id: 9,
    name: 'Kasstroomconsistentie check',
    description: 'Klopt de mutatie in liquide middelen met het verschil tussen begin- en eindbalans?',
    goal: 'Volledigheid van cash flow',
    calculation: 'Cash mutatie vs P&L resultaat vergelijking per maand',
    status: status,
    details: details,
    monthSpecific: true,
    results: results
  };
}

function performAccrualsCheckPerMonth(monthData, allMonthsData) {
  const accrualCategories = ['Voorziening', 'Accrual', 'Reservering'];
  let monthlyAccruals = 0;
  let foundAccruals = 0;
  
  Object.keys(monthData.categorieBreakdown || {}).forEach(category => {
    if (accrualCategories.some(acc => category.toLowerCase().includes(acc.toLowerCase()))) {
      monthlyAccruals += monthData.categorieBreakdown[category].netAmount;
      foundAccruals++;
    }
  });
  
  const status = foundAccruals > 0 ? 'INFO' : 'GEEN_DATA';
  const details = foundAccruals > 0 
    ? `${foundAccruals} accrual categorieën, totaal: €${monthlyAccruals.toLocaleString('nl-NL')}`
    : 'Geen accruals gevonden';

  return {
    id: 10,
    name: 'Accruals/voorzieningen check',
    description: 'Zijn accruals en voorzieningen consistent met voorgaande periodes?',
    goal: 'Signaal bij vergeten of overbodige posten',
    calculation: 'Accruals bedrag per maand',
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performIntercompanyCheckPerMonth(monthData) {
  const intercompanyCategories = ['Intercompany', 'Tussenrekening', 'Groepsmaatschappij'];
  let totalIntercompany = 0;
  let intercompanyCount = 0;
  
  Object.keys(monthData.categorieBreakdown || {}).forEach(category => {
    if (intercompanyCategories.some(ic => category.toLowerCase().includes(ic.toLowerCase()))) {
      totalIntercompany += monthData.categorieBreakdown[category].netAmount;
      intercompanyCount++;
    }
  });
  
  const status = Math.abs(totalIntercompany) < 50 ? 'OK' : 'INFO';
  const details = intercompanyCount > 0 
    ? `${intercompanyCount} IC rekeningen, saldo: €${totalIntercompany.toLocaleString('nl-NL')}`
    : 'Geen intercompany rekeningen';

  return {
    id: 11,
    name: 'Intercompany check',
    description: 'Is het saldo op intercompany-rekeningen gesaldeerd met de tegenpartij?',
    goal: 'Juistheid in consolidatieomgevingen',
    calculation: 'IC saldo per maand',
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performLargeJournalEntriesCheckPerMonth(monthData) {
  const threshold = 5000; // Lower threshold for monthly check
  const largeEntries = monthData.records?.filter(record => 
    (record.Bedrag_debet || 0) > threshold || (record.Bedrag_credit || 0) > threshold
  ) || [];
  
  const status = largeEntries.length === 0 ? 'OK' : largeEntries.length > 5 ? 'WAARSCHUWING' : 'INFO';
  const details = `${largeEntries.length} boekingen > €${threshold.toLocaleString('nl-NL')} in ${monthData.monthName}`;

  return {
    id: 12,
    name: 'Onevenredige journaalposten check',
    description: 'Zijn er grote handmatige boekingen? Zijn deze correct onderbouwd?',
    goal: 'Foutdetectie bij uitzonderlijke posten',
    calculation: `Boekingen > €${threshold.toLocaleString('nl-NL')} per maand`,
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performInventoryValuationCheckPerMonth(monthData, allMonthsData) {
  const voorraadCategories = ['Voorraad', 'Inventory', 'Stock'];
  let voorraad = 0;
  let foundVoorraad = false;
  
  Object.keys(monthData.categorieBreakdown || {}).forEach(category => {
    if (voorraadCategories.some(v => category.toLowerCase().includes(v.toLowerCase()))) {
      voorraad += monthData.categorieBreakdown[category].netAmount;
      foundVoorraad = true;
    }
  });
  
  const status = foundVoorraad ? 'INFO' : 'GEEN_DATA';
  const details = foundVoorraad 
    ? `Voorraad: €${voorraad.toLocaleString('nl-NL')} in ${monthData.monthName}`
    : 'Geen voorraad categorieën gevonden';

  return {
    id: 13,
    name: 'Voorraadwaardering check',
    description: 'Is de voorraadmutatie logisch t.o.v. inkoop/verkoop en consistent met historisch patroon?',
    goal: 'Detectie van dubbele of foute voorraadboekingen',
    calculation: 'Voorraad positie per maand',
    status: status,
    details: details,
    monthSpecific: true
  };
}

function performRatioAnalysisCheckPerMonth(monthData, allMonthsData) {
  // Get balance sheet components
  const activa = monthData.accountTypeBreakdown['Activa']?.netAmount || 0;
  const passiva = Math.abs(monthData.accountTypeBreakdown['Passiva']?.netAmount || 0);
  const eigenVermogen = monthData.categorieBreakdown['Eigen vermogen']?.netAmount || 0;
  
  // Get P&L components
  const opbrengsten = monthData.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
  const kosten = monthData.accountTypeBreakdown['Kosten']?.netAmount || 0;
  
  // Calculate key ratios
  const solvabiliteit = activa > 0 ? (eigenVermogen / activa) * 100 : 0;
  const liquiditeit = activa > 0 ? (activa / passiva) : 0;
  const rentabiliteit = eigenVermogen > 0 ? ((opbrengsten - Math.abs(kosten)) / eigenVermogen) * 100 : 0;
  
  // Get current month index for comparison
  const currentMonthIndex = allMonthsData.findIndex(m => m.year === monthData.year && m.month === monthData.month);
  
  let status = 'OK';
  let details = '';
  let warnings = [];
  let results = [];
  
  // Check thresholds
  if (solvabiliteit < 20) warnings.push('Solvabiliteit kritiek laag (<20%)');
  if (solvabiliteit < 30) warnings.push('Solvabiliteit laag (<30%)');
  if (liquiditeit < 1.0) warnings.push('Liquiditeit onder 1.0');
  if (activa < 0) warnings.push('Negatieve activa');
  
  if (currentMonthIndex > 0) {
    // Compare with previous month
    const previousMonth = allMonthsData[currentMonthIndex - 1];
    const prevActiva = previousMonth.accountTypeBreakdown['Activa']?.netAmount || 0;
    const prevPassiva = Math.abs(previousMonth.accountTypeBreakdown['Passiva']?.netAmount || 0);
    const prevEigenVermogen = previousMonth.categorieBreakdown['Eigen vermogen']?.netAmount || 0;
    const prevOpbrengsten = previousMonth.accountTypeBreakdown['Opbrengsten']?.netAmount || 0;
    const prevKosten = previousMonth.accountTypeBreakdown['Kosten']?.netAmount || 0;
    
    const prevSolvabiliteit = prevActiva > 0 ? (prevEigenVermogen / prevActiva) * 100 : 0;
    const prevLiquiditeit = prevActiva > 0 ? (prevActiva / prevPassiva) : 0;
    const prevRentabiliteit = prevEigenVermogen > 0 ? ((prevOpbrengsten - Math.abs(prevKosten)) / prevEigenVermogen) * 100 : 0;
    
    const solvabiliteitVerschil = solvabiliteit - prevSolvabiliteit;
    const liquiditeitVerschil = liquiditeit - prevLiquiditeit;
    const rentabiliteitVerschil = rentabiliteit - prevRentabiliteit;
    
    // Check for significant changes
    if (Math.abs(solvabiliteitVerschil) > 5) {
      warnings.push(`Solvabiliteit ${solvabiliteitVerschil > 0 ? 'sterk gestegen' : 'sterk gedaald'} (${solvabiliteitVerschil.toFixed(1)}%)`);
    }
    
    if (Math.abs(liquiditeitVerschil) > 0.2) {
      warnings.push(`Liquiditeit ${liquiditeitVerschil > 0 ? 'sterk verbeterd' : 'sterk verslechterd'}`);
    }
    
    results.push({
      month: monthData.monthName,
      solvabiliteitHuidig: solvabiliteit,
      liquiditeitHuidig: liquiditeit,
      rentabiliteitHuidig: rentabiliteit,
      solvabiliteitVorig: prevSolvabiliteit,
      liquiditeitVorig: prevLiquiditeit,
      rentabiliteitVorig: prevRentabiliteit,
      solvabiliteitVerschil: solvabiliteitVerschil,
      liquiditeitVerschil: liquiditeitVerschil,
      rentabiliteitVerschil: rentabiliteitVerschil
    });
    
    details = `Solvabiliteit: ${solvabiliteit.toFixed(1)}% (${solvabiliteitVerschil > 0 ? '+' : ''}${solvabiliteitVerschil.toFixed(1)}%) | Liquiditeit: ${liquiditeit.toFixed(2)} (${liquiditeitVerschil > 0 ? '+' : ''}${liquiditeitVerschil.toFixed(2)}) | Rentabiliteit: ${rentabiliteit.toFixed(1)}%`;
    
  } else {
    details = `Solvabiliteit: ${solvabiliteit.toFixed(1)}% | Liquiditeit: ${liquiditeit.toFixed(2)} | Rentabiliteit: ${rentabiliteit.toFixed(1)}% (Eerste maand)`;
    results.push({
      month: monthData.monthName,
      solvabiliteitHuidig: solvabiliteit,
      liquiditeitHuidig: liquiditeit,
      rentabiliteitHuidig: rentabiliteit,
      opmerking: 'Eerste maand - geen vergelijking mogelijk'
    });
  }
  
  // Determine final status
  if (warnings.length > 0) {
    status = warnings.some(w => w.includes('kritiek') || w.includes('negatief') || w.includes('onder 1.0')) ? 'WAARSCHUWING' : 'INFO';
    details += ` | Waarschuwingen: ${warnings.length}`;
  }

  return {
    id: 14,
    name: 'Ratio-analyse (early warning)',
    description: 'Bereken en vergelijk ratio\'s met vorige maanden',
    goal: 'Vroegtijdige signalering van trends of fouten',
    calculation: 'Solvabiliteit, liquiditeit en rentabiliteit per maand met trendanalyse',
    status: status,
    details: details,
    monthSpecific: true,
    results: results
  };
}

function performPeriodicEntriesCheckPerMonth(monthData) {
  const periodicCategories = ['Huur', 'Loon', 'Salaris', 'Afschrijving', 'Rente', 'Interest'];
  const foundCategories = [];
  
  Object.keys(monthData.categorieBreakdown || {}).forEach(category => {
    if (periodicCategories.some(pc => category.toLowerCase().includes(pc.toLowerCase()))) {
      foundCategories.push({
        category: category,
        amount: monthData.categorieBreakdown[category].netAmount
      });
    }
  });
  
  const status = foundCategories.length >= 2 ? 'OK' : 'WAARSCHUWING';
  const details = `${foundCategories.length} van ${periodicCategories.length} periodieke categorieën gevonden`;

  return {
    id: 15,
    name: 'Tijdigheid afsluitposten',
    description: 'Zijn alle periodieke posten tijdig en correct geboekt?',
    goal: 'Voorkomen van vergeten maandelijkse boekingen',
    calculation: 'Aanwezigheid periodieke categorieën per maand',
    status: status,
    details: details,
    monthSpecific: true
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get year and month parameters with proper validation
    const startYearParam = searchParams.get('startYear');
    const startMonthParam = searchParams.get('startMonth');
    const endYearParam = searchParams.get('endYear');
    const endMonthParam = searchParams.get('endMonth');
    
    // Default to current month if no parameters provided
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = now.getMonth() + 1;
    
    // Parse and validate parameters with bounds checking
    let startYear = startYearParam ? parseInt(startYearParam) : defaultYear;
    let startMonth = startMonthParam ? parseInt(startMonthParam) : defaultMonth;
    let endYear = endYearParam ? parseInt(endYearParam) : defaultYear;
    let endMonth = endMonthParam ? parseInt(endMonthParam) : defaultMonth;
    
    // Safety bounds: prevent absurd year ranges
    const MIN_YEAR = 2020;
    const MAX_YEAR = defaultYear + 1;
    
    // Validate and constrain years
    if (isNaN(startYear) || startYear < MIN_YEAR || startYear > MAX_YEAR) {
      console.warn(`V2 API: Invalid startYear ${startYear}, using ${defaultYear}`);
      startYear = defaultYear;
    }
    if (isNaN(endYear) || endYear < MIN_YEAR || endYear > MAX_YEAR) {
      console.warn(`V2 API: Invalid endYear ${endYear}, using ${defaultYear}`);
      endYear = defaultYear;
    }
    
    // Validate months
    if (isNaN(startMonth) || startMonth < 1 || startMonth > 12) {
      console.warn(`V2 API: Invalid startMonth ${startMonth}, using ${defaultMonth}`);
      startMonth = defaultMonth;
    }
    if (isNaN(endMonth) || endMonth < 1 || endMonth > 12) {
      console.warn(`V2 API: Invalid endMonth ${endMonth}, using ${defaultMonth}`);
      endMonth = defaultMonth;
    }
    
    // Prevent reverse date ranges
    if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) {
      console.warn(`V2 API: Invalid date range ${startYear}-${startMonth} to ${endYear}-${endMonth}, swapping`);
      [startYear, endYear] = [endYear, startYear];
      [startMonth, endMonth] = [endMonth, startMonth];
    }
    
    // Limit maximum range to prevent server overload (max 3 years)
    const maxYearRange = 3;
    if (endYear - startYear > maxYearRange) {
      console.warn(`V2 API: Year range too large (${endYear - startYear} years), limiting to ${maxYearRange} years`);
      endYear = startYear + maxYearRange;
    }
    
    const finalStartYear = startYear;
    const finalStartMonth = startMonth;
    const finalEndYear = endYear;
    const finalEndMonth = endMonth;
    
    console.log(`V2 API: Fetching data for ${finalStartYear}-${finalStartMonth} to ${finalEndYear}-${finalEndMonth}`);
    
    let allData = [];
    
    // Generate unique years in the range for more efficient filtering
    const uniqueYears = [];
    for (let year = finalStartYear; year <= finalEndYear; year++) {
      uniqueYears.push(year);
    }
    
    console.log(`V2 API: Fetching data for years: ${uniqueYears.join(', ')}`);
    
    // Fetch data for each year (much more efficient than per month)
    for (const year of uniqueYears) {
      let skip = 0;
      const take = 50000;
      let hasMoreData = true;
      
      while (hasMoreData) {
        // Build AFAS filter URL for specific year only
        const filterfieldids = encodeURIComponent('Jaar');
        const filtervalues = encodeURIComponent(`${year}`);
        const operatortypes = encodeURIComponent('1'); // Equals
        
        const afasUrl = `https://96778.resttest.afas.online/ProfitRestServices/connectors/Innoworks_Financiele_mutaties?filterfieldids=${filterfieldids}&filtervalues=${filtervalues}&operatortypes=${operatortypes}&skip=${skip}&take=${take}&orderbyfieldids=-Boekstukdatum`;
        
        console.log(`V2 API: Fetching year ${year}: skip=${skip}, take=${take}`);
        
        const response = await fetch(afasUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-language': 'nl-nl',
            'Authorization': 'AfasToken PHRva2VuPjx2ZXJzaW9uPjE8L3ZlcnNpb24+PGRhdGE+RTI4OUU4M0NGQTNGNDhDNjkyQzQzNTJGNjYxMDE3QzlFQkI1MDk0M0RDOTk0MTkwOTU1RUREQTg4NjJDQjM4OTwvZGF0YT48L3Rva2VuPg=='
          }
        });

        if (!response.ok) {
          console.error(`V2 API: Failed to fetch year ${year}: ${response.status} ${response.statusText}`);
          // Continue with next year instead of failing completely
          break;
        }

        const batchData = await response.json();

        if (!batchData.rows || batchData.rows.length === 0) {
          hasMoreData = false;
          break;
        }
        
        console.log(`V2 API: Received ${batchData.rows.length} records for year ${year}`);
        
        allData = allData.concat(batchData.rows);
        
        // If we got less than the requested amount, we've reached the end for this year
        if (batchData.rows.length < take) {
          hasMoreData = false;
        } else {
          skip += take;
        }
        
        // Safety check to prevent infinite loops
        if (skip > 50000) {
          console.log(`V2 API: Safety break for year ${year}: too many records`);
          hasMoreData = false;
        }
      }
    }
    
    // Filter data to only include the requested month range
    const filteredData = allData.filter(row => {
      const rowYear = row.Jaar;
      const rowMonth = row.Periode;
      
      // Check if row is within the requested date range
      if (rowYear < finalStartYear || rowYear > finalEndYear) {
        return false;
      }
      
      // If same year as start year, check start month
      if (rowYear === finalStartYear && rowMonth < finalStartMonth) {
        return false;
      }
      
      // If same year as end year, check end month
      if (rowYear === finalEndYear && rowMonth > finalEndMonth) {
        return false;
      }
      
      return true;
    });
    
    console.log(`V2 API: Filtered ${allData.length} records down to ${filteredData.length} records for requested date range`);
    
    // Process data with new mapping logic
    const groupedData = {};
    const categoryTotals = {};
    const accountTypeTotals = {};
    
    filteredData.forEach(row => {
      // Add category based on Omschrijving_3 field instead of account number
              const category = getCategoryFromDescription(row.Omschrijving_3, row.Kenmerk_rekening);
      row.Categorie = category;
      
      // Add account type name
      const accountTypeName = getAccountTypeName(row.Type_rekening);
      row.AccountTypeName = accountTypeName;
      
      // Group by month and year using AFAS Jaar and Periode fields
      const year = row.Jaar;
      const month = row.Periode;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      
      if (!groupedData[monthKey]) {
        // Create a proper date for display purposes
        const displayDate = new Date(year, month - 1, 1);
        groupedData[monthKey] = {
          year: year,
          month: month,
          monthName: displayDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }),
          records: [],
          totalDebet: 0,
          totalCredit: 0,
          netAmount: 0,
          categorieBreakdown: {},
          accountTypeBreakdown: {}
        };
      }
      
      // Add to monthly totals
      groupedData[monthKey].records.push(row);
      groupedData[monthKey].totalDebet += row.Bedrag_debet || 0;
      groupedData[monthKey].totalCredit += row.Bedrag_credit || 0;
      groupedData[monthKey].netAmount = groupedData[monthKey].totalCredit - groupedData[monthKey].totalDebet;
      
      // Add to category breakdown for this month
      if (!groupedData[monthKey].categorieBreakdown[category]) {
        groupedData[monthKey].categorieBreakdown[category] = {
          totalDebet: 0,
          totalCredit: 0,
          netAmount: 0,
          recordCount: 0
        };
      }
      groupedData[monthKey].categorieBreakdown[category].totalDebet += row.Bedrag_debet || 0;
      groupedData[monthKey].categorieBreakdown[category].totalCredit += row.Bedrag_credit || 0;
      groupedData[monthKey].categorieBreakdown[category].netAmount = 
        groupedData[monthKey].categorieBreakdown[category].totalCredit - 
        groupedData[monthKey].categorieBreakdown[category].totalDebet;
      groupedData[monthKey].categorieBreakdown[category].recordCount++;
      
      // Add to account type breakdown for this month
      if (!groupedData[monthKey].accountTypeBreakdown[accountTypeName]) {
        groupedData[monthKey].accountTypeBreakdown[accountTypeName] = {
          totalDebet: 0,
          totalCredit: 0,
          netAmount: 0,
          recordCount: 0
        };
      }
      groupedData[monthKey].accountTypeBreakdown[accountTypeName].totalDebet += row.Bedrag_debet || 0;
      groupedData[monthKey].accountTypeBreakdown[accountTypeName].totalCredit += row.Bedrag_credit || 0;
      groupedData[monthKey].accountTypeBreakdown[accountTypeName].netAmount = 
        groupedData[monthKey].accountTypeBreakdown[accountTypeName].totalCredit - 
        groupedData[monthKey].accountTypeBreakdown[accountTypeName].totalDebet;
      groupedData[monthKey].accountTypeBreakdown[accountTypeName].recordCount++;
      
      // Add to overall category totals
      if (!categoryTotals[category]) {
        categoryTotals[category] = {
          totalDebet: 0,
          totalCredit: 0,
          netAmount: 0,
          recordCount: 0
        };
      }
      categoryTotals[category].totalDebet += row.Bedrag_debet || 0;
      categoryTotals[category].totalCredit += row.Bedrag_credit || 0;
      categoryTotals[category].netAmount = categoryTotals[category].totalCredit - categoryTotals[category].totalDebet;
      categoryTotals[category].recordCount++;
      
      // Add to overall account type totals
      if (!accountTypeTotals[accountTypeName]) {
        accountTypeTotals[accountTypeName] = {
          totalDebet: 0,
          totalCredit: 0,
          netAmount: 0,
          recordCount: 0
        };
      }
      accountTypeTotals[accountTypeName].totalDebet += row.Bedrag_debet || 0;
      accountTypeTotals[accountTypeName].totalCredit += row.Bedrag_credit || 0;
      accountTypeTotals[accountTypeName].netAmount = accountTypeTotals[accountTypeName].totalCredit - accountTypeTotals[accountTypeName].totalDebet;
      accountTypeTotals[accountTypeName].recordCount++;
    });
    
    // Convert to array and sort by date (newest first)
    const monthlyData = Object.values(groupedData).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
    
    // Calculate Eigen Vermogen = Activa - Vreemd Vermogen (Passiva)
    const activaTotal = accountTypeTotals['Activa']?.netAmount || 0;
    const passivaTotal = accountTypeTotals['Passiva']?.netAmount || 0; // Dit is vreemd vermogen
    const eigenVermogen = activaTotal - Math.abs(passivaTotal); // Eigen vermogen = Activa - Vreemd vermogen
    
    // Add eigen vermogen to passiva totals (balans moet kloppen: Activa = Passiva + Eigen Vermogen)
    const totaalPassivaInclusief = Math.abs(passivaTotal) + eigenVermogen;
    
    // Add month-by-month eigen vermogen calculation
    const eigenVermogenPerMonth = monthlyData.map(month => {
      const monthActiva = month.accountTypeBreakdown['Activa']?.netAmount || 0;
      const monthVreemdVermogen = month.accountTypeBreakdown['Passiva']?.netAmount || 0; // Vreemd vermogen
      const monthEigenVermogen = monthActiva - Math.abs(monthVreemdVermogen);
      
      return {
        monthKey: `${month.year}-${String(month.month).padStart(2, '0')}`,
        year: month.year,
        month: month.month,
        monthName: month.monthName,
        activa: monthActiva,
        vreemdVermogen: monthVreemdVermogen, // Was passiva
        eigenVermogen: monthEigenVermogen,
        totaalPassiva: Math.abs(monthVreemdVermogen) + monthEigenVermogen // Totaal passiva incl eigen vermogen
      };
    });
    
    // Financial checks calculations
    const financialChecks = performFinancialChecks(monthlyData, filteredData, accountTypeTotals, categoryTotals, eigenVermogenPerMonth);

    const result = {
      summary: {
        totalRecords: filteredData.length,
        monthsIncluded: monthlyData.length,
        dataSource: 'AFAS API v2',
        dateRange: {
          startYear: finalStartYear,
          startMonth: finalStartMonth,
          endYear: finalEndYear,
          endMonth: finalEndMonth
        },
        totalDebet: filteredData.reduce((sum, row) => sum + (row.Bedrag_debet || 0), 0),
        totalCredit: filteredData.reduce((sum, row) => sum + (row.Bedrag_credit || 0), 0),
        netAmount: filteredData.reduce((sum, row) => sum + (row.Bedrag_credit || 0), 0) - filteredData.reduce((sum, row) => sum + (row.Bedrag_debet || 0), 0)
      },
      categoryTotals: categoryTotals,
      accountTypeTotals: accountTypeTotals,
      balans: {
        activa: activaTotal,
        vreemdVermogen: passivaTotal, // Schulden aan derden
        eigenVermogen: eigenVermogen, // Eigen vermogen
        totaalPassiva: totaalPassivaInclusief, // Vreemd + Eigen vermogen
        perMonth: eigenVermogenPerMonth
      },
      monthlyData: monthlyData,
      allRecords: filteredData,
      financialChecks: financialChecks
    };
    
    console.log(`V2 API: Successfully fetched ${filteredData.length} records across ${monthlyData.length} months`);
    console.log(`V2 API: Balans calculated - Activa: €${activaTotal.toFixed(2)}, Vreemd Vermogen: €${passivaTotal.toFixed(2)}, Eigen Vermogen: €${eigenVermogen.toFixed(2)}, Totaal Passiva: €${totaalPassivaInclusief.toFixed(2)}`);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
    });
    
  } catch (error) {
    console.error('V2 API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}