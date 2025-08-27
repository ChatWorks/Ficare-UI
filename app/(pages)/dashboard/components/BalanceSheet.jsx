'use client';

import { useState } from 'react';
import { formatCurrency } from '../utils/formatters'; 

export default function BalanceSheet({ data, allRecords, setSelectedCategory, setSelectedMonth }) {
  // State for collapsed/expanded categories - start with all collapsed
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [allCollapsed, setAllCollapsed] = useState(true);
  // Get all unique months from the data
  const allMonthsFromData = [...new Set(data.monthlyData?.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`) || [])].sort();
  
  // Filter to only show months within the original requested period (exclude the extra month added for cash flow calculations)
  const originalPeriod = data.originalPeriod;
  const allMonths = originalPeriod ? allMonthsFromData.filter(monthKey => {
    const [year, month] = monthKey.split('-').map(x => parseInt(x));
    // Only include months within the original requested period
    if (year < originalPeriod.startYear || year > originalPeriod.endYear) return false;
    if (year === originalPeriod.startYear && month < originalPeriod.startMonth) return false;
    if (year === originalPeriod.endYear && month > originalPeriod.endMonth) return false;
    return true;
  }) : allMonthsFromData;
  
  // Create month names for headers
  const monthHeaders = allMonths.map(monthKey => {
    const [year, month] = monthKey.split('-');
    return {
      key: monthKey,
      name: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
    };
  });

  // Helper function to get amount for a specific account in a specific month
  const getAccountAmountForMonth = (monthKey, rekeningnummer, omschrijving2) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const accountRecords = monthData?.records?.filter(r => 
      r.Rekeningnummer === rekeningnummer && r.Omschrijving_2 === omschrijving2
    ) || [];
    return accountRecords.reduce((sum, r) => sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)), 0);
  };

  // Helper function to get total amount for an account across all months
  const getAccountTotalAmount = (rekeningnummer, omschrijving2) => {
    const accountRecords = data.allRecords?.filter(r => 
      r.Rekeningnummer === rekeningnummer && r.Omschrijving_2 === omschrijving2
    ) || [];
    return accountRecords.reduce((sum, r) => sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)), 0);
  };

  // Helper function to check if category is Debiteur/Crediteur (defensive)
  const isDebiteurCrediteur = (categorie) => {
    if (!categorie) return false;
    const cat = categorie.toLowerCase();
    return cat.includes('debiteur') || cat.includes('crediteur');
  };

  // Helper function to get category total for a specific month
  const getCategoryAmountForMonth = (monthKey, typeRekening, categorie) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const categoryRecords = monthData?.records?.filter(r => 
      r.Type_rekening === typeRekening && (r.Omschrijving_3 || r.Categorie || 'Overig') === categorie
    ) || [];
    return categoryRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Helper function to get category total across all months
  const getCategoryTotalAmount = (typeRekening, categorie) => {
    const categoryRecords = data.allRecords?.filter(r => 
      r.Type_rekening === typeRekening && (r.Omschrijving_3 || r.Categorie || 'Overig') === categorie
    ) || [];
    return categoryRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Toggle category collapse/expand
  const toggleCategory = (categoryKey) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryKey)) {
      newCollapsed.delete(categoryKey);
    } else {
      newCollapsed.add(categoryKey);
    }
    setCollapsedCategories(newCollapsed);
  };

  // Toggle all categories
  const toggleAll = () => {
    if (allCollapsed) {
      // Expand all - clear the collapsed set
      setCollapsedCategories(new Set());
      setAllCollapsed(false);
    } else {
      // Collapse all - add all categories to collapsed set
      const allCategoryKeys = [];
      Object.keys(balanceHierarchy).forEach(typeRekening => {
        Object.keys(balanceHierarchy[typeRekening]).forEach(categorie => {
          if (!balanceHierarchy[typeRekening][categorie].isDebiteurCrediteur) {
            allCategoryKeys.push(`${typeRekening}-${categorie}`);
          }
        });
      });
      setCollapsedCategories(new Set(allCategoryKeys));
      setAllCollapsed(true);
    }
  };

  // Initialize collapsed state based on hierarchy
  const initializeCollapsedState = () => {
    if (allCollapsed && collapsedCategories.size === 0) {
      const allCategoryKeys = [];
      Object.keys(balanceHierarchy).forEach(typeRekening => {
        Object.keys(balanceHierarchy[typeRekening]).forEach(categorie => {
          if (!balanceHierarchy[typeRekening][categorie].isDebiteurCrediteur) {
            allCategoryKeys.push(`${typeRekening}-${categorie}`);
          }
        });
      });
      setCollapsedCategories(new Set(allCategoryKeys));
    }
  };

  // Build hierarchical structure: Type_rekening > Omschrijving_3 > Omschrijving_2 + Rekeningnummer
  const buildHierarchy = () => {
    const hierarchy = {};
    
    data.allRecords?.forEach(record => {
      const typeRekening = record.Type_rekening;
      const categorie = record.Omschrijving_3 || record.Categorie || 'Overig';
      const rekening = record.Omschrijving_2 || 'Onbekend';
      const rekeningnummer = record.Rekeningnummer || '';
      
      if (!typeRekening || (typeRekening !== 'Activa' && typeRekening !== 'Passiva')) return;
      
      if (!hierarchy[typeRekening]) {
        hierarchy[typeRekening] = {};
      }
      
      if (!hierarchy[typeRekening][categorie]) {
        hierarchy[typeRekening][categorie] = {
          accounts: {},
          isDebiteurCrediteur: isDebiteurCrediteur(categorie),
          totalAmount: 0
        };
      }
      
      // For Debiteur/Crediteur, don't show individual accounts, just aggregate
      if (isDebiteurCrediteur(categorie)) {
        // Don't add individual accounts for Debiteur/Crediteur
        return;
      }
      
      const accountKey = `${rekening}|${rekeningnummer}`;
      if (!hierarchy[typeRekening][categorie].accounts[accountKey]) {
        hierarchy[typeRekening][categorie].accounts[accountKey] = {
          rekening,
          rekeningnummer,
          totalAmount: 0
        };
      }
    });
    
    // Calculate totals for each account and category
    Object.keys(hierarchy).forEach(typeRekening => {
      Object.keys(hierarchy[typeRekening]).forEach(categorie => {
        const categoryData = hierarchy[typeRekening][categorie];
        
        if (categoryData.isDebiteurCrediteur) {
          // For Debiteur/Crediteur, calculate total directly
          categoryData.totalAmount = getCategoryTotalAmount(typeRekening, categorie);
        } else {
          // For other categories, calculate totals for each account
          Object.keys(categoryData.accounts).forEach(accountKey => {
            const account = categoryData.accounts[accountKey];
            account.totalAmount = getAccountTotalAmount(account.rekeningnummer, account.rekening);
          });
          
          // Calculate category total
          categoryData.totalAmount = Object.values(categoryData.accounts).reduce((sum, account) => sum + account.totalAmount, 0);
        }
      });
    });
    
    return hierarchy;
  };

  const balanceHierarchy = buildHierarchy();
  
  // Initialize collapsed state when hierarchy is built
  initializeCollapsedState();

  // Helper function to calculate type totals (Activa/Passiva) for a specific month
  const getTypeTotalForMonth = (monthKey, typeRekening) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const typeRecords = monthData?.records?.filter(r => r.Type_rekening === typeRekening) || [];
    return typeRecords.reduce((sum, r) => sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)), 0);
  };

  // Helper function to calculate type total across all months
  const getTypeTotal = (typeRekening) => {
    const typeRecords = data.allRecords?.filter(r => r.Type_rekening === typeRekening) || [];
    return typeRecords.reduce((sum, r) => sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)), 0);
  };

  // Helper function to calculate balance difference (Activa + Passiva) for a specific month
  const getBalanceDifferenceForMonth = (monthKey) => {
    const activa = getTypeTotalForMonth(monthKey, 'Activa');
    const passiva = getTypeTotalForMonth(monthKey, 'Passiva');
    return activa + passiva;
  };

  // Helper function to calculate total balance difference across all months
  const getTotalBalanceDifference = () => {
    const activa = getTypeTotal('Activa');
    const passiva = getTypeTotal('Passiva');
    return activa + passiva;
  };

  // Helper function to calculate W&V result (Opbrengsten - abs(Kosten)) for a specific month
  const getWvResultForMonth = (monthKey) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const opbrengstenRecords = monthData?.records?.filter(r => 
      r.Type_rekening === 'Opbrengsten' && r.Kenmerk_rekening === "Grootboekrekening"
    ) || [];
    const kostenRecords = monthData?.records?.filter(r => 
      r.Type_rekening === 'Kosten' && r.Kenmerk_rekening === "Grootboekrekening"
    ) || [];
    
    const opbrengsten = opbrengstenRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
    const kosten = Math.abs(kostenRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0));
    return opbrengsten - kosten;
  };

  // Helper function to calculate total W&V result across all months
  const getTotalWvResult = () => {
    const opbrengstenRecords = data.allRecords?.filter(r => 
      r.Type_rekening === 'Opbrengsten' && r.Kenmerk_rekening === "Grootboekrekening"
    ) || [];
    const kostenRecords = data.allRecords?.filter(r => 
      r.Type_rekening === 'Kosten' && r.Kenmerk_rekening === "Grootboekrekening"
    ) || [];
    
    const opbrengsten = opbrengstenRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
    const kosten = Math.abs(kostenRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0));
    return opbrengsten - kosten;
  };

  // Helper function to calculate balance check (abs(balance) - abs(wv_result)) for a specific month
  const getBalanceCheckForMonth = (monthKey) => {
    const balanceDiff = Math.abs(getBalanceDifferenceForMonth(monthKey));
    const wvResult = Math.abs(getWvResultForMonth(monthKey));
    return balanceDiff - wvResult;
  };

  // Helper function to calculate total balance check across all months
  const getTotalBalanceCheck = () => {
    const balanceDiff = Math.abs(getTotalBalanceDifference());
    const wvResult = Math.abs(getTotalWvResult());
    return balanceDiff - wvResult;
  };

  // Calculate opening balance (all transactions before the first month)
  const calculateOpeningBalance = () => {
    console.log(`[OPENING-BALANCE] Starting calculation...`);
    console.log(`[OPENING-BALANCE] Data available:`, !!data);
    console.log(`[OPENING-BALANCE] AllRecords prop available:`, !!allRecords);
    console.log(`[OPENING-BALANCE] AllRecords length:`, allRecords?.length || 0);
    console.log(`[OPENING-BALANCE] AllMonths:`, allMonths);
    
    if (!allRecords || !Array.isArray(allRecords) || allMonths.length === 0) {
      console.log(`[OPENING-BALANCE] No allRecords available for calculation`);
      return null;
    }
    
    const firstMonth = allMonths[0];
    const [firstYear, firstMonthNum] = firstMonth.split('-').map(x => parseInt(x));
    
    console.log(`[OPENING-BALANCE] Calculating for period before ${firstYear}-${firstMonthNum}`);
    console.log(`[OPENING-BALANCE] Sample allRecords:`, allRecords.slice(0, 3));
    
    // Filter all records to only include those BEFORE the first month
    const openingRecords = allRecords.filter(row => {
      const rowYear = row.Jaar;
      const rowMonth = row.Periode;
      
      // Only include records before the period start
      if (rowYear < firstYear) return true;
      if (rowYear === firstYear && rowMonth < firstMonthNum) return true;
      return false;
    });
    
    console.log(`[OPENING-BALANCE] Found ${openingRecords.length} opening balance records`);
    console.log(`[OPENING-BALANCE] Sample opening records:`, openingRecords.slice(0, 3));
    
    // Calculate totals per account type
    const totals = {
      activa: 0,
      passiva: 0,
      kosten: 0,
      opbrengsten: 0
    };
    
    openingRecords.forEach(row => {
      const debet = row.Bedrag_debet || 0;
      const credit = row.Bedrag_credit || 0;
      const netAmount = debet - credit;
      const typeRekening = row.Type_rekening;
      
      if (typeRekening === 'Activa') {
        totals.activa += netAmount;
      } else if (typeRekening === 'Passiva') {
        totals.passiva += netAmount;
      } else if (typeRekening === 'Kosten') {
        totals.kosten += netAmount;
      } else if (typeRekening === 'Opbrengsten') {
        totals.opbrengsten += netAmount;
      }
    });
    
    console.log(`[OPENING-BALANCE] Calculated totals:`, totals);
    
    // Calculate opening balance eigen vermogen
    const openingEigenVermogen = totals.activa + totals.passiva;
    
    // For balance sheet, we need to include accumulated P&L in eigen vermogen
    const accumulatedResult = totals.opbrengsten + totals.kosten; // Kosten are typically negative
    const totalOpeningEigenVermogen = openingEigenVermogen + accumulatedResult;
    
    console.log(`[OPENING-BALANCE] Final calculations:`, {
      activa: totals.activa,
      passiva: Math.abs(totals.passiva),
      eigenVermogen: totalOpeningEigenVermogen,
      accumulatedPL: accumulatedResult
    });
    
    const result = {
      activa: totals.activa,
      passiva: Math.abs(totals.passiva), // Make passiva positive for display
      eigenVermogen: totalOpeningEigenVermogen,
      totaalPassiva: Math.abs(totals.passiva) + totalOpeningEigenVermogen,
      accumulatedPL: accumulatedResult,
      recordCount: openingRecords.length,
      periodBefore: firstMonth
    };
    
    console.log(`[OPENING-BALANCE] Returning result:`, result);
    return result;
  };

  const openingBalance = calculateOpeningBalance();

  return (
    <div className="space-y-6">
      
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Balans - Periode Mutaties</h2>
        <p className="text-slate-600">Hiërarchische balans per maand (exclusief openingsbalans)</p>
      </div>
      
      {/* Toggle All Button */}
      <div className="flex justify-end">
                <button
          onClick={toggleAll}
          className="flex items-center px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-300"
        >
          <span className="mr-2 text-xs">
            {allCollapsed ? '▶' : '▼'}
          </span>
          {allCollapsed ? 'Alles uitklappen' : 'Alles inklappen'}
                </button>
              </div>

      {/* Hierarchical Balance Sheet with Monthly Columns */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="border-b-2 border-slate-300">
                <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-slate-100 z-10 min-w-[300px] text-sm text-slate-900 border-r border-slate-300">
                  BALANSPOST
                </th>
                {monthHeaders.map(month => (
                  <th key={month.key} className="px-4 py-3 text-center font-semibold min-w-[120px] text-sm text-slate-900 border-r border-slate-200">
                    {month.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold bg-slate-200 min-w-[120px] text-sm text-slate-900 border-l-2 border-slate-400">
                  TOTAAL
                </th>
              </tr>
            </thead>
                         <tbody className="bg-white">
               {Object.entries(balanceHierarchy).map(([typeRekening, categories]) => {
                 let rowIndex = 0;
                 const rows = [];
                 
                 // Type header (Activa/Passiva)
                 rows.push(
                   <tr key={`${typeRekening}-header`} className="bg-slate-200 border-b border-slate-300">
                     <td className="px-4 py-3 text-sm font-bold text-slate-900 sticky left-0 bg-slate-200 border-r border-slate-400 z-20">
                       {typeRekening.toUpperCase()}
                     </td>
                     {monthHeaders.map(month => (
                       <td key={month.key} className="px-4 py-3 text-center text-sm border-r border-slate-300"></td>
                     ))}
                     <td className="px-4 py-3 text-center text-sm bg-slate-300 border-l-2 border-slate-500"></td>
                   </tr>
                 );

                 Object.entries(categories).forEach(([categorie, categoryData]) => {
                   const categoryKey = `${typeRekening}-${categorie}`;
                   const isCollapsed = collapsedCategories.has(categoryKey);
                   
                   // Category header (Omschrijving_3) - Always clickable for expand/collapse
                   rows.push(
                     <tr key={`${categoryKey}-header`} className="bg-slate-100 border-b border-slate-200">
                       <td className="px-6 py-2 text-sm font-semibold text-slate-800 sticky left-0 bg-slate-100 border-r border-slate-300">
                         <button
                           onClick={() => !categoryData.isDebiteurCrediteur && toggleCategory(categoryKey)}
                           className={`flex items-center w-full text-left ${!categoryData.isDebiteurCrediteur ? 'hover:text-slate-900' : ''}`}
                         >
                           {!categoryData.isDebiteurCrediteur && (
                             <span className="mr-2 text-xs">
                               {isCollapsed ? '▶' : '▼'}
                             </span>
                           )}
                           {categorie}
                         </button>
                       </td>
                       {monthHeaders.map(month => {
                         const monthAmount = getCategoryAmountForMonth(month.key, typeRekening, categorie);
                         return (
                           <td key={month.key} className="px-4 py-2 text-center text-sm border-r border-slate-200">
                             {monthAmount !== 0 ? (
                               <button
                                 onClick={() => {
                                   setSelectedCategory(categorie);
                                   setSelectedMonth(month.key);
                                 }}
                                 className={`hover:underline font-semibold ${
                                   monthAmount >= 0 ? 'text-slate-700' : 'text-red-700'
                                 }`}
                               >
                                 {formatCurrency(monthAmount)}
                               </button>
                             ) : '-'}
                           </td>
                         );
                       })}
                       <td className="px-4 py-2 text-center text-sm font-semibold bg-slate-50 border-l-2 border-slate-400">
                         {categoryData.totalAmount !== 0 ? (
                <button
                  onClick={() => {
                               setSelectedCategory(categorie);
                    setSelectedMonth(null);
                  }}
                             className={`hover:underline font-semibold ${
                               categoryData.totalAmount >= 0 ? 'text-slate-700' : 'text-red-700'
                  }`}
                >
                             {formatCurrency(categoryData.totalAmount)}
                </button>
                         ) : '-'}
                       </td>
                     </tr>
                   );

                   // Show individual accounts only if not collapsed and not Debiteur/Crediteur
                   if (!isCollapsed && !categoryData.isDebiteurCrediteur) {
                     Object.entries(categoryData.accounts).forEach(([accountKey, account]) => {
                       rowIndex++;
                       rows.push(
                         <tr key={`${categoryKey}-${accountKey}`} className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200 hover:bg-blue-50`}>
                           <td className="px-8 py-2 text-sm text-slate-900 sticky left-0 bg-inherit border-r border-slate-300">
                             <div>
                               <span className="font-medium">{account.rekening}</span>
                               {account.rekeningnummer && (
                                 <span className="ml-2 text-xs text-slate-500">({account.rekeningnummer})</span>
                               )}
              </div>
                           </td>
                                                     {monthHeaders.map(month => {
                            const monthAmount = getAccountAmountForMonth(month.key, account.rekeningnummer, account.rekening);
                            return (
                              <td key={month.key} className="px-4 py-2 text-center text-sm border-r border-slate-200">
                                {monthAmount !== 0 ? (
                                  <span className={`font-semibold ${monthAmount >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
                                    {formatCurrency(monthAmount)}
                                  </span>
                                ) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2 text-center text-sm font-semibold bg-slate-50 border-l-2 border-slate-400">
                            {account.totalAmount !== 0 ? (
                              <span className={`font-semibold ${account.totalAmount >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
                                {formatCurrency(account.totalAmount)}
                              </span>
                            ) : '-'}
                          </td>
                         </tr>
                       );
                     });
                   }
                 });

                 // Add total row for this type (Activa/Passiva)
                 rows.push(
                   <tr key={`${typeRekening}-total`} className="bg-slate-300 border-y-2 border-slate-500">
                     <td className="px-4 py-3 text-sm font-bold text-slate-900 sticky left-0 bg-slate-300 border-r border-slate-500 z-20">
                       TOTAAL {typeRekening.toUpperCase()}
                     </td>
                     {monthHeaders.map(month => {
                       const monthTotal = getTypeTotalForMonth(month.key, typeRekening);
                       return (
                         <td key={month.key} className="px-4 py-3 text-center text-sm font-bold border-r border-slate-400">
                           <button
                             onClick={() => {
                               setSelectedCategory(typeRekening);
                               setSelectedMonth(month.key);
                             }}
                             className={`hover:underline font-bold ${
                               monthTotal >= 0 ? 'text-slate-900' : 'text-red-700'
                             }`}
                           >
                             {formatCurrency(monthTotal)}
                           </button>
                         </td>
                       );
                     })}
                     <td className="px-4 py-3 text-center text-sm font-bold bg-slate-400 border-l-2 border-slate-600">
                       <button
                         onClick={() => {
                           setSelectedCategory(typeRekening);
                           setSelectedMonth(null);
                         }}
                         className={`hover:underline font-bold ${
                           getTypeTotal(typeRekening) >= 0 ? 'text-slate-900' : 'text-red-700'
                         }`}
                       >
                         {formatCurrency(getTypeTotal(typeRekening))}
                       </button>
                     </td>
                   </tr>
                 );

                                 return rows;
              })}
              
              {/* BALANS VERSCHIL Section */}
              <tr className="bg-slate-500 border-y-3 border-slate-700">
                <td className="px-4 py-4 text-sm font-bold text-white sticky left-0 bg-slate-500 border-r border-slate-700 z-20">
                  BALANS VERSCHIL (ACTIVA + PASSIVA)
                </td>
                {monthHeaders.map(month => {
                  const difference = getBalanceDifferenceForMonth(month.key);
                  return (
                    <td key={month.key} className="px-4 py-4 text-center text-sm font-bold border-r border-slate-600">
                      <span className={difference >= 0 ? 'text-white' : 'text-red-200'}>
                        {formatCurrency(difference)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-4 text-center text-sm font-bold bg-slate-600 border-l-2 border-slate-800">
                  <span className={getTotalBalanceDifference() >= 0 ? 'text-white' : 'text-red-200'}>
                    {formatCurrency(getTotalBalanceDifference())}
            </span>
                </td>
              </tr>
              
              {/* NETTO RESULTAAT Section */}
              <tr className="bg-slate-400 border-y-3 border-slate-600">
                <td className="px-4 py-4 text-sm font-bold text-white sticky left-0 bg-slate-400 border-r border-slate-600 z-20">
                  NETTO RESULTAAT (W&V)
                </td>
                {monthHeaders.map(month => {
                  const result = getWvResultForMonth(month.key);
                  return (
                    <td key={month.key} className="px-4 py-4 text-center text-sm font-bold border-r border-slate-500">
                      <span className={result >= 0 ? 'text-white' : 'text-red-200'}>
                        {formatCurrency(result)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-4 text-center text-sm font-bold bg-slate-500 border-l-2 border-slate-700">
                  <span className={getTotalWvResult() >= 0 ? 'text-white' : 'text-red-200'}>
                    {formatCurrency(getTotalWvResult())}
            </span>
                </td>
              </tr>
              
              {/* BALANS CONTROLE Section */}
              <tr className="bg-slate-600 border-y-3 border-slate-800">
                <td className="px-4 py-4 text-sm font-bold text-white sticky left-0 bg-slate-600 border-r border-slate-800 z-20">
                  BALANS CONTROLE (|BALANS| - |W&V|)
                </td>
                {monthHeaders.map(month => {
                  const check = getBalanceCheckForMonth(month.key);
                  return (
                    <td key={month.key} className="px-4 py-4 text-center text-sm font-bold border-r border-slate-700">
                      <span className={Math.abs(check) < 0.01 ? 'text-green-200' : 'text-red-200'}>
                        {formatCurrency(check)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-4 text-center text-sm font-bold bg-slate-700 border-l-2 border-slate-900">
                  <span className={Math.abs(getTotalBalanceCheck()) < 0.01 ? 'text-green-200' : 'text-red-200'}>
                    {formatCurrency(getTotalBalanceCheck())}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Balans Summary - moved to bottom */}
      <div className="bg-white border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Balans Controle</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-4 text-center">
            <p className="text-sm font-medium text-slate-600 mb-2">Totaal Activa</p>
            <p className="text-2xl font-bold text-slate-700">
              {formatCurrency(data.balans?.activa || 0)}
            </p>
            </div>
          <div className="bg-slate-50 p-4 text-center">
            <p className="text-sm font-medium text-slate-600 mb-2">Totaal Passiva</p>
            <p className="text-2xl font-bold text-slate-700">
              {formatCurrency(data.balans?.totaalPassiva || 0)}
            </p>
        </div>
          <div className="bg-slate-50 p-4 text-center">
            <p className="text-sm font-medium text-slate-600 mb-2">Balansverschil</p>
            <p className={`text-2xl font-bold ${Math.abs(data.balans?.balansVerschil || 0) < 0.01 ? 'text-slate-700' : 'text-red-700'}`}>
              {formatCurrency(data.balans?.balansVerschil || 0)}
              {Math.abs(data.balans?.balansVerschil || 0) < 0.01 && <span className="ml-2 text-slate-600">✓</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Opening Balance Section - moved to bottom */}
      {openingBalance && openingBalance.recordCount > 0 ? (
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-slate-800">
              Openingsbalans (0-balans)
            </h3>
            <div className="text-sm text-slate-600">
              {openingBalance.recordCount.toLocaleString()} transacties vóór {new Date(openingBalance.periodBefore + '-01').toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded p-3 border">
              <div className="text-xs text-green-700 font-medium mb-1">ACTIVA</div>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(openingBalance.activa)}
              </div>
            </div>
            
            <div className="bg-white rounded p-3 border">
              <div className="text-xs text-red-700 font-medium mb-1">VREEMD VERMOGEN</div>
              <div className="text-lg font-bold text-red-600">
                {formatCurrency(openingBalance.passiva)}
              </div>
            </div>
            
            <div className="bg-white rounded p-3 border">
              <div className="text-xs text-blue-700 font-medium mb-1">EIGEN VERMOGEN</div>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(openingBalance.eigenVermogen)}
              </div>
            </div>
          </div>
          
          {/* Balance Check - Compact */}
          <div className="mt-3 pt-3 border-t border-slate-200 text-center">
            <span className="text-xs text-slate-600">Balans Controle: </span>
            <span className={`text-xs font-bold ${
              Math.abs(openingBalance.activa - openingBalance.totaalPassiva) < 0.01 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {formatCurrency(openingBalance.activa - openingBalance.totaalPassiva)}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3">
          <div className="flex items-center gap-2">
            <div className="text-yellow-600">⚠️</div>
            <div className="text-sm text-yellow-700">
              Geen openingsbalans beschikbaar - alle data valt binnen de geselecteerde periode
              {openingBalance && (
                <span className="block text-xs text-yellow-600 mt-1">
                  Debug: {openingBalance.recordCount} records gevonden voor periode vóór {openingBalance.periodBefore}
                </span>
              )}
              {!openingBalance && (
                <span className="block text-xs text-yellow-600 mt-1">
                  Debug: openingBalance is null - geen data beschikbaar
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
