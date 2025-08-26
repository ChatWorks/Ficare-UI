'use client';

import { useState } from 'react';

export default function MonthlyChecksComponent({ data, getCategoryAmount, getCategoryTotal, formatCurrency, monthOptions }) {
    const [selectedMonth, setSelectedMonth] = useState(null);
  
    if (!data) return null;
  
    // Calculate checks for each month
    const calculateChecks = (month) => {
      // Helper functions
      const omzet = getCategoryAmount(month, 'Omzet');
      const inkoopwaarde = Math.abs(getCategoryAmount(month, 'Inkoopwaarde omzet'));
      const provisies = Math.abs(getCategoryAmount(month, 'Provisies'));
      const personeelskosten = Math.abs(getCategoryAmount(month, 'Personeelskosten direct'));
      const debiteuren = getCategoryAmount(month, 'Debiteur');
      const crediteur = Math.abs(getCategoryAmount(month, 'Crediteur'));
      const liquideMiddelen = getCategoryAmount(month, 'Liquide middelen');
      const eigenVermogen = getCategoryAmount(month, 'Eigen vermogen');
      const materieleVasteActiva = getCategoryAmount(month, 'Materiële vaste activa');
      const immaterieleVasteActiva = getCategoryAmount(month, 'Immateriële vaste activa');
      const afschrijvingskosten = Math.abs(getCategoryAmount(month, 'Afschrijvingskosten'));
      const belastingenPremies = Math.abs(getCategoryAmount(month, 'Belastingen/premies'));
      const overlopendeActiva = getCategoryAmount(month, 'Overlopende activa');
      const overlopendePassiva = Math.abs(getCategoryAmount(month, 'Overlopende passiva'));
      const rekeningCourantDirectie = getCategoryAmount(month, 'Rekening courant directie');
  
      // Get previous month data for comparison
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevOmzet = getCategoryAmount(prevMonth, 'Omzet');
      const prevDebiteuren = getCategoryAmount(prevMonth, 'Debiteur');
      const prevCrediteur = Math.abs(getCategoryAmount(prevMonth, 'Crediteur'));
      const prevLiquideMiddelen = getCategoryAmount(prevMonth, 'Liquide middelen');
      const prevEigenVermogen = getCategoryAmount(prevMonth, 'Eigen vermogen');
  
      // Calculate P&L result
      const marge = omzet - inkoopwaarde - provisies - personeelskosten;
      const autokosten = Math.abs(getCategoryAmount(month, 'Leasekosten auto\'s'));
      const marketingkosten = Math.abs(getCategoryAmount(month, 'Marketingkosten'));
      const operationelePersoneelskosten = Math.abs(getCategoryAmount(month, 'Operationele personeelskosten'));
      const huisvestingskosten = Math.abs(getCategoryAmount(month, 'Huisvestingskosten'));
      const kantoorkosten = Math.abs(getCategoryAmount(month, 'Kantoorkosten'));
      const algemeneKosten = Math.abs(getCategoryAmount(month, 'Algemene kosten'));
      const financieringskosten = Math.abs(getCategoryAmount(month, 'Financieringskosten'));
      
      const contributiemarge = marge - autokosten - marketingkosten - operationelePersoneelskosten;
      const totaleKosten = huisvestingskosten + kantoorkosten + algemeneKosten;
      const ebitda = contributiemarge - totaleKosten;
      const ebit = ebitda - afschrijvingskosten - financieringskosten;
      const vpb = ebit * 0.23;
      const netResult = ebit - vpb;
  
      // Eigen vermogen mutatie vs P&L
      const eigenVermoogenMutatie = eigenVermogen - prevEigenVermogen;
  
      const checks = [
        {
          id: 1,
          title: "P&L vs. Balanscontrole",
          description: "Sluit het resultaat in de P&L exact aan op de winst/verliesmutatie in het eigen vermogen?",
          calculation: `P&L Resultaat: ${formatCurrency(netResult)} vs. EV Mutatie: ${formatCurrency(eigenVermoogenMutatie)}`,
          result: Math.abs(netResult - eigenVermoogenMutatie) < 100, // Within 100 EUR tolerance
          value: Math.abs(netResult - eigenVermoogenMutatie),
          warning: Math.abs(netResult - eigenVermoogenMutatie) > 100,
          detail: `Verschil: ${formatCurrency(Math.abs(netResult - eigenVermoogenMutatie))}`
        },
        {
          id: 2,
          title: "Omzet vs. COGS-verhouding (Brutomarge)",
          description: "Is de brutomarge binnen een normale bandbreedte t.o.v. voorgaande maanden?",
          calculation: `Brutomarge: ${omzet > 0 ? ((marge / omzet) * 100).toFixed(1) : 0}%`,
          result: omzet > 0 ? (marge / omzet) > 0.15 : true, // Minimum 15% brutomarge
          value: omzet > 0 ? (marge / omzet) * 100 : 0,
          warning: omzet > 0 ? (marge / omzet) < 0.20 : false,
          detail: `Marge: ${formatCurrency(marge)} van omzet: ${formatCurrency(omzet)}`
        },
        {
          id: 3,
          title: "Debiteurenomloop check (DSO)",
          description: "Vergelijk de verhouding debiteuren vs. omzet met vorige maanden.",
          calculation: `DSO: ${omzet > 0 ? ((debiteuren / omzet) * 30).toFixed(1) : 0} dagen`,
          result: omzet > 0 ? (debiteuren / omzet) * 30 < 45 : true, // Max 45 dagen
          value: omzet > 0 ? (debiteuren / omzet) * 30 : 0,
          warning: omzet > 0 ? (debiteuren / omzet) * 30 > 30 : false,
          detail: `Debiteuren: ${formatCurrency(debiteuren)} vs. Maandomzet: ${formatCurrency(omzet)}`
        },
        {
          id: 4,
          title: "Crediteurenomloop check (DPO)",
          description: "Vergelijk crediteurenpositie vs. inkoopkosten.",
          calculation: `DPO: ${inkoopwaarde > 0 ? ((crediteur / inkoopwaarde) * 30).toFixed(1) : 0} dagen`,
          result: inkoopwaarde > 0 ? (crediteur / inkoopwaarde) * 30 < 60 : true, // Max 60 dagen
          value: inkoopwaarde > 0 ? (crediteur / inkoopwaarde) * 30 : 0,
          warning: inkoopwaarde > 0 ? (crediteur / inkoopwaarde) * 30 > 45 : false,
          detail: `Crediteuren: ${formatCurrency(crediteur)} vs. Maandinkoop: ${formatCurrency(inkoopwaarde)}`
        },
        {
          id: 5,
          title: "Liquide middelen mutatie",
          description: "Controle op abnormale mutaties in liquide middelen.",
          calculation: `Mutatie: ${formatCurrency(liquideMiddelen - prevLiquideMiddelen)}`,
          result: Math.abs(liquideMiddelen - prevLiquideMiddelen) < omzet * 0.5, // Max 50% van omzet
          value: Math.abs(liquideMiddelen - prevLiquideMiddelen),
          warning: Math.abs(liquideMiddelen - prevLiquideMiddelen) > omzet * 0.25,
          detail: `Van: ${formatCurrency(prevLiquideMiddelen)} naar: ${formatCurrency(liquideMiddelen)}`
        },
        {
          id: 6,
          title: "Mutatie vaste activa + afschrijvingen",
          description: "Kloppen de afschrijvingen met de vaste activa-mutaties?",
          calculation: `Afschrijvingen: ${formatCurrency(afschrijvingskosten)}`,
          result: afschrijvingskosten > 0 && afschrijvingskosten < (materieleVasteActiva + immaterieleVasteActiva) * 0.1,
          value: afschrijvingskosten,
          warning: afschrijvingskosten === 0 || afschrijvingskosten > (materieleVasteActiva + immaterieleVasteActiva) * 0.05,
          detail: `VA Totaal: ${formatCurrency(materieleVasteActiva + immaterieleVasteActiva)}`
        },
        {
          id: 7,
          title: "BTW-saldi check",
          description: "Zijn de BTW-rekeningen (belastingen/premies) realistisch?",
          calculation: `BTW Saldo: ${formatCurrency(belastingenPremies)}`,
          result: belastingenPremies > 0 && belastingenPremies < omzet * 0.25, // Max 25% van omzet
          value: belastingenPremies,
          warning: belastingenPremies > omzet * 0.15,
          detail: `${((belastingenPremies / omzet) * 100).toFixed(1)}% van omzet`
        },
        {
          id: 8,
          title: "Balansposten consistentie",
          description: "Zijn de hoofdbalansposten consistent?",
          calculation: "Saldo check van hoofdposten",
          result: Math.abs(debiteuren) > 0 && Math.abs(crediteur) > 0,
          value: 1,
          warning: debiteuren === 0 || crediteur === 0,
          detail: `Debiteuren: ${formatCurrency(debiteuren)}, Crediteuren: ${formatCurrency(crediteur)}`
        },
        {
          id: 9,
          title: "Kasstroomconsistentie check",
          description: "Klopt de mutatie in liquide middelen met verwachting?",
          calculation: `Kasmutatie: ${formatCurrency(liquideMiddelen - prevLiquideMiddelen)}`,
          result: Math.abs((liquideMiddelen - prevLiquideMiddelen) - netResult) < netResult * 0.5,
          value: Math.abs((liquideMiddelen - prevLiquideMiddelen) - netResult),
          warning: Math.abs((liquideMiddelen - prevLiquideMiddelen) - netResult) > Math.abs(netResult * 0.3),
          detail: `Verwacht obv resultaat: ${formatCurrency(netResult)}`
        },
        {
          id: 10,
          title: "Accruals/voorzieningen check",
          description: "Zijn overlopende posten realistisch?",
          calculation: `Overlopende activa: ${formatCurrency(overlopendeActiva)}, passiva: ${formatCurrency(overlopendePassiva)}`,
          result: (overlopendeActiva + overlopendePassiva) < omzet * 0.3, // Max 30% van omzet
          value: overlopendeActiva + overlopendePassiva,
          warning: (overlopendeActiva + overlopendePassiva) > omzet * 0.2,
          detail: `Totaal overlopend: ${formatCurrency(overlopendeActiva + overlopendePassiva)}`
        },
        {
          id: 11,
          title: "Intercompany check",
          description: "Controle op rekening courant directie.",
          calculation: `RC Directie: ${formatCurrency(rekeningCourantDirectie)}`,
          result: Math.abs(rekeningCourantDirectie) < omzet * 0.5, // Max 50% van omzet
          value: Math.abs(rekeningCourantDirectie),
          warning: Math.abs(rekeningCourantDirectie) > omzet * 0.25,
          detail: `${Math.abs(rekeningCourantDirectie) > 0 ? 'Uitstaand bij directie' : 'Schuld aan directie'}`
        },
        {
          id: 12,
          title: "Onevenredige mutaties check",
          description: "Detectie van grote maandmutaties.",
          calculation: "Analyse van grote mutaties",
          result: Math.abs(omzet - prevOmzet) < prevOmzet * 0.5, // Max 50% mutatie
          value: Math.abs(omzet - prevOmzet),
          warning: Math.abs(omzet - prevOmzet) > prevOmzet * 0.3,
          detail: `Omzetmutatie: ${formatCurrency(omzet - prevOmzet)} (${prevOmzet > 0 ? (((omzet - prevOmzet) / prevOmzet) * 100).toFixed(1) : 0}%)`
        },
        {
          id: 13,
          title: "Kostenstructuur check",
          description: "Zijn de kostenpercentages realistisch?",
          calculation: `Totale kosten: ${omzet > 0 ? (((inkoopwaarde + personeelskosten + totaleKosten) / omzet) * 100).toFixed(1) : 0}% van omzet`,
          result: omzet > 0 ? ((inkoopwaarde + personeelskosten + totaleKosten) / omzet) < 0.85 : true, // Max 85% van omzet
          value: omzet > 0 ? ((inkoopwaarde + personeelskosten + totaleKosten) / omzet) * 100 : 0,
          warning: omzet > 0 ? ((inkoopwaarde + personeelskosten + totaleKosten) / omzet) > 0.75 : false,
          detail: `Kosten: ${formatCurrency(inkoopwaarde + personeelskosten + totaleKosten)}`
        },
        {
          id: 14,
          title: "Ratio-analyse (Current Ratio)",
          description: "Bereken current ratio voor liquiditeit.",
          calculation: `Current Ratio: ${overlopendePassiva > 0 ? ((debiteuren + liquideMiddelen + overlopendeActiva) / (crediteur + overlopendePassiva)).toFixed(2) : 'N/A'}`,
          result: overlopendePassiva > 0 ? ((debiteuren + liquideMiddelen + overlopendeActiva) / (crediteur + overlopendePassiva)) > 1.2 : true,
          value: overlopendePassiva > 0 ? ((debiteuren + liquideMiddelen + overlopendeActiva) / (crediteur + overlopendePassiva)) : 0,
          warning: overlopendePassiva > 0 ? ((debiteuren + liquideMiddelen + overlopendeActiva) / (crediteur + overlopendePassiva)) < 1.5 : false,
          detail: `Vlottende activa vs. kortlopende schulden`
        },
        {
          id: 15,
          title: "Periodieke posten tijdigheid",
          description: "Zijn typische maandkosten geboekt?",
          calculation: "Controle op typische maandkosten",
          result: personeelskosten > 0 && (huisvestingskosten > 0 || kantoorkosten > 0),
          value: 1,
          warning: personeelskosten === 0,
          detail: `Personeelskosten: ${formatCurrency(personeelskosten)}, Overheadkosten: ${formatCurrency(huisvestingskosten + kantoorkosten)}`
        }
      ];
  
      return checks;
    };
  
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">
          Maandafsluiting Checks - Top 15 Controles
        </h2>
  
        {/* Month selector */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Selecteer Maand voor Gedetailleerde Analyse</h3>
          <div className="grid grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
              const monthData = data.monthlyData.find(m => m.month === month);
              const hasData = monthData && monthData.records.length > 0;
              
              return (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month)}
                  disabled={!hasData}
                  className={`
                    p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium
                    ${selectedMonth === month 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : hasData 
                        ? 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50' 
                        : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {monthOptions.find(m => m.value === month)?.label}
                  {hasData && <div className="text-xs text-green-600 mt-1">✓ Data</div>}
                </button>
              );
            })}
          </div>
        </div>
  
        {selectedMonth && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <h3 className="text-xl font-bold">
                Maandafsluiting Checks - {monthOptions.find(m => m.value === selectedMonth)?.label}
              </h3>
              <p className="text-blue-100 mt-2">15 kritieke controles voor een betrouwbare maandafsluiting</p>
            </div>
  
            <div className="p-6">
              {(() => {
                const checks = calculateChecks(selectedMonth);
                const passedChecks = checks.filter(c => c.result).length;
                const warningChecks = checks.filter(c => c.warning && c.result).length;
                const failedChecks = checks.filter(c => !c.result).length;
  
                return (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600">{passedChecks}</div>
                        <div className="text-sm text-green-700">Checks Geslaagd</div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-yellow-600">{warningChecks}</div>
                        <div className="text-sm text-yellow-700">Waarschuwingen</div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-red-600">{failedChecks}</div>
                        <div className="text-sm text-red-700">Checks Gefaald</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">{Math.round((passedChecks / 15) * 100)}%</div>
                        <div className="text-sm text-blue-700">Score</div>
                      </div>
                    </div>
  
                    {/* Detailed checks */}
                    <div className="space-y-4">
                      {checks.map((check) => (
                        <div
                          key={check.id}
                          className={`
                            border-2 rounded-lg p-6 transition-all duration-200
                            ${!check.result 
                              ? 'border-red-200 bg-red-50' 
                              : check.warning 
                                ? 'border-yellow-200 bg-yellow-50' 
                                : 'border-green-200 bg-green-50'
                            }
                          `}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div className={`
                                  text-2xl
                                  ${!check.result 
                                    ? 'text-red-500' 
                                    : check.warning 
                                      ? 'text-yellow-500' 
                                      : 'text-green-500'
                                  }
                                `}>
                                  {!check.result ? '❌' : check.warning ? '⚠️' : '✅'}
                                </div>
                                <div>
                                  <h4 className="text-lg font-semibold text-gray-800">
                                    {check.id}. {check.title}
                                  </h4>
                                  <p className="text-gray-600 text-sm mt-1">{check.description}</p>
                                </div>
                              </div>
                              
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Berekening:</span>
                                  <div className="text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded mt-1">
                                    {check.calculation}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Detail:</span>
                                  <div className="text-sm text-gray-900 mt-1">
                                    {check.detail}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className={`
                              px-4 py-2 rounded-full text-sm font-medium ml-4
                              ${!check.result 
                                ? 'bg-red-100 text-red-800' 
                                : check.warning 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-green-100 text-green-800'
                              }
                            `}>
                              {!check.result ? 'GEFAALD' : check.warning ? 'WAARSCHUWING' : 'GESLAAGD'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
  
        {!selectedMonth && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <div className="text-4xl text-gray-400 mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Selecteer een maand</h3>
            <p className="text-gray-600">Kies een maand hierboven om de gedetailleerde maandafsluiting checks te bekijken.</p>
          </div>
        )}
      </div>
    );
  }