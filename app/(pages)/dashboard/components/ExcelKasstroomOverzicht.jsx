'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';

// Excel-style number formatter - no currency symbol, negative with minus
const formatExcelNumber = (amount) => {
  if (amount === 0) return '0';
  
  const formatted = new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.abs(amount));
  
  return amount < 0 ? `-${formatted}` : formatted;
};

export default function ExcelKasstroomOverzicht({ data, allRecords, categoryMappings = [], setSelectedCategory, setSelectedMonth }) {
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
      name: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
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
      <div className="border border-[#e56e61] bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <div className="text-[#e56e61] font-bold">⚠️</div>
          <div>
            <h3 className="text-sm font-bold text-[#e56e61]">KASSTROOMOVERZICHT NIET BESCHIKBAAR</h3>
            <p className="text-xs text-[#e56e61] mt-1">
              Geen categorie mappings geconfigureerd. Ga naar Settings voor AI-mapping.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-black mb-2">Kasstroomoverzicht</h2>
        <p className="text-black">Maandelijks kasstroomoverzicht - Excel styling</p>
      </div>

      {/* Excel-style table */}
      <div className="border border-gray-400 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>
            <thead>
              <tr>
                <th className="border border-gray-400 px-2 py-2 text-left font-bold text-white bg-[#222c56] min-w-[200px] sticky left-0 z-10">Kasstroomoverzicht</th>
                {monthHeaders.map(month => (
                  <th key={month.key} className="border border-gray-400 px-2 py-2 text-center font-bold text-white bg-[#222c56] min-w-[120px]">
                    {month.name}
                  </th>
                ))}
                <th className="border border-gray-400 px-2 py-2 text-center font-bold text-white bg-[#222c56] min-w-[120px]">
                  Totaal
                </th>
              </tr>
            </thead>
          <tbody>
            {(() => {
              // Render functie voor een rij
              const renderRow = (label, monthValues, totalValue, isCalculated = false, isHeader = false, className = '') => {
                const baseClass = 'bg-white';
                const isEmptyRow = className.includes('border-transparent');
                
                const textClass = isCalculated 
                  ? 'text-black font-bold' 
                  : 'text-black';

                const borderClass = isEmptyRow ? 'border-transparent' : 'border border-gray-400';
                const paddingClass = isEmptyRow ? 'py-3' : 'py-1';

                return (
                  <tr key={label || Math.random()} className={`${baseClass} ${className}`}>
                    <td className={`${borderClass} px-2 ${paddingClass} ${textClass} sticky left-0 z-10 bg-white`}>
                      {label}
                    </td>
                    {monthHeaders.map((month, index) => {
                      const value = monthValues[index];
                      return (
                        <td key={month.key} className={`${borderClass} px-2 ${paddingClass} text-right ${textClass}`}>
                          {isEmptyRow ? (
                            ''
                          ) : value !== null && value !== undefined ? (
                            formatExcelNumber(value)
                          ) : (
                            ''
                          )}
                        </td>
                      );
                    })}
                    <td className={`${borderClass} px-2 ${paddingClass} text-right ${isEmptyRow ? 'bg-white' : 'bg-gray-100'} ${textClass}`}>
                      {isEmptyRow ? (
                        ''
                      ) : totalValue !== null && totalValue !== undefined ? (
                        formatExcelNumber(totalValue)
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                );
              };

              const rows = [];

              // OPERATIONELE KASSTROOM - header removed

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
              
              // Lege rij na Operationele kasstroom
              rows.push(renderRow('', monthHeaders.map(() => null), null, false, false, 'border-transparent'));

              // INVESTERINGSKASSTROOM - header removed

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
              
              // Lege rij na Investeringskasstroom
              rows.push(renderRow('', monthHeaders.map(() => null), null, false, false, 'border-transparent'));

              // FINANCIERINGSKASSTROOM - header removed

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
              
              // Lege rij na Financieringskasstroom
              rows.push(renderRow('', monthHeaders.map(() => null), null, false, false, 'border-transparent'));

              // NETTO KASSTROOM - header removed

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

              // Check rij
              const checkMonths = monthHeaders.map((month, index) => 
                nettoKasstroomMonths[index] - mutatieLiquideMonths[index]
              );
              const checkTotal = nettoKasstroomTotal - mutatieLiquideTotal;
              rows.push(renderRow('Check', checkMonths, checkTotal, true, false, 'border-t-2 border-[#222c56]'));

              return rows;
            })()}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

