'use client';

import { useState, useRef, useEffect } from 'react';

export default function AIChat({ 
  periodFrom, 
  periodTo, 
  data,
  allRecords,
  categoryMappings,
  setSelectedCategory, 
  setSelectedMonth,
  messages,
  setMessages,
  input,
  setInput,
  loading,
  setLoading,
  conversationId,
  conversations,
  createNewConversation,
  switchConversation,
  deleteConversation,
  generateConversationTitle
}) {
  // Import supabase for saving messages
  const { createClientComponentClient } = require('@supabase/auth-helpers-nextjs');
  const supabase = createClientComponentClient();
  const [lastUsedPeriods, setLastUsedPeriods] = useState({ from: periodFrom, to: periodTo });
  const [lastToolResults, setLastToolResults] = useState({});
  const [dataStats, setDataStats] = useState(null);
  const listRef = useRef(null);

  // Save message to Supabase
  const saveMessageToSupabase = async (role, content) => {
    if (!conversationId) {
      console.warn('No conversation ID, cannot save message');
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: role,
          content: content
        });

      if (error) {
        console.error('Error saving message to Supabase:', error.message, error);
      } else {
        console.log(`✅ ${role} message saved to Supabase`);
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  // Update periods when props change
  useEffect(() => {
    setLastUsedPeriods({ from: periodFrom, to: periodTo });
  }, [periodFrom, periodTo]);

  // Aggressive data optimization to reduce size for AI chat
  const optimizeFinancialData = (data) => {
    if (!data || !data.monthlyData) return data;
    
    const originalSize = JSON.stringify(data).length;
    
    // Strip unnecessary fields from records
    const stripUnnecessaryFields = (record) => ({
      Omschrijving_3: record.Omschrijving_3,
      Bedrag_debet: record.Bedrag_debet,
      Bedrag_credit: record.Bedrag_credit,
      Type_rekening: record.Type_rekening,
      Jaar: record.Jaar,
      Periode: record.Periode
      // REMOVED: Admin._zonder_admin._filter, Code_dagboek, Omschrijving, 
      // Type_rekening_nummer_debiteur_crediteur, Code, and all other fields
    });
    
    // Heavily optimized data structure
    const optimizedData = {
      // Keep essential metadata
      originalPeriod: data.originalPeriod,
      categoryMappings: data.categoryMappings, // AI needs this for Enhanced P&L
      
      // Optimized monthly data - ONLY records, no pre-aggregations
      monthlyData: data.monthlyData.map(month => ({
        year: month.year,
        month: month.month,
        // Only essential: stripped records
        records: month.records?.map(stripUnnecessaryFields) || []
        // REMOVED: monthName, totalDebet, totalCredit, netAmount,
        // categorieBreakdown, accountTypeBreakdown (AI can calculate these)
      }))
      
      // REMOVED ENTIRE SECTIONS (AI can calculate from records):
      // - allRecords (HUGE duplicate!)
      // - categoryTotals 
      // - accountTypeTotals
      // - summary (except originalPeriod)
      // - balans
      // - financialChecks
    };
    
    const optimizedSize = JSON.stringify(optimizedData).length;
    const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
    
    console.log(`📊 Aggressive data optimization: ${formatBytes(originalSize)} → ${formatBytes(optimizedSize)} (${reduction}% reduction)`);
    console.log(`🗑️ Removed: allRecords duplication, pre-aggregations, unnecessary AFAS fields`);
    
    return {
      optimized: true,
      data: optimizedData,
      originalSize: originalSize,
      optimizedSize: optimizedSize
    };
  };

  // Cache financial data to Supabase with production debugging
  const cacheFinancialData = async (financialData, period) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    try {
      // Generate cache key
      const cacheKey = `fin_${period.startYear}_${period.startMonth}_${period.endYear}_${period.endMonth}`;
      
      console.log(`🔍 [${isProduction ? 'PROD' : 'DEV'}] Cache attempt for key: ${cacheKey}`);
      
      // Get current user with detailed logging
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error(`❌ [${isProduction ? 'PROD' : 'DEV'}] Auth error:`, userError);
        return null;
      }
      
      if (!user) {
        console.warn(`⚠️ [${isProduction ? 'PROD' : 'DEV'}] No authenticated user - cannot cache data`);
        // In production, try to get session differently
        if (isProduction) {
          const { data: { session } } = await supabase.auth.getSession();
          console.log(`🔍 [PROD] Session check:`, session ? 'Session exists' : 'No session');
          if (session?.user) {
            console.log(`✅ [PROD] Found user via session: ${session.user.id}`);
            user = session.user;
          }
        }
        
        if (!user) {
          return null;
        }
      }
      
      console.log(`👤 [${isProduction ? 'PROD' : 'DEV'}] User found: ${user.id.substring(0, 8)}...`);
      
      // Check if cache already exists and is fresh
      console.log(`🔍 [${isProduction ? 'PROD' : 'DEV'}] Checking existing cache...`);
      const { data: existingCache, error: cacheCheckError } = await supabase
        .from('financial_cache')
        .select('id, expires_at, created_at')
        .eq('id', cacheKey)
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (cacheCheckError && cacheCheckError.code !== 'PGRST116') {
        console.error(`❌ [${isProduction ? 'PROD' : 'DEV'}] Cache check error:`, cacheCheckError);
      }
      
      if (existingCache) {
        console.log(`✅ [${isProduction ? 'PROD' : 'DEV'}] Using existing cache: ${cacheKey} (created: ${existingCache.created_at})`);
        return cacheKey;
      }
      
      // Calculate data size for monitoring
      const dataSize = new TextEncoder().encode(JSON.stringify(financialData)).length;
      
      console.log(`🔄 [${isProduction ? 'PROD' : 'DEV'}] Caching financial data: ${formatBytes(dataSize)}`);
      
      // Cache data directly to Supabase with detailed error handling
      const { error, data: insertResult } = await supabase
        .from('financial_cache')
        .upsert({
          id: cacheKey,
          user_id: user.id,
          data: financialData, // JSONB will compress automatically
          data_size: dataSize,
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // 4 hours
        })
        .select();
      
      if (error) {
        console.error(`❌ [${isProduction ? 'PROD' : 'DEV'}] Cache insert error:`, error);
        console.error(`❌ [${isProduction ? 'PROD' : 'DEV'}] Error details:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return null;
      }
      
      console.log(`✅ [${isProduction ? 'PROD' : 'DEV'}] Financial data cached successfully: ${cacheKey}`);
      console.log(`📊 [${isProduction ? 'PROD' : 'DEV'}] Insert result:`, insertResult?.length || 0, 'rows affected');
      return cacheKey;
      
    } catch (error) {
      console.error(`💥 [${isProduction ? 'PROD' : 'DEV'}] Cache operation failed:`, error);
      console.error(`💥 [${isProduction ? 'PROD' : 'DEV'}] Error stack:`, error.stack);
      return null;
    }
  };

  const ask = async () => {
    if (!input.trim() || loading || !conversationId) return;
    
    const userInput = input.trim();
    const newMsgs = [...messages, { role: 'user', content: userInput }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    
    // Save user message to Supabase
    await saveMessageToSupabase('user', userInput);
    
    // Check if this is the first user message (for title generation)
    const isFirstUserMessage = messages.filter(m => m.role === 'user').length === 0;
    
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const currentDate = new Date().toLocaleDateString('nl-NL');
      const currentTime = new Date().toLocaleTimeString('nl-NL');
      console.log('Sending AI chat request with', newMsgs.length, 'messages');
      
      // Prepare financial data for AI context (filter to original period to hide extra month)
      const filteredData = data && data.originalPeriod ? {
        ...data,
        categoryMappings: categoryMappings || [], // CRITICAL: Add category mappings
        monthlyData: data.monthlyData?.filter(m => {
          const monthKey = `${m.year}-${String(m.month).padStart(2, '0')}`;
          const [year, month] = monthKey.split('-').map(x => parseInt(x));
          if (year < data.originalPeriod.startYear || year > data.originalPeriod.endYear) return false;
          if (year === data.originalPeriod.startYear && month < data.originalPeriod.startMonth) return false;
          if (year === data.originalPeriod.endYear && month > data.originalPeriod.endMonth) return false;
          return true;
        })
      } : data ? { ...data, categoryMappings: categoryMappings || [] } : null;

      // Optimize and cache financial data
      let financialCacheId = null;
      if (filteredData) {
        console.log('🔧 Optimizing financial data...');
        const optimizedFinancialData = optimizeFinancialData(filteredData);
        
        // Cache the optimized data to Supabase
        financialCacheId = await cacheFinancialData(
          optimizedFinancialData.data, 
          {
            startYear: parseInt(periodFrom.split('-')[0]),
            startMonth: parseInt(periodFrom.split('-')[1]),
            endYear: parseInt(periodTo.split('-')[0]),
            endMonth: parseInt(periodTo.split('-')[1])
          }
        );
      }

      // Prepare request payload with fallback strategy
      let requestPayload;
      
      if (financialCacheId) {
        // Primary: Use cache reference (tiny request)
        requestPayload = { 
          messages: newMsgs, 
          period_from: periodFrom, 
          period_to: periodTo, 
          financialCacheId: financialCacheId, // Tiny cache reference instead of data!
          categoryMappings: categoryMappings || [],
          baseUrl,
          currentDate,
          currentTime
        };
        console.log(`📤 Request size (cached): ${formatBytes(new TextEncoder().encode(JSON.stringify(requestPayload)).length)}`);
      } else {
        // Fallback: Use optimized data directly (if cache failed)
        console.warn('⚠️ Cache failed - falling back to direct data (may hit size limits)');
        const optimizedData = optimizeFinancialData(filteredData);
        
        requestPayload = { 
          messages: newMsgs, 
          period_from: periodFrom, 
          period_to: periodTo, 
          financialData: optimizedData.data, // Direct optimized data
          categoryMappings: categoryMappings || [],
          baseUrl,
          currentDate,
          currentTime
        };
        
        const directSize = new TextEncoder().encode(JSON.stringify(requestPayload)).length;
        console.log(`📤 Request size (direct fallback): ${formatBytes(directSize)}`);
        
        if (directSize > 4000000) { // ~4MB limit
          console.error('❌ Request too large even with optimization - may fail');
          // Could implement further fallbacks here (chunking, essential data only, etc.)
        }
      }

      const res = await fetch('/api/v2/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      
      const responseData = await res.json();
      
      if (res.ok) {
        const aiResponse = responseData.answer || 'Geen antwoord.';
        // Update last used periods and tool results for drill-down
        setLastUsedPeriods({ from: periodFrom, to: periodTo });
        setLastToolResults(responseData.toolResults || {});
        setDataStats(responseData.dataStats || null);
        setMessages((prev) => [...prev, { role: 'assistant', content: aiResponse }]);
        console.log('AI response received, tool results:', Object.keys(responseData.toolResults || {}).length);
        
        // Log data transfer stats
        if (responseData.dataStats) {
          console.log('📊 Data Transfer Stats:', {
            'Total Gemini API data': formatBytes(responseData.dataStats.totalGeminiData),
            'Response time': `${responseData.dataStats.responseTime}ms`,
            'Tools executed': responseData.dataStats.toolsExecuted
          });
        }
        
        // Save AI response to Supabase
        await saveMessageToSupabase('assistant', aiResponse);
        
        // Generate title for conversation if this is the first user message
        if (isFirstUserMessage && generateConversationTitle) {
          generateConversationTitle(conversationId, userInput);
        }
      } else {
        const errorMsg = `Fout: ${responseData.message || 'Onbekend'}${responseData.requestId ? ` (ID: ${responseData.requestId})` : ''}`;
        setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
        // Save error message to Supabase too
        await saveMessageToSupabase('assistant', errorMsg);
      }
      
      setTimeout(() => {
        listRef.current?.scrollTo(0, listRef.current.scrollHeight);
      }, 100);
    } catch (e) {
      console.error('AI Chat error:', e);
      const errorMsg = `Verbindingsfout: ${String(e)}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
      // Save error message to Supabase
      await saveMessageToSupabase('assistant', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = () => {
    if (conversationId && window.confirm('Weet je zeker dat je dit gesprek wilt verwijderen?')) {
      deleteConversation(conversationId);
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  // Helper function to format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to handle drill-down (like other tabs)
  const handleDrillDown = (category, monthKey = null) => {
    console.log('AI Chat drill-down:', { category, monthKey, lastUsedPeriods });
    setSelectedCategory(category);
    
    // Determine which period to use for drill-down
    if (monthKey) {
      setSelectedMonth(monthKey);
    } else {
      // Use query period intelligently
      const { from, to } = lastUsedPeriods;
      if (from === to) {
        // Single month query - use that month
        setSelectedMonth(from);
      } else {
        // Range query - use the end month for drill-down
        setSelectedMonth(to);
      }
    }
  };



  // Parse AI response to extract amounts and categories for drill-down
  const parseAIResponse = (response, toolResults) => {
    const categories = new Set();
    const monthKeys = new Set();
    
    // Extract categories from tool results
    Object.entries(toolResults).forEach(([toolName, result]) => {
      try {
        const parsedResult = JSON.parse(result);
        
        if (parsedResult.rows) {
          parsedResult.rows.forEach(row => {
            if (row.post) categories.add(row.post);
            if (row.periode) monthKeys.add(row.periode);
            if (row.key) categories.add(row.key);
          });
        }
        
        if (parsedResult.assets) {
          parsedResult.assets.forEach(asset => categories.add(asset.post));
        }
        if (parsedResult.liabilities) {
          parsedResult.liabilities.forEach(liability => categories.add(liability.post));
        }
        if (parsedResult.equity) {
          parsedResult.equity.forEach(eq => categories.add(eq.post));
        }
        
      } catch (e) {
        console.warn('Failed to parse tool result:', toolName, e);
      }
    });

    // Only log when there are actual categories/periods found
    if (categories.size > 0) console.log('Found categories:', Array.from(categories));
    if (monthKeys.size > 0) console.log('Found periods:', Array.from(monthKeys));
    
    return { categories: Array.from(categories), monthKeys: Array.from(monthKeys) };
  };

  // Render clickable amounts as React components with proper formatting
  const renderMessageContent = (content, messageRole) => {
    // Only make AI assistant messages clickable
    if (messageRole !== 'assistant') {
      return content;
    }

    // Parse tool results to get available categories
    let parsedData;
    try {
      parsedData = parseAIResponse(content, lastToolResults);
    } catch (e) {
      parsedData = { categories: [], monthKeys: [] };
    }

    // Split content by lines and process each line
    const lines = content.split('\n');
    
    return lines.map((line, lineIndex) => {
      // Skip empty lines
      if (!line.trim()) {
        return <div key={lineIndex} className="h-2"></div>;
      }

      // Check if line starts with asterisks (bold formatting)
      const isBold = line.trim().startsWith('*') && line.trim().endsWith('*') && line.trim().length > 2;
      const isListItem = line.trim().startsWith('* ') || line.trim().startsWith('- ');
      
      // Clean up the line content
      let cleanLine = line;
      if (isBold) {
        cleanLine = line.trim().slice(1, -1); // Remove asterisks
      } else if (isListItem) {
        cleanLine = line.trim().slice(2); // Remove "* " or "- "
      }

      return (
        <div key={lineIndex} className={`${isListItem ? 'flex items-start gap-2' : ''} ${isBold ? 'font-semibold text-[#222c56]' : ''}`}>
          {isListItem && (
            <span className="text-[#82cff4] font-bold mt-1">•</span>
          )}
          <div className={isListItem ? 'flex-1' : ''}>
            {cleanLine.split(/(€\s?[\d\.,]+)/g).map((part, partIndex) => {
              const currencyMatch = part.match(/€\s?([\d\.,]+)/);
              
              if (currencyMatch) {
                const amount = currencyMatch[1];
                const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
                
                if (numericAmount > 0) {
                  // Look for context in the current line
                  const contextMatch = cleanLine.match(/([A-Za-z\s\-]+):\s*€\s?[\d\.,]+/);
                  
                  if (contextMatch) {
                    const context = contextMatch[1].trim();
                    
                    // Try to find matching category
                    let matchingCategory = parsedData.categories.find(cat => 
                      context.toLowerCase().includes(cat.toLowerCase()) || 
                      cat.toLowerCase().includes(context.toLowerCase())
                    );

                    // Fallback category mapping for common terms
                    if (!matchingCategory) {
                      const categoryMap = {
                        'omzet': 'Netto-omzet',
                        'revenue': 'Netto-omzet',
                        'sales': 'Netto-omzet',
                        'kosten': 'Andere kosten',
                        'costs': 'Andere kosten',
                        'expenses': 'Andere kosten',
                        'resultaat': 'ALLE_CATEGORIEËN',
                        'result': 'ALLE_CATEGORIEËN',
                        'profit': 'ALLE_CATEGORIEËN',
                        'autokosten': 'Autokosten en transportkosten',
                        'huisvestingskosten': 'Huisvestingskosten',
                        'marketingkosten': 'Verkoopkosten',
                        'brutomarge': 'ALLE_CATEGORIEËN',
                        'brutowinst': 'ALLE_CATEGORIEËN',
                        'kosten verkochte goederen': 'Kosten van verkochte goederen',
                        'cogs': 'Kosten van verkochte goederen'
                      };
                      
                      matchingCategory = categoryMap[context.toLowerCase()];
                    }
                    
                    if (matchingCategory) {
                      const period = lastUsedPeriods.from === lastUsedPeriods.to ? 
                        lastUsedPeriods.from : lastUsedPeriods.to;
                      
                      return (
                        <button
                          key={partIndex}
                          onClick={() => handleDrillDown(matchingCategory, period)}
                          className="text-[#82cff4] hover:text-[#222c56] hover:underline font-semibold cursor-pointer transition-colors"
                          title={`Bekijk details voor ${matchingCategory}`}
                        >
                          {part}
                        </button>
                      );
                    }
                  }
                }
              }
              
              return <span key={partIndex}>{part}</span>;
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-[600px] flex">
      {/* Conversations Sidebar */}
      <div className="w-64 border-r border-slate-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="border-b border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#222c56]">Gesprekken</h3>
            <button
              onClick={createNewConversation}
              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-[#222c56] hover:bg-slate-200 rounded-md transition-colors"
              title="Nieuw gesprek"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-slate-500 mb-3">Nog geen gesprekken</p>
              <button
                onClick={createNewConversation}
                className="px-3 py-2 bg-[#222c56] text-white text-sm rounded-lg hover:bg-[#222c56]/90 transition-colors"
              >
                Start je eerste chat
              </button>
            </div>
          ) : (
            <div className="p-2">
              {conversations.map((conversation, index) => (
                <button
                  key={conversation.id}
                  onClick={() => switchConversation(conversation.id)}
                  className={`w-full p-3 text-left rounded-lg mb-2 transition-colors ${
                    conversation.id === conversationId
                      ? 'bg-[#82cff4]/20 border border-[#82cff4]/30'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="text-sm font-medium text-[#222c56]">
                    {conversation.title || `Gesprek ${conversations.length - index}`}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(conversation.created_at).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="border-b border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#222c56] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#222c56]">AI Financial Controller</h3>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-slate-600">Financiële analyse en rapportage</p>
                  {dataStats && (
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                        </svg>
                        {formatBytes(dataStats.totalGeminiData)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        {(dataStats.responseTime / 1000).toFixed(1)}s
                      </span>
                      {dataStats.toolsExecuted > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          </svg>
                          {dataStats.toolsExecuted} tools
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {conversationId && (
              <button
                onClick={handleDeleteConversation}
                className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                title="Gesprek verwijderen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-4 ${
              m.role === 'user' 
                ? 'bg-[#222c56] text-white shadow-sm' 
                : 'bg-slate-50 text-slate-800 border border-slate-200'
            }`}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderMessageContent(m.content, m.role)}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-[#222c56]/30 border-t-[#222c56] rounded-full animate-spin"></div>
                <span className="text-sm text-slate-600 font-medium">AI analyseert je vraag...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-slate-200 p-4 bg-slate-50">
        {!conversationId ? (
          <div className="text-center py-4">
            <p className="text-slate-500 text-sm mb-3">Selecteer een gesprek of start een nieuwe chat</p>
            <button
              onClick={createNewConversation}
              className="px-4 py-2 bg-[#222c56] text-white rounded-lg hover:bg-[#222c56]/90 transition-colors text-sm"
            >
              Start nieuwe chat
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && ask()}
              placeholder="Stel je financiële vraag (bijv. 'Toon me de brutomarge voor augustus 2024')..."
              className="flex-1 text-slate-900 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors text-sm"
              disabled={loading}
            />
            <button
              onClick={ask}
              disabled={!input.trim() || loading}
              className="px-6 py-3 bg-[#222c56] text-white rounded-lg hover:bg-[#222c56]/90 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Verwerken...
              </div>
            ) : (
              'Verstuur'
            )}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
