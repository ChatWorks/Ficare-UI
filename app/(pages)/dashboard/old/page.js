'use client';

import { useState, useEffect } from 'react';
import { buildFinancialView } from '@/lib/finance/transform';
import AIChat from '../AIChat';

export default function FinancialControllerV2() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Date range state
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(1); // Start met januari
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(12); // Eind met december

  // Generate year options (current year - 5 to current year + 1)
  const yearOptions = [];
  for (let year = currentYear - 5; year <= currentYear + 1; year++) {
    yearOptions.push(year);
  }

  // Month options
  const monthOptions = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maart' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Augustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  // Quick select functions
  const selectCurrentMonth = () => {
    setStartYear(currentYear);
    setStartMonth(currentMonth);
    setEndYear(currentYear);
    setEndMonth(currentMonth);
  };

  const selectLastThreeMonths = () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
    setStartYear(threeMonthsAgo.getFullYear());
    setStartMonth(threeMonthsAgo.getMonth() + 1);
    setEndYear(currentYear);
    setEndMonth(currentMonth);
  };

  const selectCurrentYear = () => {
    setStartYear(currentYear);
    setStartMonth(1);
    setEndYear(currentYear);
    setEndMonth(12);
  };

  const [data, setData] = useState(null);
  const [allRecords, setAllRecords] = useState(null);
  const [allMeta, setAllMeta] = useState(null);
  const [progress, setProgress] = useState({ loaded: 0, pages: 0, pageSize: 100000 });
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // AI Chat state - persist across tab changes
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hallo! Ik ben je AI financiële assistent. Stel je financiële vraag en ik kan P&L, balans, kasstroom, ratio\'s, afwijkingen en journaalhulp analyseren.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Helper function to calculate object size in bytes
  const calculateObjectSize = (obj) => {
    if (obj === null || obj === undefined) return 0;
    
    const jsonString = JSON.stringify(obj);
    // UTF-8 encoding: each character can be 1-4 bytes, rough estimate
    return new Blob([jsonString]).size;
  };

  // Helper function to format bytes to human readable format
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calculate data sizes
  const getDataSizes = () => {
    const allRecordsSize = calculateObjectSize(allRecords);
    const dataSize = calculateObjectSize(data);
    const totalSize = allRecordsSize + dataSize;
    
    return {
      allRecords: {
        size: allRecordsSize,
        formatted: formatBytes(allRecordsSize),
        count: allRecords ? allRecords.length : 0
      },
      transformedData: {
        size: dataSize,
        formatted: formatBytes(dataSize)
      },
      total: {
        size: totalSize,
        formatted: formatBytes(totalSize)
      }
    };
  };

  const fetchAllRecords = async () => {
    setLoading(true);
    setError(null);
    setProgress({ loaded: 0, pages: 0, pageSize: 100000 });
    try {
      const take = 100000;
      let skip = 0;
      let rowsAll = [];
      let pages = 0;
      let hasMore = true;
      while (hasMore) {
        const resp = await fetch(`/api/v2/financial/all?singlePage=1&skip=${skip}&take=${take}`);
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        const batch = await resp.json();
        const rows = batch.rows || [];
        rowsAll = rowsAll.concat(rows);
        pages += 1;
        setProgress({ loaded: rowsAll.length, pages, pageSize: take });
        hasMore = batch.hasMore === true;
        skip = batch.nextSkip || (skip + rows.length);
        if (!hasMore) {
          // done
          setAllRecords(rowsAll);
          setAllMeta({ 
            totalRecords: rowsAll.length,
            fetchedAll: true,
            safetyStopReached: false,
            pagesFetched: pages,
            pageSize: take
          });
          const view = buildFinancialView(rowsAll, { startYear, startMonth, endYear, endMonth });
          setData(view);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch ALL records once on mount
  useEffect(() => {
    if (!allRecords) {
      fetchAllRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute view client-side on range changes
  useEffect(() => {
    if (allRecords) {
      const view = buildFinancialView(allRecords, {
        startYear,
        startMonth,
        endYear,
        endMonth
      });
      setData(view);
    }
  }, [allRecords, startYear, startMonth, endYear, endMonth]);



  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Financial Controller Pro
                </h1>
                <p className="text-sm text-slate-600 mt-1 font-medium">
                  AFAS Financiële Rapportage & Analytics
                </p>
                {(allRecords || data) && (
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    {(() => {
                      const sizes = getDataSizes();
                      return (
                        <>
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            Raw Data: {sizes.allRecords.formatted} ({sizes.allRecords.count.toLocaleString()} records)
                          </span>
                          <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                            Processed: {sizes.transformedData.formatted}
                          </span>
                          <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded font-medium">
                            Total Memory: {sizes.total.formatted}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={fetchAllRecords}
                disabled={loading}
                className={`
                  inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors border
                  ${loading 
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
                  }
                `}
                title="Data verversen"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Laden...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Verversen
                  </>
                )}
              </button>
            </div>
            <a 
              href="/" 
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors border border-slate-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Terug naar overzicht
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="sticky top-2 z-10 mb-4">
            <div className="bg-slate-900 text-white rounded-md px-4 py-2 shadow">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>AFAS data laden...</span>
                </div>
                <div className="font-medium">{progress.loaded.toLocaleString('nl-NL')} records • {progress.pages} pagina's</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Controls Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Periode Selectie
            </h2>
            <div className="flex items-center text-sm text-slate-500">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Selecteer rapportageperiode
            </div>
          </div>
          
          <div className="space-y-6">
            
            {/* Quick selectors */}
            <div className="flex flex-wrap gap-3">
              <span className="text-sm font-semibold text-slate-700 self-center">Snelkeuze:</span>
              <button
                onClick={selectCurrentMonth}
                className="px-4 py-2 text-sm bg-slate-50 text-slate-700 rounded-md hover:bg-slate-100 transition-colors border border-slate-200 font-medium"
              >
                Deze maand
              </button>
              <button
                onClick={selectLastThreeMonths}
                className="px-4 py-2 text-sm bg-slate-50 text-slate-700 rounded-md hover:bg-slate-100 transition-colors border border-slate-200 font-medium"
              >
                Laatste 3 maanden
              </button>
              <button
                onClick={selectCurrentYear}
                className="px-4 py-2 text-sm bg-slate-50 text-slate-700 rounded-md hover:bg-slate-100 transition-colors border border-slate-200 font-medium"
              >
                Heel {currentYear}
              </button>
            </div>

            {/* Date range selectors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Start date */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Startperiode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Maand</label>
                    <select
                      value={startMonth}
                      onChange={(e) => setStartMonth(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      {monthOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Jaar</label>
                    <select
                      value={startYear}
                      onChange={(e) => setStartYear(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      {yearOptions.map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* End date */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Eindperiode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Maand</label>
                    <select
                      value={endMonth}
                      onChange={(e) => setEndMonth(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      {monthOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Jaar</label>
                    <select
                      value={endYear}
                      onChange={(e) => setEndYear(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      {yearOptions.map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected range display */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
              <div className="flex items-center text-sm">
                <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="font-semibold text-slate-700">Geselecteerde periode: </span>
                <span className="text-slate-900 font-medium ml-2">
                  {monthOptions.find(m => m.value === startMonth)?.label} {startYear}
                  {(startYear !== endYear || startMonth !== endMonth) && 
                    ` - ${monthOptions.find(m => m.value === endMonth)?.label} ${endYear}`
                  }
                </span>
              </div>
            </div>

          </div>
        </div>



        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Fout bij ophalen data
                </h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Data Display */}
        {data ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            {/* Tabs Navigation */}
            <div className="border-b border-slate-200 bg-slate-50">
              <nav className="flex space-x-0 px-6" aria-label="Tabs">
                {[
                  { id: 'summary', name: 'Maandoverzicht', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                  { id: 'categories', name: 'Categorieoverzicht', icon: 'M19 11H5m14-7H5m14 14H5' },
                  { id: 'balance', name: 'Balans', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
                  { id: 'management', name: 'W&V', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                  { id: 'cashflow', name: 'Kasstroomoverzicht', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1' },
                  { id: 'checks', name: 'Financiële Controles', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { id: 'chat', name: 'AI Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      px-4 py-4 font-semibold text-sm transition-all duration-200 border-b-2 flex items-center gap-2
                      ${activeTab === tab.id
                        ? 'border-slate-800 text-slate-900 bg-white'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                    </svg>
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'summary' && <MonthlyOverview data={data} />}
              {activeTab === 'categories' && <CategoryOverview data={data} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}
              {activeTab === 'balance' && <BalanceSheet data={data} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}
              {activeTab === 'management' && <ManagementRapportage data={data} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}
              {activeTab === 'cashflow' && <CashFlowOverview data={data} />}
              {activeTab === 'checks' && <FinancialChecks data={data} />}
              {activeTab === 'chat' && (
                <AIChat
                  periodFrom={`${startYear}-${String(startMonth).padStart(2, '0')}`}
                  periodTo={`${endYear}-${String(endMonth).padStart(2, '0')}`}
                  setSelectedCategory={setSelectedCategory}
                  setSelectedMonth={setSelectedMonth}
                  messages={chatMessages}
                  setMessages={setChatMessages}
                  input={chatInput}
                  setInput={setChatInput}
                  loading={chatLoading}
                  setLoading={setChatLoading}
                />
              )}
            </div>

            {/* Selected Category Details */}
            {selectedCategory && (
              <div className="mt-8 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-slate-50">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Transactiedetails
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {selectedCategory === 'ALLE_CATEGORIEËN' ? 
                        (selectedMonth ? 
                          `Alle categorieën - ${data.monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === selectedMonth)?.monthName}` : 
                          'Alle categorieën - Totale periode'
                        ) : 
                        `Categorie: ${selectedCategory}`
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-800 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                            <button 
                              onClick={() => {
                                if (sortBy === 'date') {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortBy('date');
                                  setSortOrder('desc');
                                }
                              }}
                              className="flex items-center gap-2 hover:text-slate-300 transition-colors"
                            >
                              <span>Datum</span>
                              {sortBy === 'date' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {sortOrder === 'asc' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  )}
                                </svg>
                              )}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                            <button 
                              onClick={() => {
                                if (sortBy === 'number') {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortBy('number');
                                  setSortOrder('asc');
                                }
                              }}
                              className="flex items-center gap-2 hover:text-slate-300 transition-colors"
                            >
                              <span>Boekstuk</span>
                              {sortBy === 'number' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {sortOrder === 'asc' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  )}
                                </svg>
                              )}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Omschrijving</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Rekening</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                            <button 
                              onClick={() => {
                                if (sortBy === 'category') {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortBy('category');
                                  setSortOrder('asc');
                                }
                              }}
                              className="flex items-center gap-2 hover:text-slate-300 transition-colors"
                            >
                              <span>Categorie</span>
                              {sortBy === 'category' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {sortOrder === 'asc' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  )}
                                </svg>
                              )}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                            <button 
                              onClick={() => {
                                if (sortBy === 'debet') {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortBy('debet');
                                  setSortOrder('desc');
                                }
                              }}
                              className="flex items-center gap-2 hover:text-slate-300 transition-colors ml-auto"
                            >
                              <span>Debet</span>
                              {sortBy === 'debet' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {sortOrder === 'asc' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  )}
                                </svg>
                              )}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                            <button 
                              onClick={() => {
                                if (sortBy === 'credit') {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortBy('credit');
                                  setSortOrder('desc');
                                }
                              }}
                              className="flex items-center gap-2 hover:text-slate-300 transition-colors ml-auto"
                            >
                              <span>Credit</span>
                              {sortBy === 'credit' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {sortOrder === 'asc' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  )}
                                </svg>
                              )}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                            <button 
                              onClick={() => {
                                if (sortBy === 'net') {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortBy('net');
                                  setSortOrder('desc');
                                }
                              }}
                              className="flex items-center gap-2 hover:text-slate-300 transition-colors ml-auto"
                            >
                              <span>Netto</span>
                              {sortBy === 'net' && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {sortOrder === 'asc' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  )}
                                </svg>
                              )}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(() => {
                          const records = selectedMonth 
                            ? data.monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === selectedMonth)?.records || []
                            : data.allRecords || [];
                          
                          const filteredRecords = records
                            .filter(record => selectedCategory === 'ALLE_CATEGORIEËN' || record.Categorie === selectedCategory);
                          
                          // Apply sorting
                          const sortedRecords = [...filteredRecords].sort((a, b) => {
                            let aVal, bVal;
                            switch(sortBy) {
                              case 'date':
                                aVal = new Date(a.Boekstukdatum);
                                bVal = new Date(b.Boekstukdatum);
                                break;
                              case 'number':
                                aVal = a.Boekstuknummer;
                                bVal = b.Boekstuknummer;
                                break;
                              case 'category':
                                aVal = a.Categorie || '';
                                bVal = b.Categorie || '';
                                break;
                              case 'debet':
                                aVal = a.Bedrag_debet || 0;
                                bVal = b.Bedrag_debet || 0;
                                break;
                              case 'credit':
                                aVal = a.Bedrag_credit || 0;
                                bVal = b.Bedrag_credit || 0;
                                break;
                              case 'net':
                                aVal = (a.Bedrag_credit || 0) - (a.Bedrag_debet || 0);
                                bVal = (b.Bedrag_credit || 0) - (b.Bedrag_debet || 0);
                                break;
                              default:
                                aVal = new Date(a.Boekstukdatum);
                                bVal = new Date(b.Boekstukdatum);
                            }
                            
                            if (sortOrder === 'asc') {
                              return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                            } else {
                              return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                            }
                          });
                          
                          return sortedRecords.map((record, index) => (
                              <tr key={index} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-sm text-slate-900 font-medium">{formatDate(record.Boekstukdatum)}</td>
                                <td className="px-4 py-3 text-sm text-slate-700">{record.Boekstuknummer}</td>
                                <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate" title={record.Omschrijving_boeking}>
                                  {record.Omschrijving_boeking}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">
                                  <div className="text-slate-900 font-medium">{record.Rekeningnummer}</div>
                                  <div className="text-slate-500 text-xs">{record.Omschrijving_2}</div>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border">
                                    {record.Categorie}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                    {record.AccountTypeName}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {record.Bedrag_debet > 0 ? (
                                    <span className="font-semibold text-red-600">
                                      {formatCurrency(record.Bedrag_debet)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {record.Bedrag_credit > 0 ? (
                                    <span className="font-semibold text-green-600">
                                      {formatCurrency(record.Bedrag_credit)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {(() => {
                                    const netAmount = (record.Bedrag_credit || 0) - (record.Bedrag_debet || 0);
                                    return (
                                      <span className={`font-bold ${netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {netAmount < 0 ? '-' : ''}
                                        {formatCurrency(Math.abs(netAmount))}
                                      </span>
                                    );
                                  })()}
                                </td>
                              </tr>
                            ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="text-center py-16">
              <div className="text-slate-400 mb-6">
                <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Geen data geladen
              </h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Om financiële rapportages te bekijken, selecteer eerst een periode en klik vervolgens op "AFAS Data Ophalen".
              </p>
              <div className="inline-flex items-center px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-slate-700 font-medium">Start door een periode te selecteren</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Helper function for currency formatting
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('nl-NL');
};

// Monthly Overview Component
function MonthlyOverview({ data }) {
  // Helper functions for memory calculation (duplicated locally for component scope)
  const calculateObjectSize = (obj) => {
    if (obj === null || obj === undefined) return 0;
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDataSizes = () => {
    const allRecordsSize = calculateObjectSize(data?.allRecords);
    const processedDataSize = calculateObjectSize({
      summary: data?.summary,
      categoryTotals: data?.categoryTotals,
      accountTypeTotals: data?.accountTypeTotals,
      balans: data?.balans,
      monthlyData: data?.monthlyData
    });
    const totalSize = allRecordsSize + processedDataSize;
    
    return {
      allRecords: {
        size: allRecordsSize,
        formatted: formatBytes(allRecordsSize),
        count: data?.allRecords ? data.allRecords.length : 0
      },
      processedData: {
        size: processedDataSize,
        formatted: formatBytes(processedDataSize)
      },
      total: {
        size: totalSize,
        formatted: formatBytes(totalSize)
      }
    };
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Maandoverzicht
      </h2>
      
      {/* Data Size Information */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <span className="w-3 h-3 bg-blue-600 rounded-full mr-2"></span>
          Memory Usage & Data Information
        </h3>
        {(() => {
          const sizes = getDataSizes();
          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-600 font-medium">Raw AFAS Records</p>
                <p className="text-xl font-bold text-blue-700">{sizes.allRecords.formatted}</p>
                <p className="text-xs text-blue-500 mt-1">{sizes.allRecords.count.toLocaleString('nl-NL')} records</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm text-green-600 font-medium">Processed Data</p>
                <p className="text-xl font-bold text-green-700">{sizes.processedData.formatted}</p>
                <p className="text-xs text-green-500 mt-1">Aggregated & Filtered</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-sm text-purple-600 font-medium">Total Memory</p>
                <p className="text-xl font-bold text-purple-700">{sizes.total.formatted}</p>
                <p className="text-xs text-purple-500 mt-1">Client-side Storage</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-sm text-orange-600 font-medium">Compression Ratio</p>
                <p className="text-xl font-bold text-orange-700">
                  {sizes.allRecords.size > 0 ? `${((sizes.processedData.size / sizes.allRecords.size) * 100).toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-xs text-orange-500 mt-1">Processed vs Raw</p>
              </div>
            </div>
          );
        })()}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Data bron: AFAS API (real-time)</span>
            <span>Laatste update: {new Date().toLocaleString('nl-NL')}</span>
            <span>Client-side verwerking</span>
          </div>
        </div>
      </div>
      
      {/* Eigen Vermogen Summary */}
      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <span className="w-3 h-3 bg-slate-600 rounded-full mr-2"></span>
          Balans Overzicht
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-sm text-green-600 font-medium">Totaal Activa</p>
            <p className={`text-xl font-bold ${data.balans?.activa >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.balans?.activa || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-600 font-medium">Vreemd Vermogen</p>
            <p className={`text-xl font-bold ${data.balans?.vreemdVermogen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.balans?.vreemdVermogen || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-orange-600 font-medium">Eigen Vermogen</p>
            <p className={`text-xl font-bold ${data.balans?.eigenVermogen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.balans?.eigenVermogen || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Netto Resultaat W&V</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 font-medium">Totaal Passiva</p>
            <p className={`text-xl font-bold ${data.balans?.totaalPassiva >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.balans?.totaalPassiva || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Vreemd + Eigen</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-600 font-medium">Balansverschil</p>
            <p className={`text-xl font-bold ${Math.abs(data.balans?.balansVerschil || 0) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
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
                  <p className="text-lg font-semibold text-red-600">
                    {formatCurrency(month.totalDebet)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Credit</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(month.totalCredit)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Netto</p>
                  <p className={`text-lg font-semibold ${month.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(month.netAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Activa</p>
                  <p className={`text-lg font-semibold ${balansMonth?.activa >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(balansMonth?.activa || 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-orange-600 font-medium">Eigen Vermogen</p>
                  <p className={`text-lg font-bold ${balansMonth?.eigenVermogen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

// Category Overview Component (V1 Style Saldo Overzicht)
function CategoryOverview({ data, setSelectedCategory, setSelectedMonth }) {
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
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Categorieoverzicht (op basis van Omschrijving_3)
      </h2>
      
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-800 text-white sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-slate-800 z-10 min-w-[200px] text-xs uppercase tracking-wider">
                  Categorie
                </th>
                {monthHeaders.map(month => (
                  <th key={month.key} className="px-3 py-3 text-center font-semibold min-w-[120px] text-xs uppercase tracking-wider">
                    {month.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold bg-slate-900 min-w-[120px] text-xs uppercase tracking-wider">
                  Totaal
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
                                amount >= 0 ? 'text-green-600' : 'text-red-600'
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
                          categoryTotal.netAmount >= 0 ? 'text-green-600' : 'text-red-600'
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

// Balance Sheet Component
function BalanceSheet({ data, setSelectedCategory, setSelectedMonth }) {
  // Helper function to get category amount for a specific month
  const getCategoryAmount = (monthKey, categoryName) => {
    if (!data.monthlyData) return 0;
    
    const [year, month] = monthKey.split('-');
    const monthData = data.monthlyData.find(m => 
      m.year === parseInt(year) && m.month === parseInt(month)
    );
    
    if (!monthData || !monthData.categorieBreakdown) return 0;
    return monthData.categorieBreakdown[categoryName]?.netAmount || 0;
  };

  // Helper function to get category total across all months
  const getCategoryTotal = (categoryName) => {
    return data.categoryTotals?.[categoryName]?.netAmount || 0;
  };

  // Helper function to get categories by account type with month comparison (exclude account 1650)
  const getCategoriesByAccountType = (accountType) => {
    const categories = {};
    
    data.allRecords.forEach(record => {
      if (record.AccountTypeName === accountType && record.Categorie) {
        if (!categories[record.Categorie]) {
          categories[record.Categorie] = {
            totalDebet: 0,
            totalCredit: 0,
            netAmount: 0,
            recordCount: 0,
            monthlyBreakdown: {},
            yearComparison: {}
          };
        }
        
        categories[record.Categorie].totalDebet += record.Bedrag_debet || 0;
        categories[record.Categorie].totalCredit += record.Bedrag_credit || 0;
        categories[record.Categorie].netAmount = categories[record.Categorie].totalCredit - categories[record.Categorie].totalDebet;
        categories[record.Categorie].recordCount++;
        
        // Monthly breakdown
        const monthKey = `${record.Jaar}-${String(record.Periode).padStart(2, '0')}`;
        if (!categories[record.Categorie].monthlyBreakdown[monthKey]) {
          categories[record.Categorie].monthlyBreakdown[monthKey] = {
            year: record.Jaar,
            month: record.Periode,
            debet: 0,
            credit: 0,
            net: 0
          };
        }
        categories[record.Categorie].monthlyBreakdown[monthKey].debet += record.Bedrag_debet || 0;
        categories[record.Categorie].monthlyBreakdown[monthKey].credit += record.Bedrag_credit || 0;
        categories[record.Categorie].monthlyBreakdown[monthKey].net = 
          categories[record.Categorie].monthlyBreakdown[monthKey].credit - 
          categories[record.Categorie].monthlyBreakdown[monthKey].debet;
          
        // Year comparison by month (same month in different years)
        const monthName = new Date(record.Jaar, record.Periode - 1).toLocaleDateString('nl-NL', { month: 'long' });
        if (!categories[record.Categorie].yearComparison[monthName]) {
          categories[record.Categorie].yearComparison[monthName] = {};
        }
        if (!categories[record.Categorie].yearComparison[monthName][record.Jaar]) {
          categories[record.Categorie].yearComparison[monthName][record.Jaar] = {
            debet: 0,
            credit: 0,
            net: 0
          };
        }
        categories[record.Categorie].yearComparison[monthName][record.Jaar].debet += record.Bedrag_debet || 0;
        categories[record.Categorie].yearComparison[monthName][record.Jaar].credit += record.Bedrag_credit || 0;
        categories[record.Categorie].yearComparison[monthName][record.Jaar].net = 
          categories[record.Categorie].yearComparison[monthName][record.Jaar].credit - 
          categories[record.Categorie].yearComparison[monthName][record.Jaar].debet;
      }
    });
    
    return categories;
  };

  const activaCategories = getCategoriesByAccountType('Activa');
  const passivaCategories = getCategoriesByAccountType('Passiva');
  
  // Get all unique months and years for comparison
  const allMonths = [...new Set(data.monthlyData.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`))].sort();
  
  // Calculate management metrics for each month (needed for W&V netto resultaat calculation)
  const managementData = allMonths.map(monthKey => {
    // OMZET
    const nettoOmzet = getCategoryAmount(monthKey, 'Netto-omzet');
    const overigeOpbrengsten = getCategoryAmount(monthKey, 'Overige opbrengsten');
    const omzet = nettoOmzet + overigeOpbrengsten;
    
    return {
      monthKey,
      nettoOmzet,
      overigeOpbrengsten,
      omzet
    };
  });
  const allYears = [...new Set(data.monthlyData.map(m => m.year))].sort();
  
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Balans - Gedetailleerd overzicht
      </h2>
      
      {/* Activa Tabel */}
      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Activa per Categorie en Maand</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden border border-slate-200">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-slate-800 text-xs font-semibold uppercase tracking-wider">Categorie</th>
                {allMonths.map(monthKey => {
                  const [year, month] = monthKey.split('-');
                  const monthName = month === '00'
                    ? `Beginbalans ${year}`
                    : new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
                  return (
                    <th key={monthKey} className="px-3 py-3 text-center min-w-[100px] text-xs font-semibold uppercase tracking-wider">
                      {monthName}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center bg-slate-900 text-xs font-semibold uppercase tracking-wider">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(activaCategories)
                .sort(([a], [b]) => a.localeCompare(b, 'nl', { sensitivity: 'base' }))
                .map(([category, data]) => (
                <tr key={category} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                    {category}
                  </td>
                  {allMonths.map(monthKey => {
                    const monthData = data.monthlyBreakdown[monthKey];
                    const amount = monthData?.net || 0;
                    return (
                      <td key={monthKey} className="px-3 py-3 text-center text-sm">
                        {amount !== 0 ? (
                          <button
                            onClick={() => {
                              setSelectedCategory(category);
                              setSelectedMonth(monthKey);
                            }}
                            className={`hover:bg-slate-100 px-2 py-1 rounded transition-colors font-semibold ${amount >= 0 ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'}`}
                          >
                            {formatCurrency(amount)}
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-bold bg-slate-50">
                    <button
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedMonth(null);
                      }}
                      className={`hover:bg-slate-200 px-2 py-1 rounded transition-colors font-bold ${data.netAmount >= 0 ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'}`}
                    >
                      {formatCurrency(data.netAmount)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-4 py-3 font-bold text-slate-900 sticky left-0 bg-slate-100">
                  Totaal Activa
                </td>
                {allMonths.map(monthKey => {
                  const monthTotal = Object.values(activaCategories).reduce((sum, categoryData) => {
                    const monthData = categoryData.monthlyBreakdown[monthKey];
                    return sum + (monthData?.net || 0);
                  }, 0);
                  
                  return (
                    <td key={monthKey} className="px-3 py-2 text-center font-bold">
                      {monthTotal !== 0 ? (
                        <span className={monthTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(monthTotal)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center font-bold text-slate-900 bg-slate-200">
                  <span className={Object.values(activaCategories).reduce((sum, cat) => sum + cat.netAmount, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(Object.values(activaCategories).reduce((sum, cat) => sum + cat.netAmount, 0))}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Passiva Tabel */}
      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Passiva per Categorie en Maand (incl. Eigen Vermogen)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden border border-slate-200">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-slate-800 text-xs font-semibold uppercase tracking-wider">Categorie</th>
                {allMonths.map(monthKey => {
                  const [year, month] = monthKey.split('-');
                  const monthName = month === '00'
                    ? `Beginbalans ${year}`
                    : new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
                  return (
                    <th key={monthKey} className="px-3 py-3 text-center min-w-[100px] text-xs font-semibold uppercase tracking-wider">
                      {monthName}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center bg-slate-900 text-xs font-semibold uppercase tracking-wider">Totaal</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {/* Vreemd Vermogen (Passiva categorieën) */}
              {Object.entries(passivaCategories)
                .sort(([a], [b]) => a.localeCompare(b, 'nl', { sensitivity: 'base' }))
                .map(([category, categoryData]) => (
                <tr key={category} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 sticky left-0 bg-white">
                    {category}
                  </td>
                  {allMonths.map(monthKey => {
                    const monthData = categoryData.monthlyBreakdown[monthKey];
                    const amount = monthData?.net || 0;
                    return (
                      <td key={monthKey} className="px-3 py-3 text-center text-sm">
                        {amount !== 0 ? (
                          <button
                            onClick={() => {
                              setSelectedCategory(category);
                              setSelectedMonth(monthKey);
                            }}
                            className={`hover:bg-slate-100 px-2 py-1 rounded transition-colors font-semibold ${amount >= 0 ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'}`}
                          >
                            {formatCurrency(amount)}
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-bold bg-slate-50">
                    <button
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedMonth(null);
                      }}
                      className={`hover:bg-slate-200 px-2 py-1 rounded transition-colors font-bold ${categoryData.netAmount >= 0 ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'}`}
                    >
                      {formatCurrency(categoryData.netAmount)}
                    </button>
                  </td>
                </tr>
              ))}
              
              
              

            </tbody>
            
            <tfoot className="bg-gray-100 border-t-4 border-gray-400">
              {/* Totaal Passiva ex Eigen Vermogen */}
              <tr>
                <td className="px-4 py-2 font-bold text-gray-800 sticky left-0 bg-gray-100">
                  Totaal Passiva (ex Eigen Vermogen)
                </td>
                {allMonths.map(monthKey => {
                  // Bereken totaal passiva uit de getoonde categorieën voor deze maand
                  const monthTotal = Object.values(passivaCategories).reduce((sum, categoryData) => {
                    const monthData = categoryData.monthlyBreakdown[monthKey];
                    return sum + (monthData?.net || 0);
                  }, 0);
                  
                  return (
                    <td key={monthKey} className="px-3 py-2 text-center font-bold">
                      <span className={`text-lg text-red-600`}>
                        {formatCurrency(Math.abs(monthTotal))}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-center font-bold bg-gray-200">
                  <span className={`text-xl text-red-600`}>
                    {(() => {
                      // Bereken totaal passiva uit de getoonde categorieën
                      const grandTotal = Object.values(passivaCategories).reduce((sum, categoryData) => {
                        return sum + categoryData.netAmount;
                      }, 0);
                      return formatCurrency(Math.abs(grandTotal));
                    })()}
                  </span>
                </td>
              </tr>
              
              {/* Eigen Vermogen (Netto Resultaat uit W&V) */}
              <tr className="border-t border-slate-300">
                <td className="px-4 py-2 font-bold text-orange-600 sticky left-0 bg-gray-100">
                  Eigen Vermogen (Netto Resultaat W&V)
                </td>
                {allMonths.map(monthKey => {
                  // Bereken exact netto resultaat zoals in W&V tab
                  const monthData = managementData.find(m => m.monthKey === monthKey);
                  const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                  const totaalOpbrengsten = (monthData?.nettoOmzet || 0) + (monthData?.overigeOpbrengsten || 0) + overigeVoorzieningen;
                  
                  const kostenCategorieen = [
                    'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                    'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                    'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                    'Verkoopkosten', 'Winstbelasting'
                  ];
                  const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                    sum + Math.abs(getCategoryAmount(monthKey, cat)), 0);
                  
                  const nettoResultaat = totaalOpbrengsten - totaalKosten;
                  
                  return (
                    <td key={monthKey} className="px-3 py-2 text-center font-bold">
                      <span className={nettoResultaat >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(nettoResultaat)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-center font-bold bg-orange-50">
                  {(() => {
                    // Bereken totaal netto resultaat exact zoals in W&V tab
                    const totaalOpbrengsten = managementData.reduce((sum, monthData) => {
                      const monthKey = monthData.monthKey;
                      const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                      return sum + monthData.nettoOmzet + monthData.overigeOpbrengsten + overigeVoorzieningen;
                    }, 0);
                    
                    const kostenCategorieen = [
                      'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                      'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                      'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                      'Verkoopkosten', 'Winstbelasting'
                    ];
                    const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                      sum + Math.abs(getCategoryTotal(cat)), 0);
                    
                    const nettoResultaat = totaalOpbrengsten - totaalKosten;
                    return (
                      <span className={nettoResultaat >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(nettoResultaat)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
              
              {/* Totaal Passiva incl Eigen Vermogen */}
              <tr className="border-t-2 border-gray-400 bg-gray-200">
                <td className="px-4 py-2 font-bold text-gray-800 sticky left-0 bg-gray-200">
                  Totaal Passiva (incl. Eigen Vermogen)
                </td>
                {allMonths.map(monthKey => {
                  // Bereken totaal passiva uit de getoonde categorieën voor deze maand
                  const monthTotalPassiva = Object.values(passivaCategories).reduce((sum, categoryData) => {
                    const monthData = categoryData.monthlyBreakdown[monthKey];
                    return sum + (monthData?.net || 0);
                  }, 0);
                  
                  // Bereken exact netto resultaat zoals in W&V tab voor deze maand
                  const monthData = managementData.find(m => m.monthKey === monthKey);
                  const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                  const totaalOpbrengsten = (monthData?.nettoOmzet || 0) + (monthData?.overigeOpbrengsten || 0) + overigeVoorzieningen;
                  
                  const kostenCategorieen = [
                    'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                    'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                    'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                    'Verkoopkosten', 'Winstbelasting'
                  ];
                  const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                    sum + Math.abs(getCategoryAmount(monthKey, cat)), 0);
                  
                  const nettoResultaat = totaalOpbrengsten - totaalKosten;
                  const totaalPassivaInclusief = Math.abs(monthTotalPassiva) + nettoResultaat;
                  
                  return (
                    <td key={monthKey} className="px-3 py-2 text-center font-bold">
                      <span className={`text-lg ${totaalPassivaInclusief >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(totaalPassivaInclusief)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-center font-bold bg-gray-300">
                  {(() => {
                    // Bereken totaal passiva uit de getoonde categorieën
                    const grandTotalPassiva = Object.values(passivaCategories).reduce((sum, categoryData) => {
                      return sum + categoryData.netAmount;
                    }, 0);
                    
                    // Bereken totaal netto resultaat exact zoals in W&V tab
                    const totaalOpbrengsten = managementData.reduce((sum, monthData) => {
                      const monthKey = monthData.monthKey;
                      const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                      return sum + monthData.nettoOmzet + monthData.overigeOpbrengsten + overigeVoorzieningen;
                    }, 0);
                    
                    const kostenCategorieen = [
                      'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                      'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                      'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                      'Verkoopkosten', 'Winstbelasting'
                    ];
                    const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                      sum + Math.abs(getCategoryTotal(cat)), 0);
                    
                    const nettoResultaat = totaalOpbrengsten - totaalKosten;
                    const totaalPassivaInclusief = Math.abs(grandTotalPassiva) + nettoResultaat;
                    
                    return (
                      <span className={`text-xl ${totaalPassivaInclusief >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(totaalPassivaInclusief)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
              
              {/* Balanscontrole rij */}
              <tr className="bg-blue-50 border-t-2 border-blue-300">
                <td className="px-4 py-2 font-bold text-blue-800 sticky left-0 bg-blue-50">
                  Balansverschil (Activa - Totaal Passiva)
                </td>
                {allMonths.map(monthKey => {
                  // Bereken activa voor deze maand
                  const monthActiva = Object.values(activaCategories).reduce((sum, categoryData) => {
                    const monthData = categoryData.monthlyBreakdown[monthKey];
                    return sum + (monthData?.net || 0);
                  }, 0);
                  
                  // Bereken totaal passiva + eigen vermogen voor deze maand
                  const monthTotalPassiva = Object.values(passivaCategories).reduce((sum, categoryData) => {
                    const monthData = categoryData.monthlyBreakdown[monthKey];
                    return sum + (monthData?.net || 0);
                  }, 0);
                  
                  const monthData = managementData.find(m => m.monthKey === monthKey);
                  const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                  const totaalOpbrengsten = (monthData?.nettoOmzet || 0) + (monthData?.overigeOpbrengsten || 0) + overigeVoorzieningen;
                  
                  const kostenCategorieen = [
                    'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                    'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                    'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                    'Verkoopkosten', 'Winstbelasting'
                  ];
                  const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                    sum + Math.abs(getCategoryAmount(monthKey, cat)), 0);
                  
                  const nettoResultaat = totaalOpbrengsten - totaalKosten;
                  const totaalPassivaInclusief = Math.abs(monthTotalPassiva) + nettoResultaat;
                  
                  // Balanscontrole: Activa - (Totaal Passiva incl Eigen Vermogen) = 0
                  const balansVerschil = monthActiva - totaalPassivaInclusief;
                  const isBalanced = Math.abs(balansVerschil) < 0.01;
                  
                  return (
                    <td key={monthKey} className="px-3 py-2 text-center font-bold">
                      <span className={`text-sm ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(balansVerschil)}
                        {isBalanced && <span className="ml-1">✓</span>}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-center font-bold bg-blue-100">
                  {(() => {
                    // Bereken totaal activa
                    const grandTotalActiva = Object.values(activaCategories).reduce((sum, categoryData) => {
                      return sum + categoryData.netAmount;
                    }, 0);
                    
                    // Bereken totaal passiva + eigen vermogen
                    const grandTotalPassiva = Object.values(passivaCategories).reduce((sum, categoryData) => {
                      return sum + categoryData.netAmount;
                    }, 0);
                    
                    const totaalOpbrengsten = managementData.reduce((sum, monthData) => {
                      const monthKey = monthData.monthKey;
                      const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                      return sum + monthData.nettoOmzet + monthData.overigeOpbrengsten + overigeVoorzieningen;
                    }, 0);
                    
                    const kostenCategorieen = [
                      'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                      'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                      'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                      'Verkoopkosten', 'Winstbelasting'
                    ];
                    const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                      sum + Math.abs(getCategoryTotal(cat)), 0);
                    
                    const nettoResultaat = totaalOpbrengsten - totaalKosten;
                    const totaalPassivaInclusief = Math.abs(grandTotalPassiva) + nettoResultaat;
                    
                    const balansVerschil = grandTotalActiva - totaalPassivaInclusief;
                    const isBalanced = Math.abs(balansVerschil) < 0.01;
                    
                    return (
                      <span className={`text-sm ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(balansVerschil)}
                        {isBalanced && <span className="ml-1">✓</span>}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Balans Controle */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Balans Controle</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
            <p className="text-sm text-green-600 font-medium">Totaal Activa</p>
            <p className={`text-xl font-bold ${data.balans?.activa >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.balans?.activa || 0)}
            </p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700 font-medium">Totaal Passiva</p>
            <p className={`text-xl font-bold ${data.balans?.totaalPassiva >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.balans?.totaalPassiva || 0)}
            </p>
            <p className="text-xs text-slate-600 mt-1">Vreemd + Eigen Vermogen</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-600 font-medium">Eigen Vermogen</p>
            <p className={`text-xl font-bold ${data.balans?.eigenVermogen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.balans?.eigenVermogen || 0)}
            </p>
            <p className="text-xs text-orange-500 mt-1">Activa - Vreemd Vermogen</p>
          </div>
        </div>
      </div>

      {/* Year-over-Year Comparison */}
      {allYears.length > 1 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Jaarvergelijking (Dezelfde maand in verschillende jaren)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Activa Year Comparison */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-3">Activa - Jaarvergelijking</h4>
              {Object.entries(activaCategories).slice(0, 3).map(([category, categoryData]) => (
                <div key={category} className="mb-4 bg-white rounded-lg p-3">
                  <h5 className="font-medium text-gray-800 mb-2">{category}</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1">Maand</th>
                          {allYears.map(year => (
                            <th key={year} className="text-center py-1">{year}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(categoryData.yearComparison).map(([monthName, yearData]) => (
                          <tr key={monthName} className="border-b">
                            <td className="py-1 font-medium">{monthName}</td>
                            {allYears.map(year => {
                              const amount = yearData[year]?.net || 0;
                              return (
                                <td key={year} className="text-center py-1">
                                  {amount !== 0 ? (
                                    <span className={amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {formatCurrency(amount)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* Passiva Year Comparison */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-3">Passiva - Jaarvergelijking</h4>
              {Object.entries(passivaCategories).slice(0, 3).map(([category, categoryData]) => (
                <div key={category} className="mb-4 bg-white rounded-lg p-3">
                  <h5 className="font-medium text-gray-800 mb-2">{category}</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1">Maand</th>
                          {allYears.map(year => (
                            <th key={year} className="text-center py-1">{year}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(categoryData.yearComparison).map(([monthName, yearData]) => (
                          <tr key={monthName} className="border-b">
                            <td className="py-1 font-medium">{monthName}</td>
                            {allYears.map(year => {
                              const amount = yearData[year]?.net || 0;
                              return (
                                <td key={year} className="text-center py-1">
                                  {amount !== 0 ? (
                                    <span className={amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {formatCurrency(amount)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// W&V (Winst & Verlies) Component
function ManagementRapportage({ data, setSelectedCategory, setSelectedMonth }) {
  // Helper function to get category amount for a specific month (only Grootboekrekening + Kosten/Opbrengsten)
  const getCategoryAmount = (monthKey, category) => {
    const monthData = data.monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const categoryRecords = monthData?.records?.filter(r => 
      r.Categorie === category && 
      r.Kenmerk_rekening === "Grootboekrekening" &&
      (r.AccountTypeName === "Kosten" || r.AccountTypeName === "Opbrengsten")
    ) || [];
    return categoryRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Helper function to get the main category for drill-down
  const getCategoryForDrillDown = (lineItem) => {
    const categoryMapping = {
      'Omzet': 'Netto-omzet',
      'Inkoopwaarde omzet': 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
      'Autokosten': 'Autokosten en transportkosten',
      'Marketingkosten': 'Verkoopkosten',
      'Huisvestingskosten': 'Huisvestingskosten',
      'Overige kosten': 'Andere kosten'
    };
    return categoryMapping[lineItem] || lineItem;
  };

  // Helper function to create clickable amount button
  const createClickableAmount = (amount, category, monthKey = null, isPositive = true) => {
    const colorClass = isPositive ? 
      (amount >= 0 ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700') :
      'text-red-600 hover:text-red-700';
    
    return (
      <button
        onClick={() => {
          setSelectedCategory(category);
          setSelectedMonth(monthKey);
        }}
        className={`hover:bg-slate-100 px-2 py-1 rounded transition-colors font-semibold ${colorClass}`}
      >
        {formatCurrency(amount)}
      </button>
    );
  };

  // Helper function for summary/total rows (show all categories)
  const createSummaryClickableAmount = (amount, monthKey = null, isPositive = true) => {
    const colorClass = isPositive ? 
      (amount >= 0 ? 'text-slate-700 hover:text-slate-900' : 'text-red-600 hover:text-red-700') :
      'text-red-600 hover:text-red-700';
    
    return (
      <button
        onClick={() => {
          setSelectedCategory('ALLE_CATEGORIEËN');
          setSelectedMonth(monthKey);
        }}
        className={`hover:bg-slate-200 px-2 py-1 rounded transition-colors font-bold ${colorClass}`}
      >
        {formatCurrency(amount)}
      </button>
    );
  };

  // Helper function to get category total amount (only Grootboekrekening + Kosten/Opbrengsten)
  const getCategoryTotal = (category) => {
    const categoryRecords = data.allRecords?.filter(r => 
      r.Categorie === category && 
      r.Kenmerk_rekening === "Grootboekrekening" &&
      (r.AccountTypeName === "Kosten" || r.AccountTypeName === "Opbrengsten")
    ) || [];
    return categoryRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Get all unique months from the data
  const allMonths = [...new Set(data.monthlyData.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`))].sort();
  
  // Create month names for headers
  const monthHeaders = allMonths.map(monthKey => {
    const [year, month] = monthKey.split('-');
    return {
      key: monthKey,
      name: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
    };
  });

  // Calculate management metrics for each month based on AFAS categories
  const managementData = allMonths.map(monthKey => {
    // OMZET
    const nettoOmzet = getCategoryAmount(monthKey, 'Netto-omzet');
    const overigeOpbrengsten = getCategoryAmount(monthKey, 'Overige opbrengsten');
    const omzet = nettoOmzet + overigeOpbrengsten;
    
    // KOSTEN VAN DE OMZET
    const inkoopwaarde = getCategoryAmount(monthKey, 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen');
    
    // BRUTO MARGE
    const brutomarge = omzet - Math.abs(inkoopwaarde);
    const brutomargePercentage = omzet !== 0 ? (brutomarge / omzet) * 100 : 0;
    
    // PERSONEELSKOSTEN DIRECT
    const lonen = getCategoryAmount(monthKey, 'Lonen en salarissen');
    const socialeLasten = getCategoryAmount(monthKey, 'Sociale lasten');
    const personeelskostenDirect = Math.abs(lonen) + Math.abs(socialeLasten);
    
    // MARGE
    const marge = brutomarge - personeelskostenDirect;
    const margePercentage = omzet !== 0 ? (marge / omzet) * 100 : 0;
    
    // OVERIGE PERSONEELSKOSTEN
    const overigePersoneelskosten = getCategoryAmount(monthKey, 'Overige personeelskosten');
    const pensioenlasten = getCategoryAmount(monthKey, 'Pensioenlasten');
    const operationelePersoneelskosten = Math.abs(overigePersoneelskosten) + Math.abs(pensioenlasten);
    
    // AUTOKOSTEN & MARKETING
    const autokosten = getCategoryAmount(monthKey, 'Autokosten en transportkosten');
    const verkoopkosten = getCategoryAmount(monthKey, 'Verkoopkosten'); // Marketing
    
    // CONTRIBUTIEMARGE
    const contributiemarge = marge - operationelePersoneelskosten - Math.abs(autokosten) - Math.abs(verkoopkosten);
    const contributiemargePercentage = omzet !== 0 ? (contributiemarge / omzet) * 100 : 0;
    
    // ALGEMENE KOSTEN
    const huisvestingskosten = getCategoryAmount(monthKey, 'Huisvestingskosten');
    const andereKosten = getCategoryAmount(monthKey, 'Andere kosten');
    const totaleKosten = Math.abs(huisvestingskosten) + Math.abs(andereKosten);
    
    // EBITDA
    const ebitdaGenormaliseerd = contributiemarge - totaleKosten;
    const ebitdaVsMargePercentage = omzet !== 0 ? (ebitdaGenormaliseerd / omzet) * 100 : 0;
    
    // AFSCHRIJVINGEN
    const afschrijvingskosten = getCategoryAmount(monthKey, 'Andere vaste bedrijfsmiddelen, afschrijving');
    
    // EBIT
    const ebit = ebitdaGenormaliseerd - Math.abs(afschrijvingskosten);
    
    // BELASTINGEN (23%)
    const vpb = ebit > 0 ? ebit * 0.23 : 0;
    
    // RESULTAAT NA BELASTING
    const resultaatNaBelasting = ebit - vpb;
    const nettoResultaatOmzetPercentage = omzet !== 0 ? (resultaatNaBelasting / omzet) * 100 : 0;

    return {
      monthKey,
      // Omzet componenten
      nettoOmzet,
      overigeOpbrengsten,
      omzet,
      // Kosten van omzet
      inkoopwaarde,
      // Marges
      brutomarge,
      brutomargePercentage,
      // Personeelskosten
      lonen,
      socialeLasten,
      personeelskostenDirect,
      marge,
      margePercentage,
      // Overige personeelskosten
      overigePersoneelskosten,
      pensioenlasten,
      operationelePersoneelskosten,
      // Auto & Marketing
      autokosten,
      verkoopkosten,
      // Contributiemarge
      contributiemarge,
      contributiemargePercentage,
      // Algemene kosten
      huisvestingskosten,
      andereKosten,
      totaleKosten,
      // EBITDA
      ebitdaGenormaliseerd,
      ebitdaVsMargePercentage,
      // Afschrijvingen
      afschrijvingskosten,
      // EBIT
      ebit,
      // Belastingen
      vpb,
      // Resultaat
      resultaatNaBelasting,
      nettoResultaatOmzetPercentage
    };
  });

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">
        Winst & Verlies
      </h2>

      {/* W&V Table - exact zoals in v1 */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-800 bg-gray-50 px-6 py-4 border-b">
          Winst & Verlies Overzicht
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 min-w-[200px]">
                  Omschrijving
                </th>
                {monthHeaders.map(month => (
                  <th key={month.key} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                    {month.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Totaal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Omzet */}
                              <tr className="bg-slate-100">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900 sticky left-0 bg-slate-100">
                  Omzet
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(data.omzet, getCategoryForDrillDown('Omzet'), data.monthKey, true)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-200">
                  {createClickableAmount(managementData.reduce((sum, data) => sum + data.omzet, 0), getCategoryForDrillDown('Omzet'), null, true)}
                </td>
              </tr>
              
              {/* Inkoopwaarde omzet */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Inkoopwaarde omzet
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(-Math.abs(data.inkoopwaarde), getCategoryForDrillDown('Inkoopwaarde omzet'), data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                  {createClickableAmount(-Math.abs(managementData.reduce((sum, data) => sum + Math.abs(data.inkoopwaarde), 0)), getCategoryForDrillDown('Inkoopwaarde omzet'), null, false)}
                </td>
              </tr>

              {/* Personeelskosten direct - samengesteld */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Personeelskosten direct
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(-data.personeelskostenDirect, 'Lonen en salarissen', data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                  {createClickableAmount(-managementData.reduce((sum, data) => sum + data.personeelskostenDirect, 0), 'Lonen en salarissen', null, false)}
                </td>
              </tr>

              {/* Marge */}
                              <tr className="bg-slate-100 border-t-2 border-slate-300">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-900 sticky left-0 bg-slate-100">
                  Marge
                </td>
                {managementData.map(data => (
                                      <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold text-slate-900">
                    {formatCurrency(data.marge)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-slate-900 bg-slate-200">
                  {formatCurrency(managementData.reduce((sum, data) => sum + data.marge, 0))}
                </td>
              </tr>

              {/* % Marge */}
                              <tr className="bg-slate-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900 sticky left-0 bg-slate-50">
                  % Marge
                </td>
                {managementData.map(data => (
                                      <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-semibold text-slate-900">
                    {data.margePercentage.toFixed(0)}%
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-slate-900">
                  {((managementData.reduce((sum, data) => sum + data.marge, 0) / managementData.reduce((sum, data) => sum + data.omzet, 0)) * 100).toFixed(0)}%
                </td>
              </tr>

              {/* Autokosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Autokosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(-Math.abs(data.autokosten), getCategoryForDrillDown('Autokosten'), data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                  {createClickableAmount(-Math.abs(managementData.reduce((sum, data) => sum + Math.abs(data.autokosten), 0)), getCategoryForDrillDown('Autokosten'), null, false)}
                </td>
              </tr>

              {/* Marketingkosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Marketingkosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(-Math.abs(data.verkoopkosten), getCategoryForDrillDown('Marketingkosten'), data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                  {createClickableAmount(-Math.abs(managementData.reduce((sum, data) => sum + Math.abs(data.verkoopkosten), 0)), getCategoryForDrillDown('Marketingkosten'), null, false)}
                </td>
              </tr>

              {/* Operationele personeelskosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Operationele personeelskosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(-data.operationelePersoneelskosten, 'Overige personeelskosten', data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                  {createClickableAmount(-managementData.reduce((sum, data) => sum + data.operationelePersoneelskosten, 0), 'Overige personeelskosten', null, false)}
                </td>
              </tr>

              {/* Contributiemarge en sectie 'Kosten' verwijderd op verzoek */}

              {/* Huisvestingskosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Huisvestingskosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(-Math.abs(data.huisvestingskosten), getCategoryForDrillDown('Huisvestingskosten'), data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                  {createClickableAmount(-Math.abs(managementData.reduce((sum, data) => sum + Math.abs(data.huisvestingskosten), 0)), getCategoryForDrillDown('Huisvestingskosten'), null, false)}
                </td>
              </tr>

              {/* Kantoorkosten - placeholder */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Kantoorkosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center text-red-600">
                    {formatCurrency(0)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-red-600">
                  {formatCurrency(0)}
                </td>
              </tr>

              {/* Algemene kosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Algemene kosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(-Math.abs(data.andereKosten), getCategoryForDrillDown('Overige kosten'), data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                  {createClickableAmount(-Math.abs(managementData.reduce((sum, data) => sum + Math.abs(data.andereKosten), 0)), getCategoryForDrillDown('Overige kosten'), null, false)}
                </td>
              </tr>

              {/* Totale kosten */}
              <tr className="bg-slate-100 border-t">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-900 sticky left-0 bg-slate-100">
                  Totale kosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createSummaryClickableAmount(-data.totaleKosten, data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-200">
                  {createSummaryClickableAmount(-managementData.reduce((sum, data) => sum + data.totaleKosten, 0), null, false)}
                </td>
              </tr>

              {/* EBITDA genormaliseerd */}
              <tr className="bg-slate-200 border-t-2">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-900 sticky left-0 bg-slate-200">
                  EBITDA genormaliseerd
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createSummaryClickableAmount(data.ebitdaGenormaliseerd, data.monthKey, true)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-300">
                  {createSummaryClickableAmount(managementData.reduce((sum, data) => sum + data.ebitdaGenormaliseerd, 0), null, true)}
                </td>
              </tr>

              {/* EBITDA vs. MARGE (%) */}
              <tr className="bg-purple-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-purple-50">
                  EBITDA vs. MARGE (%)
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-semibold text-purple-700">
                    {data.ebitdaVsMargePercentage.toFixed(0)}%
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-purple-700">
                  {((managementData.reduce((sum, data) => sum + data.ebitdaGenormaliseerd, 0) / managementData.reduce((sum, data) => sum + data.omzet, 0)) * 100).toFixed(0)}%
                </td>
              </tr>

              {/* Afschrijvingskosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Afschrijvingskosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(-Math.abs(data.afschrijvingskosten), 'Andere vaste bedrijfsmiddelen, afschrijving', data.monthKey, false)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                  {createClickableAmount(-Math.abs(managementData.reduce((sum, data) => sum + Math.abs(data.afschrijvingskosten), 0)), 'Andere vaste bedrijfsmiddelen, afschrijving', null, false)}
                </td>
              </tr>

              {/* Financieringskosten - placeholder */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Financieringskosten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center text-red-600">
                    {formatCurrency(0)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-red-600">
                  {formatCurrency(0)}
                </td>
              </tr>

              {/* EBIT */}
              <tr className="bg-slate-200 border-t-2">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-900 sticky left-0 bg-slate-200">
                  EBIT
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createSummaryClickableAmount(data.ebit, data.monthKey, true)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-300">
                  {createSummaryClickableAmount(managementData.reduce((sum, data) => sum + data.ebit, 0), null, true)}
                </td>
              </tr>

              {/* VPB (stel: 23%) */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  VPB (stel: 23%)
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center text-red-600">
                    {formatCurrency(-data.vpb)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-red-600">
                  {formatCurrency(-managementData.reduce((sum, data) => sum + data.vpb, 0))}
                </td>
              </tr>

              {/* RESULTAAT NA BELASTING */}
              <tr className="bg-slate-300 border-t-2">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-900 sticky left-0 bg-slate-300">
                  RESULTAAT NA BELASTING
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createSummaryClickableAmount(data.resultaatNaBelasting, data.monthKey, true)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-400">
                  {createSummaryClickableAmount(managementData.reduce((sum, data) => sum + data.resultaatNaBelasting, 0), null, true)}
                </td>
              </tr>

              {/* Netto resultaat / omzet */}
              <tr className="bg-gray-100">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-gray-100">
                  Netto resultaat / omzet
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className={`px-3 py-3 whitespace-nowrap text-sm text-center font-semibold ${data.nettoResultaatOmzetPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.nettoResultaatOmzetPercentage.toFixed(0)}%
                  </td>
                ))}
                <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-bold ${((managementData.reduce((sum, data) => sum + data.resultaatNaBelasting, 0) / managementData.reduce((sum, data) => sum + data.omzet, 0)) * 100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {((managementData.reduce((sum, data) => sum + data.resultaatNaBelasting, 0) / managementData.reduce((sum, data) => sum + data.omzet, 0)) * 100).toFixed(0)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* NIEUWE VERBETERDE W&V - Met duidelijk onderscheid Opbrengsten vs Kosten */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mt-8">
        <h3 className="text-lg font-semibold text-gray-800 bg-green-50 px-6 py-4 border-b">
          Winst & Verlies - Verbeterde Categorisering
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 min-w-[200px]">
                  Omschrijving
                </th>
                {monthHeaders.map(month => (
                  <th key={month.key} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                    {month.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Totaal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              
              {/* OPBRENGSTEN SECTIE */}
              <tr className="bg-green-100 border-t-4 border-green-400">
                <td colSpan={monthHeaders.length + 2} className="px-4 py-3 text-center text-lg font-bold text-green-800">
                  OPBRENGSTEN
                </td>
              </tr>
              
              {/* Netto-omzet */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Netto-omzet
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(data.nettoOmzet, 'Netto-omzet', data.monthKey, true)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-green-50">
                  {createClickableAmount(managementData.reduce((sum, data) => sum + data.nettoOmzet, 0), 'Netto-omzet', null, true)}
                </td>
              </tr>
              
              {/* Overige opbrengsten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Overige opbrengsten
                </td>
                {managementData.map(data => (
                  <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {createClickableAmount(data.overigeOpbrengsten, 'Overige opbrengsten', data.monthKey, true)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-green-50">
                  {createClickableAmount(managementData.reduce((sum, data) => sum + data.overigeOpbrengsten, 0), 'Overige opbrengsten', null, true)}
                </td>
              </tr>
              
              {/* Overige voorzieningen */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Overige voorzieningen
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Overige voorzieningen');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(amount, 'Overige voorzieningen', monthKey, true)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-green-50">
                  {createClickableAmount(getCategoryTotal('Overige voorzieningen'), 'Overige voorzieningen', null, true)}
                </td>
              </tr>
              
              {/* Totaal Opbrengsten */}
              <tr className="bg-green-100 border-t-2 border-green-300">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-800 sticky left-0 bg-green-100">
                  Totaal Opbrengsten
                </td>
                {managementData.map(data => {
                  const monthKey = data.monthKey;
                  const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                  const totaalOpbrengsten = data.nettoOmzet + data.overigeOpbrengsten + overigeVoorzieningen;
                  return (
                    <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold text-green-600">
                      {formatCurrency(totaalOpbrengsten)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-green-600 bg-green-200">
                  {formatCurrency(managementData.reduce((sum, data) => {
                    const monthKey = data.monthKey;
                    const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                    return sum + data.nettoOmzet + data.overigeOpbrengsten + overigeVoorzieningen;
                  }, 0))}
                </td>
              </tr>
              
              {/* KOSTEN SECTIE */}
              <tr className="bg-red-100 border-t-4 border-red-400">
                <td colSpan={monthHeaders.length + 2} className="px-4 py-3 text-center text-lg font-bold text-red-800">
                  KOSTEN
                </td>
              </tr>
              
              {/* Andere kosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Andere kosten
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Andere kosten');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Andere kosten', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Andere kosten')), 'Andere kosten', null, false)}
                </td>
              </tr>
              
              {/* Andere vaste bedrijfsmiddelen, afschrijving */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Andere vaste bedrijfsmiddelen, afschrijving
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Andere vaste bedrijfsmiddelen, afschrijving');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Andere vaste bedrijfsmiddelen, afschrijving', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Andere vaste bedrijfsmiddelen, afschrijving')), 'Andere vaste bedrijfsmiddelen, afschrijving', null, false)}
                </td>
              </tr>
              
              {/* Autokosten en transportkosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Autokosten en transportkosten
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Autokosten en transportkosten');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Autokosten en transportkosten', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Autokosten en transportkosten')), 'Autokosten en transportkosten', null, false)}
                </td>
              </tr>
              
              {/* Huisvestingskosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Huisvestingskosten
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Huisvestingskosten');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Huisvestingskosten', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Huisvestingskosten')), 'Huisvestingskosten', null, false)}
                </td>
              </tr>
              
              {/* Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen')), 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen', null, false)}
                </td>
              </tr>
              
              {/* Lonen en salarissen */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Lonen en salarissen
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Lonen en salarissen');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Lonen en salarissen', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Lonen en salarissen')), 'Lonen en salarissen', null, false)}
                </td>
              </tr>
              
              {/* Overige personeelskosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Overige personeelskosten
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Overige personeelskosten');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Overige personeelskosten', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Overige personeelskosten')), 'Overige personeelskosten', null, false)}
                </td>
              </tr>
              
              {/* Pensioenlasten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Pensioenlasten
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Pensioenlasten');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Pensioenlasten', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Pensioenlasten')), 'Pensioenlasten', null, false)}
                </td>
              </tr>
              
              {/* Sociale lasten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Sociale lasten
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Sociale lasten');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Sociale lasten', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Sociale lasten')), 'Sociale lasten', null, false)}
                </td>
              </tr>
              
              {/* Verkoopkosten */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Verkoopkosten
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Verkoopkosten');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Verkoopkosten', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Verkoopkosten')), 'Verkoopkosten', null, false)}
                </td>
              </tr>
              
              {/* Winstbelasting */}
              <tr>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                  Winstbelasting
                </td>
                {allMonths.map(monthKey => {
                  const amount = getCategoryAmount(monthKey, 'Winstbelasting');
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      {createClickableAmount(-Math.abs(amount), 'Winstbelasting', monthKey, false)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-red-50">
                  {createClickableAmount(-Math.abs(getCategoryTotal('Winstbelasting')), 'Winstbelasting', null, false)}
                </td>
              </tr>
              
              {/* Totaal Kosten */}
              <tr className="bg-red-100 border-t-2 border-red-300">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-red-800 sticky left-0 bg-red-100">
                  Totaal Kosten
                </td>
                {allMonths.map(monthKey => {
                  const kostenCategorieen = [
                    'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                    'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                    'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                    'Verkoopkosten', 'Winstbelasting'
                  ];
                  const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                    sum + Math.abs(getCategoryAmount(monthKey, cat)), 0);
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold text-red-600">
                      {formatCurrency(-totaalKosten)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-red-600 bg-red-200">
                  {(() => {
                    const kostenCategorieen = [
                      'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                      'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                      'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                      'Verkoopkosten', 'Winstbelasting'
                    ];
                    const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                      sum + Math.abs(getCategoryTotal(cat)), 0);
                    return formatCurrency(-totaalKosten);
                  })()}
                </td>
              </tr>
              
              {/* RESULTAAT */}
              <tr className="bg-blue-100 border-t-4 border-blue-400">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-800 sticky left-0 bg-blue-100">
                  NETTO RESULTAAT
                </td>
                {allMonths.map(monthKey => {
                  const data = managementData.find(m => m.monthKey === monthKey);
                  const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                  const totaalOpbrengsten = (data?.nettoOmzet || 0) + (data?.overigeOpbrengsten || 0) + overigeVoorzieningen;
                  
                  const kostenCategorieen = [
                    'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                    'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                    'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                    'Verkoopkosten', 'Winstbelasting'
                  ];
                  const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                    sum + Math.abs(getCategoryAmount(monthKey, cat)), 0);
                  
                  const nettoResultaat = totaalOpbrengsten - totaalKosten;
                  return (
                    <td key={monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold">
                      <span className={nettoResultaat >= 0 ? 'text-blue-600' : 'text-red-600'}>
                        {formatCurrency(nettoResultaat)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-blue-200">
                  {(() => {
                    const totaalOpbrengsten = managementData.reduce((sum, data) => {
                      const monthKey = data.monthKey;
                      const overigeVoorzieningen = getCategoryAmount(monthKey, 'Overige voorzieningen');
                      return sum + data.nettoOmzet + data.overigeOpbrengsten + overigeVoorzieningen;
                    }, 0);
                    
                    const kostenCategorieen = [
                      'Andere kosten', 'Andere vaste bedrijfsmiddelen, afschrijving', 'Autokosten en transportkosten',
                      'Huisvestingskosten', 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen',
                      'Lonen en salarissen', 'Overige personeelskosten', 'Pensioenlasten', 'Sociale lasten',
                      'Verkoopkosten', 'Winstbelasting'
                    ];
                    const totaalKosten = kostenCategorieen.reduce((sum, cat) => 
                      sum + Math.abs(getCategoryTotal(cat)), 0);
                    
                    const nettoResultaat = totaalOpbrengsten - totaalKosten;
                    return (
                      <span className={nettoResultaat >= 0 ? 'text-blue-600' : 'text-red-600'}>
                        {formatCurrency(nettoResultaat)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
              
            </tbody>
          </table>
        </div>
      </div>



    </div>
  );
}

// Financial Checks Component
function FinancialChecks({ data }) {
  const [viewMode, setViewMode] = useState('byMonth'); // 'byMonth' or 'overall'
  const [selectedMonth, setSelectedMonth] = useState(null);

  if (!data || !data.financialChecks) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Geen financiële checks beschikbaar</h3>
        <p className="mt-1 text-sm text-gray-500">
          De financiële checks kunnen niet worden uitgevoerd zonder data.
        </p>
      </div>
    );
  }

  const financialChecks = data.financialChecks;
  const monthlyChecks = financialChecks.byMonth || {};
  const overallChecks = financialChecks.overall || [];

  // For backward compatibility, if data.financialChecks is an array (old format)
  const checks = Array.isArray(financialChecks) ? financialChecks : 
    (viewMode === 'byMonth' && selectedMonth ? monthlyChecks[selectedMonth]?.checks || [] : overallChecks);
  
  // Count checks by status
  const statusCounts = checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});

  // Get available months for monthly view
  const availableMonths = Object.keys(monthlyChecks).sort();

  const getStatusColor = (status) => {
    switch (status) {
      case 'OK': return 'text-green-600 bg-green-50 border-green-200';
      case 'WAARSCHUWING': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'INFO': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'GEEN_DATA': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'OK': return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
      case 'WAARSCHUWING': return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
      case 'INFO': return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
      default: return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
        </svg>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">Financiële Controles Dashboard</h2>
        <p className="text-slate-200 mb-4">
          Geautomatiseerde controles voor financiële integriteit en consistentie
        </p>
        
        {/* View mode selector */}
        <div className="mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setViewMode('byMonth');
                setSelectedMonth(availableMonths[0] || null);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'byMonth' 
                  ? 'bg-white text-slate-800' 
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              Per Maand
            </button>
            <button
              onClick={() => setViewMode('overall')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'overall' 
                  ? 'bg-white text-slate-800' 
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              Totaal Overzicht
            </button>
          </div>
        </div>

        {/* Month selector for monthly view */}
        {viewMode === 'byMonth' && availableMonths.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Selecteer Maand:
            </label>
            <select
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-white focus:border-white"
            >
              <option value="">Kies een maand...</option>
              {availableMonths.map(monthKey => {
                const monthData = monthlyChecks[monthKey];
                return (
                  <option key={monthKey} value={monthKey}>
                    {monthData?.monthName || monthKey}
                  </option>
                );
              })}
            </select>
          </div>
        )}
        
        {/* Status overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-green-600 bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{statusCounts.OK || 0}</div>
            <div className="text-sm">OK</div>
          </div>
          <div className="bg-amber-500 bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{statusCounts.WAARSCHUWING || 0}</div>
            <div className="text-sm">Waarschuwingen</div>
          </div>
          <div className="bg-blue-500 bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{statusCounts.INFO || 0}</div>
            <div className="text-sm">Info</div>
          </div>
          <div className="bg-gray-500 bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{statusCounts.GEEN_DATA || 0}</div>
            <div className="text-sm">Geen Data</div>
          </div>
        </div>
      </div>

      {/* Monthly checks overview */}
      {viewMode === 'byMonth' && availableMonths.length > 0 && !selectedMonth && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Maandoverzicht - Selecteer een maand voor details</h3>
          <div className="grid gap-4">
            {availableMonths.map(monthKey => {
              const monthData = monthlyChecks[monthKey];
              const monthChecks = monthData?.checks || [];
              const monthStatusCounts = monthChecks.reduce((acc, check) => {
                acc[check.status] = (acc[check.status] || 0) + 1;
                return acc;
              }, {});
              
              return (
                <div 
                  key={monthKey} 
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedMonth(monthKey)}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gray-900">
                      {monthData?.monthName || monthKey}
                    </h4>
                    <div className="flex gap-2">
                      {monthStatusCounts.OK && (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                          {monthStatusCounts.OK} OK
                        </span>
                      )}
                      {monthStatusCounts.WAARSCHUWING && (
                        <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">
                          {monthStatusCounts.WAARSCHUWING} Waarschuwing
                        </span>
                      )}
                      {monthStatusCounts.INFO && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                          {monthStatusCounts.INFO} Info
                        </span>
                      )}
                      {monthStatusCounts.GEEN_DATA && (
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                          {monthStatusCounts.GEEN_DATA} Geen Data
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Checks grid */}
      {checks.length > 0 && (
        <div className="grid gap-6">
          {checks.map((check) => (
            <CheckCard key={check.id} check={check} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} />
          ))}
        </div>
      )}

      {/* No checks message */}
      {checks.length === 0 && (viewMode === 'overall' || selectedMonth) && (
        <div className="text-center py-8 bg-white rounded-lg shadow-sm border border-slate-200">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Geen checks beschikbaar</h3>
          <p className="mt-1 text-sm text-gray-500">
            {viewMode === 'byMonth' ? 'Voor deze maand zijn geen checks beschikbaar.' : 'Er zijn geen totaal checks beschikbaar.'}
          </p>
        </div>
      )}
    </div>
  );
}

// Individual Check Card Component
function CheckCard({ check, getStatusColor, getStatusIcon }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden ${getStatusColor(check.status)}`}>
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-opacity-80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {getStatusIcon(check.status)}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {check.id}. {check.name}
              </h3>
              <p className="text-sm opacity-90 mt-1">
                {check.description}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(check.status)}`}>
              {check.status}
            </span>
            <svg 
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {/* Quick summary */}
        <div className="mt-2 text-sm">
          <strong>Details:</strong> {check.details}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t bg-white p-4 space-y-4">
          {/* Goal and Calculation */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Doel van de controle</h4>
              <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-md">
                {check.goal}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Berekening</h4>
              <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-md font-mono">
                {check.calculation}
              </p>
            </div>
          </div>

          {/* Results */}
          {check.results && check.results.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Gedetailleerde resultaten</h4>
              <CheckResults results={check.results} check={check} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Results display component
function CheckResults({ results, check }) {
  // Handle different result types
  if (!results || results.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">
        Geen gedetailleerde resultaten beschikbaar
      </div>
    );
  }

  // Helper function to format values
  const formatValue = (key, value) => {
    if (typeof value !== 'number') return value;
    
    // Handle percentages
    if (key.toLowerCase().includes('percentage') || 
        key.toLowerCase().includes('marge') || 
        key.toLowerCase().includes('solvabiliteit') || 
        key.toLowerCase().includes('rentabiliteit') ||
        key.toLowerCase().includes('verschil') && (key.includes('marge') || key.includes('solvabiliteit'))) {
      return `${value.toFixed(1)}%`;
    }
    
    // Handle currency amounts
    if (key.toLowerCase().includes('huidig') || 
        key.toLowerCase().includes('vorig') || 
        key.toLowerCase().includes('mutatie') || 
        key.toLowerCase().includes('resultaat') || 
        key.toLowerCase().includes('omzet') || 
        key.toLowerCase().includes('kosten') || 
        key.toLowerCase().includes('cash') || 
        key.toLowerCase().includes('debiteuren') || 
        key.toLowerCase().includes('crediteuren') ||
        key.toLowerCase().includes('ev') ||
        key.toLowerCase().includes('verschil') && !key.includes('marge') && !key.includes('solvabiliteit')) {
      return value.toLocaleString('nl-NL', { 
        style: 'currency', 
        currency: 'EUR',
        maximumFractionDigits: 0
      });
    }
    
    // Handle DSO (days)
    if (key.toLowerCase().includes('dso')) {
      return `${Math.round(value)} dagen`;
    }
    
    // Handle liquiditeit
    if (key.toLowerCase().includes('liquiditeit')) {
      return value.toFixed(2);
    }
    
    // Default number formatting
    return value.toLocaleString('nl-NL', { maximumFractionDigits: 0 });
  };

  // Helper function to get friendly column names
  const getFriendlyColumnName = (key) => {
    const friendlyNames = {
      'evHuidig': 'Eigen Vermogen (huidig)',
      'evVorig': 'Eigen Vermogen (vorig)',
      'evMutatie': 'EV Mutatie',
      'wvResultaat': 'W&V Resultaat',
      'verschil': 'Verschil',
      'omzetHuidig': 'Omzet (huidig)',
      'kostenHuidig': 'Kosten (huidig)',
      'margeHuidig': 'Marge % (huidig)',
      'omzetVorig': 'Omzet (vorig)',
      'kostenVorig': 'Kosten (vorig)',
      'margeVorig': 'Marge % (vorig)',
      'marginVerschil': 'Marge Verschil %',
      'trend': 'Trend',
      'debiteurenHuidig': 'Debiteuren (huidig)',
      'dsoHuidig': 'DSO (huidig)',
      'debiteurenVorig': 'Debiteuren (vorig)',
      'dsoVorig': 'DSO (vorig)',
      'dsoVerschil': 'DSO Verschil',
      'cashHuidig': 'Cash (huidig)',
      'cashVorig': 'Cash (vorig)',
      'cashMutatie': 'Cash Mutatie',
      'plResultaat': 'P&L Resultaat',
      'verwachteCashFlow': 'Verwachte Cash Flow',
      'solvabiliteitHuidig': 'Solvabiliteit % (huidig)',
      'liquiditeitHuidig': 'Liquiditeit (huidig)',
      'rentabiliteitHuidig': 'Rentabiliteit % (huidig)',
      'solvabiliteitVorig': 'Solvabiliteit % (vorig)',
      'liquiditeitVorig': 'Liquiditeit (vorig)',
      'rentabiliteitVorig': 'Rentabiliteit % (vorig)',
      'solvabiliteitVerschil': 'Solvabiliteit Verschil %',
      'liquiditeitVerschil': 'Liquiditeit Verschil',
      'rentabiliteitVerschil': 'Rentabiliteit Verschil %',
      'status': 'Status',
      'opmerking': 'Opmerking'
    };
    return friendlyNames[key] || key;
  };

  // Handle month-by-month data (common for many checks)
  if (results[0] && results[0].month) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Maand</th>
              {Object.keys(results[0]).filter(key => key !== 'month').map(key => (
                <th key={key} className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {getFriendlyColumnName(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.map((result, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {result.month}
                </td>
                {Object.entries(result).filter(([key]) => key !== 'month').map(([key, value]) => {
                  // Color coding for trends and status
                  let cellClass = "px-4 py-2 text-sm text-right";
                  
                  if (key === 'trend') {
                    if (value.includes('verbeterd') || value.includes('Sterk verbeterd')) {
                      cellClass += " text-green-600 font-medium";
                    } else if (value.includes('gedaald') || value.includes('verslechterd')) {
                      cellClass += " text-red-600 font-medium";
                    } else if (value.includes('stabiel')) {
                      cellClass += " text-blue-600 font-medium";
                    }
                  } else if (key === 'status') {
                    if (value === 'OK') {
                      cellClass += " text-green-600 font-medium";
                    } else if (value === 'WAARSCHUWING') {
                      cellClass += " text-red-600 font-medium";
                    } else {
                      cellClass += " text-blue-600 font-medium";
                    }
                  } else if (key.includes('Verschil')) {
                    if (typeof value === 'number') {
                      if (value > 0 && (key.includes('marge') || key.includes('solvabiliteit') || key.includes('liquiditeit'))) {
                        cellClass += " text-green-600";
                      } else if (value < 0 && (key.includes('marge') || key.includes('solvabiliteit') || key.includes('liquiditeit'))) {
                        cellClass += " text-red-600";
                      } else if (value > 0 && key.includes('dso')) {
                        cellClass += " text-red-600";
                      } else if (value < 0 && key.includes('dso')) {
                        cellClass += " text-green-600";
                      }
                    }
                  } else {
                    cellClass += " text-gray-700";
                  }

                  return (
                    <td key={key} className={cellClass}>
                      {formatValue(key, value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Handle simple key-value results
  return (
    <div className="grid gap-2">
      {results.map((result, index) => (
        <div key={index} className="bg-gray-50 p-3 rounded-md">
          {typeof result === 'object' ? (
            <div className="space-y-1">
              {Object.entries(result).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{getFriendlyColumnName(key)}:</span>
                  <span className="text-gray-900">
                    {formatValue(key, value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-700">{result}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// Chat Interface Component
function ChatInterface({ data }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: 'Hallo! Ik ben je AI financiële assistent. Ik kan je helpen met vragen over je financiële data, ratio-analyses, trends en meer. Wat wil je weten?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response (placeholder)
    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Bedankt voor je vraag! Deze functionaliteit is nog in ontwikkeling. Binnenkort kan ik je helpen met gedetailleerde analyses van je financiële data, trends herkennen, en specifieke vragen beantwoorden over je boekhouding.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('nl-NL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const suggestedQuestions = [
    "Wat is mijn solvabiliteit deze maand?",
    "Laat me de trends in mijn omzet zien",
    "Welke kosten zijn het hoogst geweest?",
    "Hoe ontwikkelt mijn cashflow zich?",
    "Wat zijn mogelijke risico's in mijn cijfers?",
    "Vergelijk mijn ratio's met vorige maanden"
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Financiële Assistent</h2>
            <p className="text-blue-100">Stel vragen over je financiële data en krijg inzichten</p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span>Online en klaar voor vragen</span>
        </div>
      </div>

      {/* Data summary for context */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Beschikbare data voor analyse:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-blue-600">{data?.summary?.totalRecords || 0}</div>
            <div className="text-gray-600">Transacties</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-600">{data?.summary?.monthsIncluded || 0}</div>
            <div className="text-gray-600">Maanden</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-600">{Object.keys(data?.categoryTotals || {}).length}</div>
            <div className="text-gray-600">Categorieën</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-600">
              {data?.financialChecks?.overall?.length || data?.financialChecks?.length || 0}
            </div>
            <div className="text-gray-600">Controles</div>
          </div>
        </div>
      </div>

      {/* Chat container */}
      <div className="bg-white rounded-lg border border-gray-200 flex flex-col" style={{ height: '600px' }}>
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${
                message.type === 'user' 
                  ? 'bg-blue-600 text-white rounded-l-lg rounded-tr-lg' 
                  : 'bg-gray-100 text-gray-800 rounded-r-lg rounded-tl-lg'
              } px-4 py-2`}>
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 rounded-r-lg rounded-tl-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested questions */}
        <div className="border-t border-gray-200 p-3">
          <p className="text-xs text-gray-500 mb-2">Voorgestelde vragen:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 3).map((question, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(question)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Stel een vraag over je financiële data..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={2}
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                inputMessage.trim() && !isTyping
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Tip: Vraag naar trends, ratio's, afwijkingen of vergelijkingen tussen maanden
          </p>
        </div>
      </div>

    </div>
  );
}

// Cash Flow Overview Component
function CashFlowOverview({ data }) {
  // Helper function to get category amount for a specific month (only Grootboekrekening + Kosten/Opbrengsten)
  const getCategoryAmount = (monthKey, category) => {
    const monthData = data.monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
    const categoryRecords = monthData?.records?.filter(r => 
      r.Categorie === category && 
      r.Kenmerk_rekening === "Grootboekrekening" &&
      (r.AccountTypeName === "Kosten" || r.AccountTypeName === "Opbrengsten")
    ) || [];
    return categoryRecords.reduce((sum, r) => sum + ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)), 0);
  };

  // Get all unique months from the data
  const allMonths = [...new Set(data.monthlyData.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`))].sort();
  
  // Create month names for headers
  const monthHeaders = allMonths.map(monthKey => {
    const [year, month] = monthKey.split('-');
    return {
      key: monthKey,
      name: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
    };
  });

  // Calculate management metrics for cash flow
  const managementData = allMonths.map(monthKey => {
    const nettoOmzet = getCategoryAmount(monthKey, 'Netto-omzet');
    const overigeOpbrengsten = getCategoryAmount(monthKey, 'Overige opbrengsten');
    const inkoopwaarde = getCategoryAmount(monthKey, 'Kosten van grond- en hulpstoffen, inkoopprijs van de verkopen');
    const lonen = getCategoryAmount(monthKey, 'Lonen en salarissen');
    const socialeLasten = getCategoryAmount(monthKey, 'Sociale lasten');
    const overigePersoneelskosten = getCategoryAmount(monthKey, 'Overige personeelskosten');
    const pensioenlasten = getCategoryAmount(monthKey, 'Pensioenlasten');
    const autokosten = getCategoryAmount(monthKey, 'Autokosten en transportkosten');
    const verkoopkosten = getCategoryAmount(monthKey, 'Verkoopkosten');
    const huisvestingskosten = getCategoryAmount(monthKey, 'Huisvestingskosten');
    const andereKosten = getCategoryAmount(monthKey, 'Andere kosten');
    const afschrijvingskosten = getCategoryAmount(monthKey, 'Andere vaste bedrijfsmiddelen, afschrijving');
    
    const omzet = nettoOmzet + overigeOpbrengsten;
    const brutomarge = omzet - Math.abs(inkoopwaarde);
    const personeelskostenDirect = Math.abs(lonen) + Math.abs(socialeLasten);
    const marge = brutomarge - personeelskostenDirect;
    const operationelePersoneelskosten = Math.abs(overigePersoneelskosten) + Math.abs(pensioenlasten);
    const contributiemarge = marge - operationelePersoneelskosten - Math.abs(autokosten) - Math.abs(verkoopkosten);
    const totaleKosten = Math.abs(huisvestingskosten) + Math.abs(andereKosten);
    const ebitdaGenormaliseerd = contributiemarge - totaleKosten;
    const ebit = ebitdaGenormaliseerd - Math.abs(afschrijvingskosten);
    const vpb = ebit > 0 ? ebit * 0.23 : 0;
    const resultaatNaBelasting = ebit - vpb;

    return { monthKey, resultaatNaBelasting, vpb, afschrijvingskosten };
  });

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">
        Kasstroomoverzicht
      </h2>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-800 bg-blue-50 px-6 py-4 border-b">
          Kasstroomoverzicht - Gedetailleerd
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 min-w-[200px]">
                  Omschrijving
                </th>
                {monthHeaders.map(month => (
                  <th key={month.key} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                    {month.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Totaal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                const cashFlowData = allMonths.map(monthKey => {
                  const managementMonth = managementData.find(m => m.monthKey === monthKey);
                  const resultaatNaBelastingen = managementMonth?.resultaatNaBelasting || 0;
                  const belastingen = managementMonth?.vpb || 0;
                  const afschrijvingen = Math.abs(managementMonth?.afschrijvingskosten || 0);
                  
                  const debiteurenMutatie = getCategoryAmount(monthKey, 'Debiteuren') || 0;
                  const crediteurenMutatie = getCategoryAmount(monthKey, 'Crediteuren') || 0;
                  const overlopendeActivaMutatie = getCategoryAmount(monthKey, 'Overlopende activa') || 0;
                  const overlopendePassivaMutatie = getCategoryAmount(monthKey, 'Overlopende passiva') || 0;
                  const mutatieNettoWerkkapitaal = -(debiteurenMutatie - crediteurenMutatie + overlopendeActivaMutatie - overlopendePassivaMutatie);
                  
                  const operationeleKasstroom = resultaatNaBelastingen + belastingen + afschrijvingen + mutatieNettoWerkkapitaal;
                  const vasteActivaMutatie = getCategoryAmount(monthKey, 'Materiële vaste activa') || 0;
                  const investeringen = -Math.max(0, vasteActivaMutatie);
                  const investeringskasstroom = investeringen;
                  
                  const eigenVermogenMutatie = getCategoryAmount(monthKey, 'Eigen vermogen') || 0;
                  const dividend = -(eigenVermogenMutatie - resultaatNaBelastingen);
                  const financieringskasstroom = dividend;
                  
                  const nettoKasstroom = operationeleKasstroom + investeringskasstroom + financieringskasstroom;
                  const liquideMidMutatie = getCategoryAmount(monthKey, 'Liquide middelen') || 0;
                  const mutatieLiquideMiddelen = liquideMidMutatie;
                  const check = nettoKasstroom - mutatieLiquideMiddelen;
                  
                  return {
                    monthKey, resultaatNaBelastingen, belastingen, afschrijvingen, mutatieNettoWerkkapitaal,
                    operationeleKasstroom, investeringen, investeringskasstroom, dividend, financieringskasstroom,
                    nettoKasstroom, mutatieLiquideMiddelen, check
                  };
                });

                return (
                  <>
                    {/* Resultaat na belastingen */}
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        Resultaat na belastingen
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                          <span className={data.resultaatNaBelastingen >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(data.resultaatNaBelastingen)}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                        <span className={cashFlowData.reduce((sum, data) => sum + data.resultaatNaBelastingen, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.resultaatNaBelastingen, 0))}
                        </span>
                      </td>
                    </tr>
                    
                    {/* Belastingen */}
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        Belastingen
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center text-red-600">
                          {formatCurrency(data.belastingen)}
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-red-600 bg-slate-50">
                        {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.belastingen, 0))}
                      </td>
                    </tr>
                    
                    {/* Afschrijvingen */}
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        Afschrijvingen
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center text-blue-600">
                          {formatCurrency(data.afschrijvingen)}
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-blue-600 bg-slate-50">
                        {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.afschrijvingen, 0))}
                      </td>
                    </tr>
                    
                    {/* Mutatie netto werkkapitaal */}
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        Mutatie netto werkkapitaal
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                          <span className={data.mutatieNettoWerkkapitaal >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(data.mutatieNettoWerkkapitaal)}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                        <span className={cashFlowData.reduce((sum, data) => sum + data.mutatieNettoWerkkapitaal, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.mutatieNettoWerkkapitaal, 0))}
                        </span>
                      </td>
                    </tr>
                    
                    {/* Operationele kasstroom */}
                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 sticky left-0 bg-blue-50">
                        Operationele kasstroom
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold">
                          <span className={data.operationeleKasstroom >= 0 ? 'text-blue-600' : 'text-red-600'}>
                            {formatCurrency(data.operationeleKasstroom)}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-blue-100">
                        <span className={cashFlowData.reduce((sum, data) => sum + data.operationeleKasstroom, 0) >= 0 ? 'text-blue-600' : 'text-red-600'}>
                          {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.operationeleKasstroom, 0))}
                        </span>
                      </td>
                    </tr>
                    
                    {/* Spacer */}
                    <tr className="h-2"><td colSpan={monthHeaders.length + 2}></td></tr>
                    
                    {/* Investeringen */}
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        Investeringen
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                          <span className={data.investeringen >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(data.investeringen)}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                        <span className={cashFlowData.reduce((sum, data) => sum + data.investeringen, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.investeringen, 0))}
                        </span>
                      </td>
                    </tr>
                    
                    {/* Netto kasstroom */}
                    <tr className="bg-green-50 border-t-2 border-green-200">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 sticky left-0 bg-green-50">
                        Netto kasstroom
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold">
                          <span className={data.nettoKasstroom >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(data.nettoKasstroom)}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-green-100">
                        <span className={cashFlowData.reduce((sum, data) => sum + data.nettoKasstroom, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.nettoKasstroom, 0))}
                        </span>
                      </td>
                    </tr>
                    
                    {/* Mutatie liquide middelen */}
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        Mutatie liquide middelen
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center">
                          <span className={data.mutatieLiquideMiddelen >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(data.mutatieLiquideMiddelen)}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-slate-50">
                        <span className={cashFlowData.reduce((sum, data) => sum + data.mutatieLiquideMiddelen, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.mutatieLiquideMiddelen, 0))}
                        </span>
                      </td>
                    </tr>
                    
                    {/* Check */}
                    <tr className="bg-gray-100">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 sticky left-0 bg-gray-100">
                        Check
                      </td>
                      {cashFlowData.map(data => (
                        <td key={data.monthKey} className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold">
                          <span className={Math.abs(data.check) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(data.check)}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-gray-200">
                        <span className={Math.abs(cashFlowData.reduce((sum, data) => sum + data.check, 0)) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(cashFlowData.reduce((sum, data) => sum + data.check, 0))}
                        </span>
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}