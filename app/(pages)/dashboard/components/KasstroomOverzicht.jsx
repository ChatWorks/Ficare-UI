'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';

export default function KasstroomOverzicht({ data, allRecords, categoryMappings = [], setSelectedCategory, setSelectedMonth }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get all unique months from the data
  const allMonthsFromData = [...new Set(data.monthlyData?.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`) || [])].sort();
  
  // Filter to only show months within the original requested period (exclude the extra month added for calculations)
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

  // Create mapping lookup for quick access
  const mappingLookup = categoryMappings.reduce((acc, mapping) => {
    acc[mapping.category_3] = mapping.mapped_category;
    return acc;
  }, {});

  // Helper function to get mapped amount for a category in a specific month
  const getMappedAmountForMonth = (monthKey, mappedCategory) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
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

  // Helper function to get balance sheet amounts (Activa/Passiva)
  const getBalanceAmountForMonth = (monthKey, typeRekening, filterFunc = null) => {
    const monthData = data.monthlyData?.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    if (!monthData) return 0;
    
    let records = monthData.records?.filter(r => r.Type_rekening === typeRekening) || [];
    
    if (filterFunc) {
      records = records.filter(filterFunc);
    }
    
    return records.reduce((sum, r) => sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)), 0);
  };

  // Helper function to get previous month key (search in all available data, including extra month)
  const getPreviousMonthKey = (monthKey) => {
    const [year, month] = monthKey.split('-').map(x => parseInt(x));
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    
    // Check if the previous month exists in our data (including the extended data)
    const prevMonthExists = data.monthlyData?.some(m => `${m.year}-${String(m.month).padStart(2, '0')}` === prevMonthKey);
    
    return prevMonthExists ? prevMonthKey : null;
  };

  if (categoryMappings.length === 0) {
    return (
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
        <div className="flex items-center gap-3">
          <div className="text-yellow-600">⚠️</div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">Kasstroomoverzicht niet beschikbaar</h3>
            <p className="text-yellow-700 mt-1">
              Er zijn nog geen categorie mappings geconfigureerd. Ga eerst naar Settings om AI-mapping in te stellen voor de Verbeterde W&V.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Kasstroomoverzicht</h2>
        <p className="text-slate-600">
          Maandelijks kasstroomoverzicht gebaseerd op Verbeterde W&V en balansmutatieanalyse
        </p>
        <div className="mt-2 text-sm text-slate-500">
          Operationele, investerings- en financieringskasstroom per maand
        </div>
      </div>

      {/* Kasstroom Table */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="border-b-2 border-slate-300">
                <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-slate-100 z-10 min-w-[300px] text-sm text-slate-900 border-r border-slate-300">
                  KASSTROOMOVERZICHT
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
              {(() => {
                // Render functie voor een rij
                const renderRow = (label, monthValues, totalValue, isCalculated = false, isHeader = false, className = '') => {
                  const baseClass = isHeader 
                    ? 'bg-slate-200 border-b border-slate-300' 
                    : isCalculated 
                      ? 'bg-green-50 border-b border-slate-200' 
                      : 'bg-white border-b border-slate-200';
                  
                  const textClass = isHeader 
                    ? 'text-slate-900 font-bold' 
                    : isCalculated 
                      ? 'text-green-900 font-semibold' 
                      : 'text-green-900 font-medium';

                  return (
                    <tr key={label} className={`${baseClass} ${className}`}>
                      <td className={`px-6 py-2 text-sm sticky left-0 bg-inherit border-r border-slate-300 ${textClass}`}>
                        {label}
                      </td>
                      {monthHeaders.map((month, index) => {
                        const value = monthValues[index];
                        return (
                          <td key={month.key} className="px-4 py-2 text-center text-sm border-r border-slate-200">
                            {value !== 0 && value !== null ? (
                              <span className={`font-semibold ${value >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(value)}
                              </span>
                            ) : '-'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-center text-sm font-semibold bg-slate-50 border-l-2 border-slate-400">
                        {totalValue !== 0 && totalValue !== null ? (
                          <span className={`font-semibold ${totalValue >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(totalValue)}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                };

                const rows = [];

                // OPERATIONELE KASSTROOM
                rows.push(renderRow('OPERATIONELE KASSTROOM', monthHeaders.map(() => null), null, false, true));

                // Resultaat na belasting (uit Verbeterde W&V)
                const resultaatMonths = monthHeaders.map(month => {
                  // Bereken zoals in Enhanced P&L
                  const omzet = getMappedAmountForMonth(month.key, 'Omzet');
                  const inkoop = -Math.abs(getMappedAmountForMonth(month.key, 'Inkoopwaarde omzet'));
                  const provisies = -Math.abs(getMappedAmountForMonth(month.key, 'Provisies'));
                  const personeelDirect = -Math.abs(getMappedAmountForMonth(month.key, 'Personeelskosten direct'));
                  const marge = omzet + inkoop + provisies + personeelDirect;
                  
                  const auto = -Math.abs(getMappedAmountForMonth(month.key, 'Autokosten'));
                  const marketing = -Math.abs(getMappedAmountForMonth(month.key, 'Marketingkosten'));
                  const personeelOp = -Math.abs(getMappedAmountForMonth(month.key, 'Operationele personeelskosten'));
                  const contributie = marge + auto + marketing + personeelOp;
                  
                  const huisvesting = -Math.abs(getMappedAmountForMonth(month.key, 'Huisvestingskosten'));
                  const kantoor = -Math.abs(getMappedAmountForMonth(month.key, 'Kantoorkosten'));
                  const algemeen = -Math.abs(getMappedAmountForMonth(month.key, 'Algemene kosten'));
                  const ebitda = contributie + huisvesting + kantoor + algemeen;
                  
                  const afschrijving = -Math.abs(getMappedAmountForMonth(month.key, 'Afschrijvingskosten'));
                  const financiering = -Math.abs(getMappedAmountForMonth(month.key, 'Financieringskosten'));
                  const ebit = ebitda + afschrijving + financiering;
                  
                  const vpb = ebit > 0 ? -(ebit * 0.23) : 0;
                  return ebit + vpb;
                });
                const resultaatTotal = resultaatMonths.reduce((sum, val) => sum + val, 0);
                rows.push(renderRow('Resultaat na belasting', resultaatMonths, resultaatTotal));

                // Belastingen = -VPB
                const belastingMonths = monthHeaders.map(month => {
                  const omzet = getMappedAmountForMonth(month.key, 'Omzet');
                  const inkoop = -Math.abs(getMappedAmountForMonth(month.key, 'Inkoopwaarde omzet'));
                  const provisies = -Math.abs(getMappedAmountForMonth(month.key, 'Provisies'));
                  const personeelDirect = -Math.abs(getMappedAmountForMonth(month.key, 'Personeelskosten direct'));
                  const marge = omzet + inkoop + provisies + personeelDirect;
                  
                  const auto = -Math.abs(getMappedAmountForMonth(month.key, 'Autokosten'));
                  const marketing = -Math.abs(getMappedAmountForMonth(month.key, 'Marketingkosten'));
                  const personeelOp = -Math.abs(getMappedAmountForMonth(month.key, 'Operationele personeelskosten'));
                  const contributie = marge + auto + marketing + personeelOp;
                  
                  const huisvesting = -Math.abs(getMappedAmountForMonth(month.key, 'Huisvestingskosten'));
                  const kantoor = -Math.abs(getMappedAmountForMonth(month.key, 'Kantoorkosten'));
                  const algemeen = -Math.abs(getMappedAmountForMonth(month.key, 'Algemene kosten'));
                  const ebitda = contributie + huisvesting + kantoor + algemeen;
                  
                  const afschrijving = -Math.abs(getMappedAmountForMonth(month.key, 'Afschrijvingskosten'));
                  const financiering = -Math.abs(getMappedAmountForMonth(month.key, 'Financieringskosten'));
                  const ebit = ebitda + afschrijving + financiering;
                  
                  return ebit > 0 ? (ebit * 0.23) : 0; // Positief maken (tegenovergesteld van VPB)
                });
                const belastingTotal = belastingMonths.reduce((sum, val) => sum + val, 0);
                rows.push(renderRow('Belastingen', belastingMonths, belastingTotal));

                // Afschrijvingen = -afschrijvingskosten (positief maken)
                const afschrijvingKasMonths = monthHeaders.map(month => {
                  return Math.abs(getMappedAmountForMonth(month.key, 'Afschrijvingskosten'));
                });
                const afschrijvingKasTotal = afschrijvingKasMonths.reduce((sum, val) => sum + val, 0);
                rows.push(renderRow('Afschrijvingen', afschrijvingKasMonths, afschrijvingKasTotal));

                // Mutatie netto werkkapitaal
                const mutatieWerkkapitaalMonths = monthHeaders.map(month => {
                  const previousMonth = getPreviousMonthKey(month.key);
                  if (!previousMonth) return 0;
                  
                  // Activa (exclusief liquid en vaste activa)
                  const activaHuidige = getBalanceAmountForMonth(month.key, 'Activa', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return !cat3.includes('liquid') && !cat3.includes('vaste activa');
                  });
                  
                  const activaVorige = getBalanceAmountForMonth(previousMonth, 'Activa', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return !cat3.includes('liquid') && !cat3.includes('vaste activa');
                  });
                  
                  // Passiva (exclusief eigen vermogen)
                  const passivaHuidige = getBalanceAmountForMonth(month.key, 'Passiva', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return !cat3.includes('eigen vermogen');
                  });
                  
                  const passivaVorige = getBalanceAmountForMonth(previousMonth, 'Passiva', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return !cat3.includes('eigen vermogen');
                  });
                  
                  return -((activaHuidige - activaVorige) - (passivaHuidige - passivaVorige));
                });
                const mutatieWerkkapitaalTotal = mutatieWerkkapitaalMonths.reduce((sum, val) => sum + val, 0);
                rows.push(renderRow('Mutatie netto werkkapitaal', mutatieWerkkapitaalMonths, mutatieWerkkapitaalTotal));

                // Operationele kasstroom (berekend)
                const operationeleKasstroomMonths = monthHeaders.map((month, index) => 
                  resultaatMonths[index] + belastingMonths[index] + afschrijvingKasMonths[index] + mutatieWerkkapitaalMonths[index]
                );
                const operationeleKasstroomTotal = resultaatTotal + belastingTotal + afschrijvingKasTotal + mutatieWerkkapitaalTotal;
                rows.push(renderRow('Operationele kasstroom', operationeleKasstroomMonths, operationeleKasstroomTotal, true));

                // INVESTERINGSKASSTROOM
                rows.push(renderRow('INVESTERINGSKASSTROOM', monthHeaders.map(() => null), null, false, true));

                // Investeringen
                const investeringMonths = monthHeaders.map(month => {
                  const previousMonth = getPreviousMonthKey(month.key);
                  if (!previousMonth) return 0;
                  
                  // Vaste activa vorige maand
                  const vasteActivaVorig = getBalanceAmountForMonth(previousMonth, 'Activa', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return cat3.includes('vaste activa');
                  });
                  
                  // Afschrijvingskosten uit W&V
                  const afschrijvingWV = getMappedAmountForMonth(month.key, 'Afschrijvingskosten');
                  
                  // Vaste activa huidige maand
                  const vasteActivaHuidig = getBalanceAmountForMonth(month.key, 'Activa', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return cat3.includes('vaste activa');
                  });
                  
                  return -(vasteActivaVorig - Math.abs(afschrijvingWV) + vasteActivaHuidig);
                });
                const investeringTotal = investeringMonths.reduce((sum, val) => sum + val, 0);
                rows.push(renderRow('Investeringen', investeringMonths, investeringTotal));

                // Investeringskasstroom = investeringen
                rows.push(renderRow('Investeringskasstroom', investeringMonths, investeringTotal, true));

                // FINANCIERINGSKASSTROOM
                rows.push(renderRow('FINANCIERINGSKASSTROOM', monthHeaders.map(() => null), null, false, true));

                // Dividend
                const dividendMonths = monthHeaders.map((month, index) => {
                  const previousMonth = getPreviousMonthKey(month.key);
                  if (!previousMonth) return 0;
                  
                  // Eigen vermogen huidige maand
                  const eigenVermogenHuidig = getBalanceAmountForMonth(month.key, 'Passiva', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return cat3.includes('eigen vermogen');
                  });
                  
                  // Eigen vermogen vorige maand
                  const eigenVermogenVorig = getBalanceAmountForMonth(previousMonth, 'Passiva', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return cat3.includes('eigen vermogen');
                  });
                  
                  return -(eigenVermogenHuidig - eigenVermogenVorig - resultaatMonths[index] + belastingMonths[index]);
                });
                const dividendTotal = dividendMonths.reduce((sum, val) => sum + val, 0);
                rows.push(renderRow('Dividend', dividendMonths, dividendTotal));

                // Financieringskasstroom = dividend
                rows.push(renderRow('Financieringskasstroom', dividendMonths, dividendTotal, true));

                // NETTO KASSTROOM
                rows.push(renderRow('NETTO KASSTROOM', monthHeaders.map(() => null), null, false, true));

                // Netto kasstroom (berekend)
                const nettoKasstroomMonths = monthHeaders.map((month, index) => 
                  operationeleKasstroomMonths[index] + investeringMonths[index] + dividendMonths[index]
                );
                const nettoKasstroomTotal = operationeleKasstroomTotal + investeringTotal + dividendTotal;
                rows.push(renderRow('Netto kasstroom', nettoKasstroomMonths, nettoKasstroomTotal, true));

                // Mutatie liquide middelen
                const mutatieLiquideMonths = monthHeaders.map(month => {
                  const previousMonth = getPreviousMonthKey(month.key);
                  if (!previousMonth) return 0;
                  
                  // Liquide middelen huidige maand
                  const liquideHuidig = getBalanceAmountForMonth(month.key, 'Activa', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return cat3.includes('liquid');
                  });
                  
                  // Liquide middelen vorige maand
                  const liquideVorig = getBalanceAmountForMonth(previousMonth, 'Activa', (r) => {
                    const cat3 = (r.Omschrijving_3 || '').toLowerCase();
                    return cat3.includes('liquid');
                  });
                  
                  return liquideHuidig - liquideVorig;
                });
                const mutatieLiquideTotal = mutatieLiquideMonths.reduce((sum, val) => sum + val, 0);
                rows.push(renderRow('Mutatie liquide middelen', mutatieLiquideMonths, mutatieLiquideTotal, true));

                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
