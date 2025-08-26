'use client';

import { useState } from 'react';
import { formatCurrency } from '../utils/formatters';

// Excel-style currency formatter
const formatExcelCurrency = (amount) => {
  if (amount === 0) return '-';
  
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absAmount);
  
  if (amount < 0) {
    return `-${formatted}`;
  } else {
    return `${formatted}`;
  }
};

export default function ExcelBalanceSheet({ data, allRecords, setSelectedCategory, setSelectedMonth }) {
  // State for collapsed/expanded categories - start with all collapsed
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [allCollapsed, setAllCollapsed] = useState(true);
  
  // Get all unique months from the data
  const allMonthsFromData = [...new Set(data.monthlyData?.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`) || [])].sort();
  
  // Filter to only show months within the original requested period
  const originalPeriod = data.originalPeriod;
  const allMonths = originalPeriod ? allMonthsFromData.filter(monthKey => {
    const [year, month] = monthKey.split('-').map(x => parseInt(x));
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
      name: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
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

  // Helper function to check if category is Debiteur/Crediteur
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
      setCollapsedCategories(new Set());
      setAllCollapsed(false);
    } else {
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

  // Initialize collapsed state
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

  // Build hierarchical structure
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
      
      if (isDebiteurCrediteur(categorie)) {
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
    
    // Calculate totals
    Object.keys(hierarchy).forEach(typeRekening => {
      Object.keys(hierarchy[typeRekening]).forEach(categorie => {
        const categoryData = hierarchy[typeRekening][categorie];
        
        if (categoryData.isDebiteurCrediteur) {
          categoryData.totalAmount = getCategoryTotalAmount(typeRekening, categorie);
        } else {
          Object.keys(categoryData.accounts).forEach(accountKey => {
            const account = categoryData.accounts[accountKey];
            account.totalAmount = getAccountTotalAmount(account.rekeningnummer, account.rekening);
          });
          categoryData.totalAmount = Object.values(categoryData.accounts).reduce((sum, account) => sum + account.totalAmount, 0);
        }
      });
    });
    
    return hierarchy;
  };

  const balanceHierarchy = buildHierarchy();
  initializeCollapsedState();

  // Helper functions for totals
  const getTypeTotalForMonth = (monthKey, typeRekening) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const typeRecords = monthData?.records?.filter(r => r.Type_rekening === typeRekening) || [];
    return typeRecords.reduce((sum, r) => sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)), 0);
  };

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

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-black mb-2">Excel Balance Sheet</h2>
        <p className="text-black">Excel-styled hierarchical balance sheet</p>
      </div>
      
      {/* Toggle All Button */}
      <div className="flex justify-end">
        <button
          onClick={toggleAll}
          className="px-4 py-2 text-sm font-medium bg-gray-100 text-black hover:bg-gray-200 border border-black"
        >
          {allCollapsed ? 'Expand All' : 'Collapse All'}
        </button>
      </div>

      {/* Excel-style Balance Sheet Table */}
      <div className="bg-white border border-gray-400 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>
            <thead>
              <tr>
                <th className="px-2 py-1 text-left font-bold border border-gray-400 bg-[#222c56] min-w-[300px] text-sm text-white">
                  
                </th>
                {monthHeaders.map(month => (
                  <th key={month.key} className="px-2 py-1 text-center font-bold border border-gray-400 bg-[#222c56] min-w-[120px] text-sm text-white">
                    {month.name}
                  </th>
                ))}
                <th className="px-2 py-1 text-center font-bold border border-gray-400 bg-[#222c56] min-w-[120px] text-sm text-white">
                  Totaal
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(balanceHierarchy).map(([typeRekening, categories], sectionIndex) => {
                const rows = [];
                
                // Add spacing row before PASSIVA
                if (typeRekening === 'Passiva') {
                  rows.push(
                    <tr key="spacing-before-passiva">
                      <td colSpan={monthHeaders.length + 2} className="py-3 border-transparent"></td>
                    </tr>
                  );
                }
                
                // Type header (ACTIVA/PASSIVA)
                rows.push(
                  <tr key={`${typeRekening}-header`}>
                    <td className="px-2 py-2 text-sm font-bold border border-gray-400 bg-white text-black">
                      {typeRekening}
                    </td>
                    {monthHeaders.map(month => (
                      <td key={month.key} className="px-2 py-2 text-center border border-gray-400 bg-white"></td>
                    ))}
                    <td className="px-2 py-2 text-center border border-gray-400 bg-gray-100"></td>
                  </tr>
                );

                Object.entries(categories).forEach(([categorie, categoryData]) => {
                  const categoryKey = `${typeRekening}-${categorie}`;
                  const isCollapsed = collapsedCategories.has(categoryKey);
                  
                  // Category row
                  rows.push(
                    <tr key={`${categoryKey}-header`}>
                      <td className="px-2 py-2 text-sm border border-gray-400 bg-white">
                        <button
                          onClick={() => !categoryData.isDebiteurCrediteur && toggleCategory(categoryKey)}
                          className="flex items-center w-full text-left text-black"
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
                          <td key={month.key} className="px-2 py-2 text-right text-sm border border-gray-400 bg-white">
                            <button
                              onClick={() => {
                                setSelectedCategory(categorie);
                                setSelectedMonth(month.key);
                              }}
                              className="hover:underline w-full text-right text-black"
                            >
                              {formatExcelCurrency(monthAmount)}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right text-sm border border-gray-400 bg-gray-100">
                        {categoryData.totalAmount !== 0 ? (
                          <button
                            onClick={() => {
                              setSelectedCategory(categorie);
                              setSelectedMonth(null);
                            }}
                            className="hover:underline w-full text-right text-black font-semibold"
                          >
                            {formatExcelCurrency(categoryData.totalAmount)}
                          </button>
                        ) : '-'}
                      </td>
                    </tr>
                  );

                  // Show individual accounts if not collapsed and not Debiteur/Crediteur
                  if (!isCollapsed && !categoryData.isDebiteurCrediteur) {
                    Object.entries(categoryData.accounts).forEach(([accountKey, account]) => {
                      rows.push(
                        <tr key={`${categoryKey}-${accountKey}`}>
                          <td className="px-4 py-2 text-sm border border-gray-400 bg-white text-black">
                            {account.rekening}
                          </td>
                          {monthHeaders.map(month => {
                            const monthAmount = getAccountAmountForMonth(month.key, account.rekeningnummer, account.rekening);
                            return (
                              <td key={month.key} className="px-2 py-2 text-right text-sm border border-gray-400 bg-white text-black">
                                {formatExcelCurrency(monthAmount)}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-right text-sm border border-gray-400 bg-gray-100 text-black font-semibold">
                            {account.totalAmount !== 0 ? formatExcelCurrency(account.totalAmount) : '-'}
                          </td>
                        </tr>
                      );
                    });
                  }
                });

                // Add total row for this type (Activa/Passiva)
                rows.push(
                  <tr key={`${typeRekening}-total`} className="bg-gray-100">
                    <td className="px-2 py-3 text-sm font-bold border border-gray-400 bg-gray-100 text-black">
                      Totaal {typeRekening.toLowerCase()}
                    </td>
                    {monthHeaders.map(month => {
                      const monthTotal = getTypeTotalForMonth(month.key, typeRekening);
                      return (
                        <td key={month.key} className="px-2 py-3 text-right text-sm font-bold border border-gray-400 bg-gray-100">
                          <button
                            onClick={() => {
                              setSelectedCategory(typeRekening);
                              setSelectedMonth(month.key);
                            }}
                            className="hover:underline w-full text-right text-black"
                          >
                            {formatExcelCurrency(monthTotal)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 text-right text-sm font-bold border border-gray-400 bg-gray-100">
                      <button
                        onClick={() => {
                          setSelectedCategory(typeRekening);
                          setSelectedMonth(null);
                        }}
                        className="hover:underline w-full text-right text-black"
                      >
                        {formatExcelCurrency(getTypeTotal(typeRekening))}
                      </button>
                    </td>
                  </tr>
                );

                return rows;
              })}
              
              {/* Extra spacing before calculations */}
              <tr>
                <td colSpan={monthHeaders.length + 2} className="py-4"></td>
              </tr>
              
              {/* BALANS VERSCHIL Section */}
              <tr className="bg-gray-200">
                <td className="px-2 py-4 text-sm font-bold border border-gray-400 bg-gray-200 text-black">
                  Balans verschil (activa + passiva)
                </td>
                {monthHeaders.map(month => {
                  const difference = getBalanceDifferenceForMonth(month.key);
                  return (
                    <td key={month.key} className="px-2 py-4 text-right text-sm font-bold border border-gray-400 bg-gray-200 text-black">
                      {formatExcelCurrency(difference)}
                    </td>
                  );
                })}
                <td className="px-2 py-4 text-right text-sm font-bold border border-gray-400 bg-gray-200 text-black">
                  {formatExcelCurrency(getTotalBalanceDifference())}
                </td>
              </tr>
              
              {/* NETTO RESULTAAT Section */}
              <tr className="bg-gray-200">
                <td className="px-2 py-4 text-sm font-bold border border-gray-400 bg-gray-200 text-black">
                  Netto resultaat (W&V)
                </td>
                {monthHeaders.map(month => {
                  const result = getWvResultForMonth(month.key);
                  return (
                    <td key={month.key} className="px-2 py-4 text-right text-sm font-bold border border-gray-400 bg-gray-200 text-black">
                      {formatExcelCurrency(result)}
                    </td>
                  );
                })}
                <td className="px-2 py-4 text-right text-sm font-bold border border-gray-400 bg-gray-200 text-black">
                  {formatExcelCurrency(getTotalWvResult())}
                </td>
              </tr>
              
              {/* BALANS CONTROLE Section */}
              <tr className="bg-gray-300">
                <td className="px-2 py-4 text-sm font-bold border border-gray-400 bg-gray-300 text-black">
                  Balans controle (|balans| - |W&V|)
                </td>
                {monthHeaders.map(month => {
                  const check = getBalanceCheckForMonth(month.key);
                  return (
                    <td key={month.key} className="px-2 py-4 text-right text-sm font-bold border border-gray-400 bg-gray-300">
                      <span className={Math.abs(check) < 0.01 ? 'text-green-700' : 'text-red-700'}>
                        {formatExcelCurrency(check)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 py-4 text-right text-sm font-bold border border-gray-400 bg-gray-300">
                  <span className={Math.abs(getTotalBalanceCheck()) < 0.01 ? 'text-green-700' : 'text-red-700'}>
                    {formatExcelCurrency(getTotalBalanceCheck())}
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
