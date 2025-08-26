'use client';

import { formatCurrency } from '../utils/formatters';

export default function CategoryOverview({ data, setSelectedCategory, setSelectedMonth }) {
  // Get all unique months and years from the data
  const allMonths = [...new Set(data.monthlyData.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`))].sort();
  
  // Create month names for headers
  const monthHeaders = allMonths.map(monthKey => {
    const [year, month] = monthKey.split('-');
    return {
      key: monthKey,
      name: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
    };
  });

  // Get all categories and sort by total amount
  const allCategories = Object.entries(data.categoryTotals || {})
    .sort(([,a], [,b]) => Math.abs(b.netAmount) - Math.abs(a.netAmount))
    .map(([category]) => category);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Categorieën</h2>
        <p className="text-slate-600">Overzicht per categorie (op basis van Omschrijving_3)</p>
      </div>
      
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="border-b-2 border-slate-300">
                <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-slate-100 z-10 min-w-[200px] text-xs uppercase tracking-wider text-slate-900 border-r border-slate-300">
                  CATEGORIE
                </th>
                {monthHeaders.map(month => (
                  <th key={month.key} className="px-3 py-3 text-center font-semibold min-w-[120px] text-xs uppercase tracking-wider text-slate-900 border-r border-slate-200">
                    {month.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold bg-slate-200 min-w-[120px] text-xs uppercase tracking-wider text-slate-900 border-l-2 border-slate-400">
                  TOTAAL
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allCategories.map(category => {
                const categoryTotal = data.categoryTotals[category];
                
                return (
                  <tr key={category} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white border-r border-gray-200">
                      <div className="flex items-center">
                        <div className="h-2 w-2 bg-blue-600 rounded-full mr-3"></div>
                        <span className="text-sm font-medium text-gray-900">{category}</span>
                      </div>
                    </td>
                    {monthHeaders.map(month => {
                      // Find the month data and get category amount
                      const monthData = data.monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === month.key);
                      const categoryRecords = monthData?.records?.filter(r => r.Categorie === category) || [];
                      const amount = categoryRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
                      
                      return (
                        <td key={month.key} className="px-3 py-4 whitespace-nowrap text-center">
                          {amount !== 0 ? (
                            <button
                              onClick={() => {
                                setSelectedCategory(category);
                                setSelectedMonth(month.key);
                              }}
                              className={`text-sm font-semibold hover:underline cursor-pointer ${
                                amount >= 0 ? 'text-slate-700' : 'text-red-700'
                              }`}
                            >
                              {formatCurrency(amount)}
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 whitespace-nowrap text-center bg-gray-50 border-l border-gray-200">
                      <button
                        onClick={() => {
                          setSelectedCategory(category);
                          setSelectedMonth(null);
                        }}
                        className={`text-sm font-bold hover:underline cursor-pointer ${
                          categoryTotal.netAmount >= 0 ? 'text-slate-700' : 'text-red-700'
                        }`}
                      >
                        {formatCurrency(categoryTotal.netAmount)}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
