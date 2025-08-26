'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';

export default function ExcelEnhancedProfitLoss({ data, allRecords, categoryMappings = [], setSelectedCategory, setSelectedMonth }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
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
      // For revenue: credit - debet (positive revenue)
      // For costs: debet - credit (positive costs, will be made negative in display)
      if (mappedCategory === 'Omzet' || mappedCategory === 'Provisies') {
        return sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0));
      } else {
        return sum + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0));
      }
    }, 0);
  };

  // Helper function to get mapped total amount across all months
  const getMappedTotalAmount = (mappedCategory) => {
    const categoryRecords = data.allRecords?.filter(r => {
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

  if (categoryMappings.length === 0) {
    return (
      <div className="border border-[#e56e61] bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <div className="text-[#e56e61] font-bold">⚠️</div>
          <div>
            <h3 className="text-sm font-bold text-[#e56e61]">VERBETERDE W&V NIET BESCHIKBAAR</h3>
            <p className="text-xs text-[#e56e61] mt-1">
              Geen categorie mappings geconfigureerd. Ga naar Settings voor AI-mapping.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#222c56] mb-1">Winst- en verliesrekening</h2>
        <p className="text-sm text-gray-600">Gestructureerde W&V analyse</p>
      </div>

      {/* Excel-style table with horizontal scroll and fixed first column */}
      <div className="bg-white shadow-sm overflow-x-auto border border-gray-400 relative">
        <table className="border-collapse text-xs relative" style={{ minWidth: '2000px', fontFamily: 'Arial, sans-serif' }}>
          <thead>
            <tr>
                             <th className="border-b border-gray-400 px-2 py-1 text-left font-bold text-white sticky left-0 z-50 relative" style={{ minWidth: '280px', borderTop: '1px solid #9ca3af', backgroundColor: '#222c56' }}>
                <div className="absolute top-0 right-0 bottom-0 w-[3px] bg-gray-600 z-10"></div>
                {/* Empty header cell */}
              </th>
              {monthHeaders.map((month, monthIndex) => (
                <th key={month.key} className={`bg-[#222c56] border-r border-b border-gray-400 px-1 py-1 text-center font-bold text-white ${monthIndex > 0 ? 'border-l-2 border-l-gray-600' : ''}`} style={{ minWidth: '200px', borderTop: '1px solid #9ca3af' }}>
                  {month.name.charAt(0).toUpperCase() + month.name.slice(1)}
                </th>
              ))}
              <th className="bg-[#222c56] border-r border-b border-gray-400 px-1 py-1 text-center font-bold text-white border-l-2 border-l-gray-600" style={{ minWidth: '200px', borderTop: '1px solid #9ca3af' }}>
                TOTAAL
              </th>
            </tr>
            <tr>
                             <th className="border-b border-gray-400 px-2 py-1 text-left font-normal text-black sticky left-0 z-50 relative" style={{ backgroundColor: 'white' }}>
                <div className="absolute top-0 right-0 bottom-0 w-[3px] bg-gray-600 z-10"></div>
                {/* Empty subheader cell */}
              </th>
              {monthHeaders.map((month, monthIndex) => (
                <th key={`${month.key}-sub`} className={`bg-white border-r border-b border-gray-400 px-0 py-0 ${monthIndex > 0 ? 'border-l-2 border-l-gray-600' : ''}`}>
                  <div className="grid grid-cols-3 text-xs">
                    <div className="text-center text-[#e56e61] font-bold border-r border-gray-400 py-1">ACTUAL</div>
                    <div className="text-center text-[#e56e61] font-bold border-r border-gray-400 py-1">BUDGET</div>
                    <div className="text-center text-[#e56e61] font-bold py-1">DIFF</div>
                  </div>
                </th>
              ))}
              <th className="bg-white border-r border-b border-gray-400 px-0 py-0 border-l-2 border-l-gray-600">
                <div className="grid grid-cols-3 text-xs">
                  <div className="text-center text-[#e56e61] font-bold border-r border-gray-400 py-1">ACTUAL</div>
                  <div className="text-center text-[#e56e61] font-bold border-r border-gray-400 py-1">BUDGET</div>
                  <div className="text-center text-[#e56e61] font-bold py-1">DIFF</div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Helper functie voor berekeningen
              const getAmountForMonth = (monthKey, category) => {
                return getMappedAmountForMonth(monthKey, category);
              };
              
              const getTotalAmount = (category) => {
                return getMappedTotalAmount(category);
              };

              // Render functie voor een rij
              const renderRow = (label, monthValues, totalValue, isCalculated = false, isPercentage = false, isHeader = false, className = '', uniqueKey = null) => {
                const baseClass = isHeader 
                  ? 'bg-gray-100' 
                  : 'bg-white';
                
                // Bepaal welke rijen dikgedrukt moeten worden
                const isBoldRow = [
                  'Marge', 'Contributiemarge', 'Totale kosten', 
                  'EBITDA genormaliseerd', 'EBIT', 'VPB (stel: 23%)', 
                  'RESULTAAT NA BELASTING'
                ].includes(label);
                
                const isPercentageRow = label.includes('%') || isPercentage;
                const isFinalResult = label === 'RESULTAAT NA BELASTING';
                
                // Specifieke percentage rijen die rood moeten worden
                const isRedPercentageRow = [
                  '% Marge', '% Contributiemarge', 'EBITDA vs. MARGE (%)', 'Netto resultaat / omzet'
                ].includes(label);
                
                // Bepaal welke rijen dikke borders moeten hebben (boven de totaalrij)
                const hasThickBorderAbove = [
                  'Marge', 'Contributiemarge', 'EBITDA genormaliseerd', 'EBIT', 'RESULTAAT NA BELASTING'
                ].includes(label);
                
                // Bepaal welke rijen dikke borders moeten hebben (onder percentage rijen)
                const hasThickBorderBelow = [
                  '% Marge', '% Contributiemarge', 'EBITDA vs. MARGE (%)', 'Netto resultaat / omzet'
                ].includes(label);
                
                const textClass = isHeader 
                  ? 'text-black font-semibold' 
                  : isFinalResult
                    ? 'text-black font-bold'
                  : isBoldRow
                    ? 'text-black font-semibold'
                  : isRedPercentageRow
                    ? 'font-normal italic'
                  : 'text-black font-normal';

                const rowKey = uniqueKey || label || `row-${Math.random()}`;

                const borderTopClass = hasThickBorderAbove ? 'border-t-2 border-t-gray-600' : '';
                const borderBottomClass = hasThickBorderBelow ? 'border-b-2 border-b-gray-600' : 'border-b border-gray-400';

                return (
                  <tr key={rowKey} className={`${baseClass} ${className}`}>
                                         <td className={`${borderTopClass} ${borderBottomClass} px-2 py-1 ${textClass} sticky left-0 z-50 relative`} style={{ minWidth: '280px', color: isRedPercentageRow ? '#e56e61' : undefined, backgroundColor: baseClass === 'bg-white' ? 'white' : '#f3f4f6' }}>
                      <div className="absolute top-0 right-0 bottom-0 w-[3px] bg-gray-600 z-10"></div>
                      {label}
                    </td>
                    {monthHeaders.map((month, index) => {
                      const value = monthValues[index];
                      return (
                        <td key={month.key} className={`border-r ${borderTopClass} ${borderBottomClass} px-0 py-0 ${index > 0 ? 'border-l-2 border-l-gray-600' : ''}`} style={{ minWidth: '200px' }}>
                          <div className="grid grid-cols-3 h-full text-xs">
                            {/* ACTUAL */}
                            <div className="text-right border-r border-gray-400 px-1 py-1">
                              {value !== 0 && value !== null ? (
                                isCalculated ? (
                                  <span className={`${isFinalResult ? 'font-bold' : isBoldRow ? 'font-semibold' : isRedPercentageRow ? 'font-normal italic' : 'font-normal'} text-black`} style={{ color: isRedPercentageRow ? '#e56e61' : undefined }}>
                                    {isPercentage ? `${value.toFixed(0)}%` : Math.round(value).toLocaleString()}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setSelectedCategory && setSelectedCategory(label);
                                      setSelectedMonth && setSelectedMonth(month.key);
                                    }}
                                    className={`hover:underline ${isFinalResult ? 'font-bold' : isBoldRow ? 'font-semibold' : 'font-normal'} text-black`}
                                  >
                                    {Math.round(value).toLocaleString()}
                                  </button>
                                )
                              ) : null}
                            </div>
                            {/* BUDGET */}
                            <div className="text-right border-r border-gray-400 px-1 py-1">
                              {/* Always empty for budget */}
                            </div>
                            {/* DIFF */}
                            <div className="text-right px-1 py-1">
                              {value !== 0 && value !== null ? (
                                <span className={`${isFinalResult ? 'font-bold' : isBoldRow ? 'font-semibold' : isRedPercentageRow ? 'font-normal italic' : 'font-normal'} text-black`} style={{ color: isRedPercentageRow ? '#e56e61' : undefined }}>
                                  {Math.round(value).toLocaleString()}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    {/* TOTAAL kolom */}
                    <td className={`border-r ${borderTopClass} ${borderBottomClass} px-0 py-0 border-l-2 border-l-gray-600`} style={{ minWidth: '200px' }}>
                      <div className="grid grid-cols-3 h-full text-xs">
                        {/* ACTUAL */}
                        <div className="text-right border-r border-gray-400 px-1 py-1">
                          {totalValue !== 0 && totalValue !== null ? (
                            isCalculated ? (
                              <span className={`${isFinalResult ? 'font-bold' : isBoldRow ? 'font-semibold' : isRedPercentageRow ? 'font-normal italic' : 'font-normal'} text-black`} style={{ color: isRedPercentageRow ? '#e56e61' : undefined }}>
                                {isPercentage ? `${totalValue.toFixed(0)}%` : Math.round(totalValue).toLocaleString()}
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedCategory && setSelectedCategory(label);
                                  setSelectedMonth && setSelectedMonth('total');
                                }}
                                className={`hover:underline ${isFinalResult ? 'font-bold' : isBoldRow ? 'font-semibold' : 'font-normal'} text-black`}
                              >
                                {Math.round(totalValue).toLocaleString()}
                              </button>
                            )
                          ) : null}
                        </div>
                        {/* BUDGET */}
                        <div className="text-right border-r border-gray-400 px-1 py-1">
                          {/* Always empty for budget */}
                        </div>
                        {/* DIFF */}
                        <div className="text-right px-1 py-1">
                          {totalValue !== 0 && totalValue !== null ? (
                            <span className={`${isFinalResult ? 'font-bold' : isBoldRow ? 'font-semibold' : isRedPercentageRow ? 'font-normal italic' : 'font-normal'} text-black`} style={{ color: isRedPercentageRow ? '#e56e61' : undefined }}>
                              {Math.round(totalValue).toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              };

              const rows = [];

              // Omzet
              const omzetMonths = monthHeaders.map(month => getAmountForMonth(month.key, 'Omzet'));
              const omzetTotal = getTotalAmount('Omzet');
              rows.push(renderRow('Omzet', omzetMonths, omzetTotal));

              // Inkoopwaarde omzet
              const inkoopMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Inkoopwaarde omzet')));
              const inkoopTotal = -Math.abs(getTotalAmount('Inkoopwaarde omzet'));
              rows.push(renderRow('Inkoopwaarde omzet', inkoopMonths, inkoopTotal));

              // Provisies
              const provisieMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Provisies')));
              const provisieTotal = -Math.abs(getTotalAmount('Provisies'));
              rows.push(renderRow('Provisies', provisieMonths, provisieTotal));

              // Personeelskosten direct
              const personeelDirectMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Personeelskosten direct')));
              const personeelDirectTotal = -Math.abs(getTotalAmount('Personeelskosten direct'));
              rows.push(renderRow('Personeelskosten direct', personeelDirectMonths, personeelDirectTotal));

              // MARGE (berekend)
              const margeMonths = monthHeaders.map((month, index) => 
                omzetMonths[index] + inkoopMonths[index] + provisieMonths[index] + personeelDirectMonths[index]
              );
              const margeTotal = omzetTotal + inkoopTotal + provisieTotal + personeelDirectTotal;
              rows.push(renderRow('Marge', margeMonths, margeTotal, true));

              // MARGE % (berekend)
              const margePercMonths = monthHeaders.map((month, index) => 
                omzetMonths[index] !== 0 ? (margeMonths[index] / omzetMonths[index]) * 100 : 0
              );
              const margePercTotal = omzetTotal !== 0 ? (margeTotal / omzetTotal) * 100 : 0;
              rows.push(renderRow('% Marge', margePercMonths, margePercTotal, true, true));

              // Empty row
              rows.push(renderRow('', monthHeaders.map(() => null), null, false, false, false, '', 'empty-1'));

              // Autokosten
              const autoMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Autokosten')));
              const autoTotal = -Math.abs(getTotalAmount('Autokosten'));
              rows.push(renderRow('Autokosten', autoMonths, autoTotal));

              // Marketingkosten
              const marketingMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Marketingkosten')));
              const marketingTotal = -Math.abs(getTotalAmount('Marketingkosten'));
              rows.push(renderRow('Marketingkosten', marketingMonths, marketingTotal));

              // Operationele personeelskosten
              const personeelOpMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Operationele personeelskosten')));
              const personeelOpTotal = -Math.abs(getTotalAmount('Operationele personeelskosten'));
              rows.push(renderRow('Operationele personeelskosten', personeelOpMonths, personeelOpTotal));

              // CONTRIBUTIEMARGE (berekend)
              const contributieMonths = monthHeaders.map((month, index) => 
                margeMonths[index] + autoMonths[index] + marketingMonths[index] + personeelOpMonths[index]
              );
              const contributieTotal = margeTotal + autoTotal + marketingTotal + personeelOpTotal;
              rows.push(renderRow('Contributiemarge', contributieMonths, contributieTotal, true));

              // CONTRIBUTIEMARGE % (berekend)
              const contributiePercMonths = monthHeaders.map((month, index) => 
                omzetMonths[index] !== 0 ? (contributieMonths[index] / omzetMonths[index]) * 100 : 0
              );
              const contributiePercTotal = omzetTotal !== 0 ? (contributieTotal / omzetTotal) * 100 : 0;
              rows.push(renderRow('% Contributiemarge', contributiePercMonths, contributiePercTotal, true, true));

              // Empty row
              rows.push(renderRow('', monthHeaders.map(() => null), null, false, false, false, '', 'empty-2'));

              // Kosten header
              rows.push(renderRow('Kosten', monthHeaders.map(() => null), null, false, false, true));

              // Algemene autokosten
              rows.push(renderRow('Algemene autokosten', monthHeaders.map(() => 0), 0));

              // Huisvestingskosten
              const huisvestingMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Huisvestingskosten')));
              const huisvestingTotal = -Math.abs(getTotalAmount('Huisvestingskosten'));
              rows.push(renderRow('Huisvestingskosten', huisvestingMonths, huisvestingTotal));

              // Kantoorkosten
              const kantoorMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Kantoorkosten')));
              const kantoorTotal = -Math.abs(getTotalAmount('Kantoorkosten'));
              rows.push(renderRow('Kantoorkosten', kantoorMonths, kantoorTotal));

              // Algemene kosten
              const algemeneMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Algemene kosten')));
              const algemeneTotal = -Math.abs(getTotalAmount('Algemene kosten'));
              rows.push(renderRow('Algemene kosten', algemeneMonths, algemeneTotal));

              // Totale kosten (berekend)
              const totaleKostenMonths = monthHeaders.map((month, index) => 
                huisvestingMonths[index] + kantoorMonths[index] + algemeneMonths[index]
              );
              const totaleKostenTotal = huisvestingTotal + kantoorTotal + algemeneTotal;
              rows.push(renderRow('Totale kosten', totaleKostenMonths, totaleKostenTotal, true));

              // Empty row
              rows.push(renderRow('', monthHeaders.map(() => null), null, false, false, false, '', 'empty-3'));

              // EBITDA genormaliseerd
              const ebitdaMonths = monthHeaders.map((month, index) => 
                contributieMonths[index] + totaleKostenMonths[index]
              );
              const ebitdaTotal = contributieTotal + totaleKostenTotal;
              rows.push(renderRow('EBITDA genormaliseerd', ebitdaMonths, ebitdaTotal, true));

              // EBITDA vs. MARGE (%)
              const ebitdaPercMonths = monthHeaders.map((month, index) => 
                omzetMonths[index] !== 0 ? (ebitdaMonths[index] / omzetMonths[index]) * 100 : 0
              );
              const ebitdaPercTotal = omzetTotal !== 0 ? (ebitdaTotal / omzetTotal) * 100 : 0;
              rows.push(renderRow('EBITDA vs. MARGE (%)', ebitdaPercMonths, ebitdaPercTotal, true, true));

              // Empty row
              rows.push(renderRow('', monthHeaders.map(() => null), null, false, false, false, '', 'empty-4'));

              // Afschrijvingskosten
              const afschrijvingMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Afschrijvingskosten')));
              const afschrijvingTotal = -Math.abs(getTotalAmount('Afschrijvingskosten'));
              rows.push(renderRow('Afschrijvingskosten', afschrijvingMonths, afschrijvingTotal));

              // Financieringskosten
              const financieringMonths = monthHeaders.map(month => -Math.abs(getAmountForMonth(month.key, 'Financieringskosten')));
              const financieringTotal = -Math.abs(getTotalAmount('Financieringskosten'));
              rows.push(renderRow('Financieringskosten', financieringMonths, financieringTotal));

              // EBIT
              const ebitMonths = monthHeaders.map((month, index) => 
                ebitdaMonths[index] + afschrijvingMonths[index] + financieringMonths[index]
              );
              const ebitTotal = ebitdaTotal + afschrijvingTotal + financieringTotal;
              rows.push(renderRow('EBIT', ebitMonths, ebitTotal, true));

              // Empty row
              rows.push(renderRow('', monthHeaders.map(() => null), null, false, false, false, '', 'empty-5'));

              // VPB (stel: 23%)
              const vpbMonths = monthHeaders.map((month, index) => 
                ebitMonths[index] > 0 ? -(ebitMonths[index] * 0.23) : 0
              );
              const vpbTotal = ebitTotal > 0 ? -(ebitTotal * 0.23) : 0;
              rows.push(renderRow('VPB (stel: 23%)', vpbMonths, vpbTotal, true));

              // RESULTAAT NA BELASTING
              const resultaatMonths = monthHeaders.map((month, index) => 
                ebitMonths[index] + vpbMonths[index]
              );
              const resultaatTotal = ebitTotal + vpbTotal;
              rows.push(renderRow('RESULTAAT NA BELASTING', resultaatMonths, resultaatTotal, true));

              // Netto resultaat / omzet
              const nettoPercMonths = monthHeaders.map((month, index) => 
                omzetMonths[index] !== 0 ? (resultaatMonths[index] / omzetMonths[index]) * 100 : 0
              );
              const nettoPercTotal = omzetTotal !== 0 ? (resultaatTotal / omzetTotal) * 100 : 0;
              rows.push(renderRow('Netto resultaat / omzet', nettoPercMonths, nettoPercTotal, true, true));

              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
