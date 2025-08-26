'use client';

import { useState } from 'react';
import { formatCurrency } from '../utils/formatters';

export default function ManagementRapportage({ data, setSelectedCategory, setSelectedMonth }) {
  // State for collapsed/expanded categories - start with all collapsed
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [allCollapsed, setAllCollapsed] = useState(true);

  // Get all unique months from the data
  const allMonths = [...new Set(data.monthlyData?.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`) || [])].sort();
  
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
      r.Rekeningnummer === rekeningnummer && 
      r.Omschrijving_2 === omschrijving2 && 
      r.Kenmerk_rekening === "Grootboekrekening" &&
      (r.Type_rekening === "Kosten" || r.Type_rekening === "Opbrengsten")
    ) || [];
    return accountRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Helper function to get total amount for an account across all months
  const getAccountTotalAmount = (rekeningnummer, omschrijving2) => {
    const accountRecords = data.allRecords?.filter(r => 
      r.Rekeningnummer === rekeningnummer && 
      r.Omschrijving_2 === omschrijving2 && 
      r.Kenmerk_rekening === "Grootboekrekening" &&
      (r.Type_rekening === "Kosten" || r.Type_rekening === "Opbrengsten")
    ) || [];
    return accountRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Helper function to get category total for a specific month
  const getCategoryAmountForMonth = (monthKey, typeRekening, categorie) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const categoryRecords = monthData?.records?.filter(r => 
      r.Type_rekening === typeRekening && 
      (r.Omschrijving_3 || r.Categorie || 'Overig') === categorie &&
      r.Kenmerk_rekening === "Grootboekrekening"
    ) || [];
    return categoryRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Helper function to get category total across all months
  const getCategoryTotalAmount = (typeRekening, categorie) => {
    const categoryRecords = data.allRecords?.filter(r => 
      r.Type_rekening === typeRekening && 
      (r.Omschrijving_3 || r.Categorie || 'Overig') === categorie &&
      r.Kenmerk_rekening === "Grootboekrekening"
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
      Object.keys(wvHierarchy).forEach(typeRekening => {
        Object.keys(wvHierarchy[typeRekening]).forEach(categorie => {
          allCategoryKeys.push(`${typeRekening}-${categorie}`);
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
      Object.keys(wvHierarchy).forEach(typeRekening => {
        Object.keys(wvHierarchy[typeRekening]).forEach(categorie => {
          allCategoryKeys.push(`${typeRekening}-${categorie}`);
        });
      });
      setCollapsedCategories(new Set(allCategoryKeys));
    }
  };

  // Build hierarchical structure: Type_rekening > Omschrijving_3 > Omschrijving_2 + Rekeningnummer
  const buildWvHierarchy = () => {
    const hierarchy = {};
    
    data.allRecords?.forEach(record => {
      const typeRekening = record.Type_rekening;
      const categorie = record.Omschrijving_3 || record.Categorie || 'Overig';
      const rekening = record.Omschrijving_2 || 'Onbekend';
      const rekeningnummer = record.Rekeningnummer || '';
      
      if (!typeRekening || (typeRekening !== 'Kosten' && typeRekening !== 'Opbrengsten')) return;
      if (record.Kenmerk_rekening !== "Grootboekrekening") return;
      
      if (!hierarchy[typeRekening]) {
        hierarchy[typeRekening] = {};
      }
      
      if (!hierarchy[typeRekening][categorie]) {
        hierarchy[typeRekening][categorie] = {
          accounts: {},
          totalAmount: 0
        };
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
        
        // Calculate totals for each account
        Object.keys(categoryData.accounts).forEach(accountKey => {
          const account = categoryData.accounts[accountKey];
          account.totalAmount = getAccountTotalAmount(account.rekeningnummer, account.rekening);
        });
        
        // Calculate category total
        categoryData.totalAmount = getCategoryTotalAmount(typeRekening, categorie);
      });
    });
    
    return hierarchy;
  };

  const wvHierarchy = buildWvHierarchy();
  
  // Initialize collapsed state when hierarchy is built
  initializeCollapsedState();

  // Helper function to calculate type totals (Kosten/Opbrengsten) for a specific month
  const getTypeTotalForMonth = (monthKey, typeRekening) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const typeRecords = monthData?.records?.filter(r => 
      r.Type_rekening === typeRekening && r.Kenmerk_rekening === "Grootboekrekening"
    ) || [];
    return typeRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Helper function to calculate type total across all months
  const getTypeTotal = (typeRekening) => {
    const typeRecords = data.allRecords?.filter(r => 
      r.Type_rekening === typeRekening && r.Kenmerk_rekening === "Grootboekrekening"
    ) || [];
    return typeRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Helper function to calculate result (Opbrengsten - abs(Kosten)) for a specific month
  const getResultForMonth = (monthKey) => {
    const opbrengsten = getTypeTotalForMonth(monthKey, 'Opbrengsten');
    const kosten = Math.abs(getTypeTotalForMonth(monthKey, 'Kosten'));
    return opbrengsten - kosten;
  };

  // Helper function to calculate total result across all months
  const getTotalResult = () => {
    const opbrengsten = getTypeTotal('Opbrengsten');
    const kosten = Math.abs(getTypeTotal('Kosten'));
    return opbrengsten - kosten;
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Kosten & Opbrengsten</h2>
        <p className="text-slate-600">Hiërarchische kosten & opbrengsten per maand</p>
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
      
      {/* Hierarchical W&V with Monthly Columns */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="border-b-2 border-slate-300">
                <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-slate-100 z-10 min-w-[300px] text-sm text-slate-900 border-r border-slate-300">
                  W&V POST
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
              {/* Ensure Opbrengsten comes first, then Kosten */}
              {['Opbrengsten', 'Kosten'].filter(type => wvHierarchy[type]).map(typeRekening => {
                const categories = wvHierarchy[typeRekening];
                let rowIndex = 0;
                const rows = [];
                
                // Type header (Kosten/Opbrengsten)
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
                          onClick={() => toggleCategory(categoryKey)}
                          className="flex items-center w-full text-left hover:text-slate-900"
                        >
                          <span className="mr-2 text-xs">
                            {isCollapsed ? '▶' : '▼'}
                          </span>
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

                  // Show individual accounts only if not collapsed
                  if (!isCollapsed) {
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

                // Add total row for this type (Opbrengsten/Kosten)
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
              
              {/* RESULTAAT Section */}
              <tr className="bg-slate-400 border-y-3 border-slate-600">
                <td className="px-4 py-4 text-sm font-bold text-white sticky left-0 bg-slate-400 border-r border-slate-600 z-20">
                  NETTO RESULTAAT
                </td>
                {monthHeaders.map(month => {
                  const result = getResultForMonth(month.key);
                  return (
                    <td key={month.key} className="px-4 py-4 text-center text-sm font-bold border-r border-slate-500">
                      <span className={result >= 0 ? 'text-white' : 'text-red-200'}>
                        {formatCurrency(result)}
                    </span>
                  </td>
                  );
                })}
                <td className="px-4 py-4 text-center text-sm font-bold bg-slate-500 border-l-2 border-slate-700">
                  <span className={getTotalResult() >= 0 ? 'text-white' : 'text-red-200'}>
                    {formatCurrency(getTotalResult())}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
