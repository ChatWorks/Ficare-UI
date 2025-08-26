'use client';

import { formatCurrency } from '../utils/formatters';

export default function MonthlyOverview({ data }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Maandoverzicht
      </h2>
      

      
      {/* Eigen Vermogen Summary */}
      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <span className="w-3 h-3 bg-slate-600 rounded-full mr-2"></span>
          Balans Overzicht
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-sm text-slate-600 font-medium">Totaal Activa</p>
            <p className={`text-xl font-bold ${data.balans?.activa >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
              {formatCurrency(data.balans?.activa || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-600 font-medium">Vreemd Vermogen</p>
            <p className={`text-xl font-bold ${data.balans?.vreemdVermogen >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
              {formatCurrency(data.balans?.vreemdVermogen || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-orange-600 font-medium">Eigen Vermogen</p>
            <p className={`text-xl font-bold ${data.balans?.eigenVermogen >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
              {formatCurrency(data.balans?.eigenVermogen || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Netto Resultaat W&V</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 font-medium">Totaal Passiva</p>
            <p className={`text-xl font-bold ${data.balans?.totaalPassiva >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
              {formatCurrency(data.balans?.totaalPassiva || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Vreemd + Eigen</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-600 font-medium">Balansverschil</p>
            <p className={`text-xl font-bold ${Math.abs(data.balans?.balansVerschil || 0) < 0.01 ? 'text-slate-700' : 'text-red-700'}`}>
              {formatCurrency(data.balans?.balansVerschil || 0)}
              {Math.abs(data.balans?.balansVerschil || 0) < 0.01 && <span className="ml-1">✓</span>}
            </p>
            <p className="text-xs text-gray-500 mt-1">Activa - Totaal Passiva</p>
          </div>
        </div>
      </div>
      
      {/* Monthly Details */}
      <div className="grid gap-4">
        {data.monthlyData.map((month, index) => {
          // Find corresponding balans data for this month
          const balansMonth = data.balans?.perMonth?.find(
            ev => ev.monthKey === `${month.year}-${String(month.month).padStart(2, '0')}`
          );
          
          return (
            <div key={index} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {month.monthName}
                </h3>
                <span className="text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  {month.records.length} transacties
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Debet</p>
                  <p className="text-lg font-semibold text-red-700">
                    {formatCurrency(month.totalDebet)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Credit</p>
                  <p className="text-lg font-semibold text-slate-700">
                    {formatCurrency(month.totalCredit)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Netto</p>
                  <p className={`text-lg font-semibold ${month.netAmount >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
                    {formatCurrency(month.netAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Activa</p>
                  <p className={`text-lg font-semibold ${balansMonth?.activa >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
                    {formatCurrency(balansMonth?.activa || 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-orange-600 font-medium">Eigen Vermogen</p>
                  <p className={`text-lg font-bold ${balansMonth?.eigenVermogen >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
                    {formatCurrency(balansMonth?.eigenVermogen || 0)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
