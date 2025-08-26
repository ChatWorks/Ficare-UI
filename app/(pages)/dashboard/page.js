'use client';

import { useState, useEffect } from 'react';
import { buildFinancialView } from '@/lib/finance/transform';
import { formatCurrency, getDataSizes } from './utils/formatters';
import { useAuth } from '@/hooks/useAuth';
import { chatService } from '@/lib/chat';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// import { dataCache } from '@/lib/dataCache'; // TEMPORARILY DISABLED

import FicareLogo from '../../assets/images/ficare_logo.svg'
import Image from 'next/image'
// Component imports
import AIChat from './AIChat';
import MonthlyOverview from './components/MonthlyOverview';
import CategoryOverview from './components/CategoryOverview';
import BalanceSheet from './components/BalanceSheet';
import ManagementRapportage from './components/ManagementRapportage';

import CashFlowOverview from './components/CashFlowOverview';
import KasstroomOverzicht from './components/KasstroomOverzicht';

import ExcelKasstroomOverzicht from './components/ExcelKasstroomOverzicht';
import ExcelEnhancedProfitLoss from './components/ExcelEnhancedProfitLoss';
import ExcelBalanceSheet from './components/ExcelBalanceSheet';
import FinancialChecks from './components/FinancialChecks';
import CategoryMappingSettings from './components/CategoryMappingSettings';

export default function FinancialControllerV2() {
  const supabase = createClientComponentClient();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Date range state
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(12);

  // Administration filtering state
  const [availableAdministrations, setAvailableAdministrations] = useState([]);
  const [selectedAdministrations, setSelectedAdministrations] = useState([]);
  
  // Dynamic year options based on data
  const [availableYears, setAvailableYears] = useState([]);

  // Generate year options (fallback to current year range if no data)
  const yearOptions = availableYears.length > 0 ? availableYears : (() => {
    const years = [];
  for (let year = currentYear - 5; year <= currentYear + 1; year++) {
      years.push(year);
  }
    return years;
  })();

  const monthOptions = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maart' },
    { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Augustus' }, { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
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

  // State management
  const [data, setData] = useState(null);
  const [allRecords, setAllRecords] = useState(null);
  const [allMeta, setAllMeta] = useState(null);
  const [progress, setProgress] = useState({ loaded: 0, pages: 0, pageSize: 100000 });
  const [activeTab, setActiveTab] = useState('ai-chat');
  const [activeSubTab, setActiveSubTab] = useState('balance');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  
  // AI Chat state - persist across tab changes

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationMessages, setConversationMessages] = useState([]);
  
  // Cache state
  const [cacheInfo, setCacheInfo] = useState(null);
  const [loadingFromCache, setLoadingFromCache] = useState(false);
  
  // Enhanced P&L and Settings state
  const [categoryMappings, setCategoryMappings] = useState([]);
  const [userSettings, setUserSettings] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);

  // Get user email and cache info on mount
  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        await loadUserSettings(session.user.id);
      }
    };
    
    // Update cache info on mount
    // setCacheInfo(dataCache.getCacheInfo()); // CACHE DISABLED
    
    getUserEmail();
  }, []);

  // Load user settings and check if new user
  const loadUserSettings = async (userId) => {
    try {
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading user settings:', error);
        return;
      }

      if (!settings) {
        // New user - create default settings
        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            has_completed_initial_setup: false,
            enhanced_pnl_enabled: true
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating user settings:', insertError);
          return;
        }

        setUserSettings(newSettings);
        setIsNewUser(true);
        setActiveTab('settings'); // Auto-open settings for new users
      } else {
        setUserSettings(settings);
        setIsNewUser(!settings.has_completed_initial_setup);
        
        // Auto-open settings if setup not completed
        if (!settings.has_completed_initial_setup) {
          setActiveTab('settings');
        }
      }
    } catch (err) {
      console.error('Error in loadUserSettings:', err);
    }
  };

  // Load category mappings
  const loadCategoryMappings = async () => {
    try {
      const response = await fetch('/api/v2/category-mapping');
      const data = await response.json();
      
      if (response.ok) {
        setCategoryMappings(data.mappings || []);
      } else {
        console.error('Error loading category mappings:', data.error);
      }
    } catch (err) {
      console.error('Error loading category mappings:', err);
    }
  };

  // Callback when mappings are updated
  const handleMappingsUpdated = () => {
    loadCategoryMappings();
  };

  // Callback when setup is completed
  const handleSetupComplete = async () => {
    console.log('Setup completed, navigating to Enhanced P&L...');
    setIsNewUser(false);
    setActiveTab('financial-reports');
    setActiveSubTab('enhanced-pnl');
    
    // Reload user settings to reflect changes (like AI chat does it)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserSettings(session.user.id);
      }
    } catch (error) {
      console.error('Error reloading user settings:', error);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      console.log('Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        throw error;
      }
      console.log('Sign out successful, redirecting...');
      // Redirect to signin page after successful logout
      window.location.href = '/signin';
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  // Extract unique administrations from records

  // Extract unique years from records
  const extractYears = (records) => {
    if (!records || records.length === 0) return [];
    
    const years = new Set();
    records.forEach(record => {
      // Use AFAS Jaar field directly (more reliable than parsing dates)
      if (record.Jaar && !isNaN(record.Jaar)) {
        years.add(record.Jaar);
      }
      // Fallback to date parsing if Jaar is not available
      else if (record.Datum) {
        const year = new Date(record.Datum).getFullYear();
        if (!isNaN(year)) {
          years.add(year);
        }
      }
    });
    
    return Array.from(years).sort((a, b) => b - a); // Most recent first
  };

  // Extract unique administrations from records
  const extractAdministrations = (records) => {
    const adminIds = new Set();
    records.forEach(record => {
      const adminId = record['Admin._zonder_admin._filter'];
      if (adminId !== null && adminId !== undefined) {
        adminIds.add(adminId);
      }
    });
    return Array.from(adminIds).sort((a, b) => a - b);
  };

  // Load data directly from AFAS (cache disabled)
  const loadFinancialData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[DEMO] CACHE DISABLED - Fetching directly from AFAS API...');
      
      // Set empty cache info since cache is disabled
      setCacheInfo({
        hasData: false,
        recordCount: 0,
        lastUpdated: null,
        dataSize: 0,
        supabase: { hasData: false, message: 'Cache temporarily disabled' }
      });
      
      // Direct AFAS fetch without cache
      await fetchFromAPI();
      
    } catch (err) {
      console.error('[DEMO] Error loading financial data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingFromCache(false);
    }
  };

  // Fetch data directly from API with paging (no cache)
  const fetchFromAPI = async () => {
    console.log('[DEMO] Fetching data with 100k paging from AFAS (cache disabled)');
    
    setProgress({ loaded: 0, pages: 0, pageSize: 100000 });
    
    const take = 100000;
    let skip = 0;
    let rowsAll = [];
    let pages = 0;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`[DEMO] Fetching batch ${pages + 1}: skip=${skip}, take=${take}`);
      
      const resp = await fetch(`/api/v2/financial/all?singlePage=1&skip=${skip}&take=${take}`);
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      
      const batch = await resp.json();
      const rows = batch.rows || [];
      
      if (rows.length === 0) {
        hasMore = false;
        break;
      }
      
      rowsAll = rowsAll.concat(rows);
      pages += 1;
      
      // Update progress and show data immediately
      setProgress({ loaded: rowsAll.length, pages, pageSize: take });
      console.log(`[DEMO] Loaded ${rowsAll.length} records so far (${pages} batches)`);
      
      // Process and show data immediately for each batch
      await processLoadedData(rowsAll);
      
      hasMore = batch.hasMore === true;
      skip = batch.nextSkip || (skip + rows.length);
      
      // Small delay to prevent overwhelming the UI
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[DEMO] Finished loading ${rowsAll.length} records in ${pages} batches (cache disabled)`);
  };

  // Process loaded data (from cache or API)
  const processLoadedData = async (rowsAll) => {
    // Extract available administrations and years
    const administrations = extractAdministrations(rowsAll);
    const years = extractYears(rowsAll);
    
    setAvailableAdministrations(administrations);
    setAvailableYears(years);

    // Select only the first administration by default
    const defaultAdmins = administrations.length > 0 ? [administrations[0]] : [];
    setSelectedAdministrations(defaultAdmins);

          setAllRecords(rowsAll);
          setAllMeta({ 
            totalRecords: rowsAll.length,
            fetchedAll: true,
            safetyStopReached: false,
      pagesFetched: Math.ceil(rowsAll.length / 100000),
      pageSize: 100000
    });

    // Filter by selected administrations and build view
    const filteredRecords = rowsAll.filter(record =>
      defaultAdmins.includes(record['Admin._zonder_admin._filter'])
    );
    
    // For cash flow calculations, we need one extra month before the start period
    // Calculate the extended start date
    let extendedStartYear = startYear;
    let extendedStartMonth = startMonth - 1;
    if (extendedStartMonth < 1) {
      extendedStartMonth = 12;
      extendedStartYear = startYear - 1;
    }
    
    // Build view with extended period for cash flow calculations
    const view = buildFinancialView(filteredRecords, { 
      startYear: extendedStartYear, 
      startMonth: extendedStartMonth, 
      endYear, 
      endMonth 
    });
    
    // Add metadata about the original requested period
    view.originalPeriod = { startYear, startMonth, endYear, endMonth };
    view.extendedPeriod = { startYear: extendedStartYear, startMonth: extendedStartMonth, endYear, endMonth };
    
    setData(view);
  };

  // Legacy function name for compatibility
  const fetchAllRecords = () => loadFinancialData(false);

  // Note: Middleware handles all authentication redirects

  // Load conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        // Small delay to ensure session is fully loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get current user directly from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          return;
        }
        
        if (session?.user) {
          console.log('Loading conversations for user:', session.user.email);
          
          // Load existing conversations
          const { data: conversations, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
            
          if (convError) {
            console.error('Conversation loading error:', convError);
            throw convError;
          }
          
          console.log('Loaded conversations:', conversations);
          setConversations(conversations || []);
          
          // If conversations exist, load the most recent one
          if (conversations && conversations.length > 0) {
            setCurrentConversationId(conversations[0].id);
            await loadMessages(conversations[0].id);
          }
          
        } else {
          console.log('No session found, skipping conversation loading');
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };

    // Delay the loading slightly to ensure everything is ready
    const timer = setTimeout(loadConversations, 500);
    return () => clearTimeout(timer);
  }, []);

  // Load messages for a conversation
  const loadMessages = async (conversationId) => {
    try {
      console.log('Loading messages for conversation:', conversationId);
      
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
        
      if (msgError) {
        console.error('Message loading error:', msgError);
        throw msgError;
      }
      
      console.log('Loaded messages:', messages);
      setConversationMessages(messages || []);
      
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Create new conversation
  const createNewConversation = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.error('No user session found');
        return;
      }
      
      console.log('Creating new conversation for user:', session.user.email);
      
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert([{ user_id: session.user.id }])
        .select()
        .single();
        
      if (convError) {
        console.error('Conversation creation error:', convError);
        throw convError;
      }
      
      console.log('Created new conversation:', conversation);
      
      // Update conversations list
      setConversations(prev => [conversation, ...prev]);
      
      // Switch to new conversation
      setCurrentConversationId(conversation.id);
      
      // Add opening message
      const openingMessage = {
        id: 'opening-' + Date.now(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'Hallo! Ik ben je AI financiële assistent. Stel je financiële vraag en ik kan P&L, balans, kasstroom, ratio\'s, afwijkingen en journaalhulp analyseren.',
        created_at: new Date().toISOString()
      };
      
      // Save opening message to database
      const { error: msgError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversation.id,
          role: 'assistant',
          content: openingMessage.content
        }]);
        
      if (msgError) {
        console.error('Opening message creation error:', msgError);
      }
      
      setConversationMessages([openingMessage]);
      
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  // Switch to different conversation
  const switchConversation = async (conversationId) => {
    console.log('Switching to conversation:', conversationId);
    setCurrentConversationId(conversationId);
    await loadMessages(conversationId);
  };

  // Delete conversation
  const deleteConversation = async (conversationId) => {
    try {
      console.log('Deleting conversation:', conversationId);
      
      // Delete from database (messages will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
        
      if (error) {
        console.error('Error deleting conversation:', error);
        throw error;
      }
      
      // Update local state
      const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
      setConversations(updatedConversations);
      
      // If we deleted the current conversation, switch to another or clear
      if (conversationId === currentConversationId) {
        if (updatedConversations.length > 0) {
          // Switch to the most recent conversation
          const mostRecent = updatedConversations[0];
          setCurrentConversationId(mostRecent.id);
          await loadMessages(mostRecent.id);
        } else {
          // No conversations left
          setCurrentConversationId(null);
          setConversationMessages([]);
        }
      }
      
      console.log('Conversation deleted successfully');
      
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  // Generate title for conversation based on first user message
  const generateConversationTitle = async (conversationId, firstMessage) => {
    try {
      console.log('Generating title for conversation:', conversationId, 'with message:', firstMessage);
      
      const response = await fetch('/api/v2/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: firstMessage }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate title');
      }
      
      const { title } = await response.json();
      console.log('Generated title:', title);
      
      // Update conversation in database
      // First check if title column exists by trying to select it
      const { data: testData, error: testError } = await supabase
        .from('conversations')
        .select('title')
        .eq('id', conversationId)
        .limit(1);
        
      if (testError && testError.message.includes('title')) {
        console.warn('Title column does not exist in conversations table. Please run the migration:');
        console.warn('ALTER TABLE conversations ADD COLUMN title text;');
        // Update local state only
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId ? { ...conv, title: title } : conv
          )
        );
        return;
      }
      
      const { data, error } = await supabase
        .from('conversations')
        .update({ title: title })
        .eq('id', conversationId)
        .select();
        
      if (error) {
        console.error('Error updating conversation title:', error.message, error);
        return;
      }
      
      console.log('Title updated in database:', data);
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, title: title }
            : conv
        )
      );
      
      console.log('Title updated successfully');
      
    } catch (error) {
      console.error('Failed to generate conversation title:', error);
    }
  };

  // Fetch ALL records once on mount
  useEffect(() => {
    if (!allRecords) {
      fetchAllRecords();
    }
  }, []);

  // Load category mappings when user is loaded
  useEffect(() => {
    if (userEmail) {
      loadCategoryMappings();
    }
  }, [userEmail]);

  // Recompute view client-side on range or administration changes
  useEffect(() => {
    if (allRecords && selectedAdministrations.length > 0) {
      // Filter by selected administrations
      const filteredRecords = allRecords.filter(record =>
        selectedAdministrations.includes(record['Admin._zonder_admin._filter'])
      );

      // For cash flow calculations, we need one extra month before the start period
      // Calculate the extended start date
      let extendedStartYear = startYear;
      let extendedStartMonth = startMonth - 1;
      if (extendedStartMonth < 1) {
        extendedStartMonth = 12;
        extendedStartYear = startYear - 1;
      }
      
      // Build view with extended period for cash flow calculations
      const view = buildFinancialView(filteredRecords, {
        startYear: extendedStartYear,
        startMonth: extendedStartMonth,
        endYear,
        endMonth
      });
      
      // Add metadata about the original requested period
      view.originalPeriod = { startYear, startMonth, endYear, endMonth };
      view.extendedPeriod = { startYear: extendedStartYear, startMonth: extendedStartMonth, endYear, endMonth };
      
      setData(view);
    }
  }, [allRecords, startYear, startMonth, endYear, endMonth, selectedAdministrations]);

  // Middleware handles all auth - if we reach here, we're authenticated
  // No need for loading states or user checks

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="mx-auto bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-[90%] mx-auto px-6 py-8">
          {/* Title Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
                <Image
                  src={FicareLogo}
                  alt="Ficare Logo"
                  width={149}
                  height={32}
                  className="h-8 w-auto"
                />
                <h1 className="text-3xl font-bold tracking-tight text-[#222c56] mt-2">
                  AI Financial Controller Agent
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">
                  Welkom, {userEmail}
                          </span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-medium text-[#222c56] hover:text-[#82cff4] hover:bg-slate-50 rounded-lg transition-colors border border-slate-300"
                >
                  Uitloggen
                </button>
              </div>
                  </div>
              </div>
              
          {/* Settings Section - Collapsible */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            {/* Settings Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSettingsExpanded(!settingsExpanded)}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#222c56]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                <span className="text-sm font-medium text-[#222c56]">Instellingen</span>
              </div>
              <svg
                className={`w-5 h-5 text-[#222c56] transition-transform ${settingsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
            </div>

            {/* Settings Content */}
            {settingsExpanded && (
              <div className="border-t border-slate-200 p-6 space-y-6">
            {/* Period Selection */}
                <div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700">Periode</span>
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(parseInt(e.target.value))}
                        className="text-sm text-[#222c56] border border-slate-300 px-3 py-2 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors min-w-[100px]"
                >
                  {monthOptions.map(month => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(parseInt(e.target.value))}
                        className="text-sm text-[#222c56] border border-slate-300 px-3 py-2 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors min-w-[80px]"
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                      <span className="text-slate-400">—</span>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(parseInt(e.target.value))}
                        className="text-sm text-[#222c56] border border-slate-300 px-3 py-2 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors min-w-[100px]"
                >
                  {monthOptions.map(month => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(parseInt(e.target.value))}
                        className="text-sm text-[#222c56] border border-slate-300 px-3 py-2 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors min-w-[80px]"
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Quick Select Buttons */}
                    <div className="flex gap-2">
                <button
                  onClick={selectCurrentMonth}
                        className="px-3 py-2 text-sm font-medium text-[#222c56] hover:text-[#82cff4] hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Deze maand
                </button>
                <button
                  onClick={selectLastThreeMonths}
                        className="px-3 py-2 text-sm font-medium text-[#222c56] hover:text-[#82cff4] hover:bg-slate-50 rounded-lg transition-colors"
                >
                  3 maanden
                </button>
                <button
                  onClick={selectCurrentYear}
                        className="px-3 py-2 text-sm font-medium text-[#222c56] hover:text-[#82cff4] hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Dit jaar
                </button>
              </div>
            </div>
                </div>

                {/* Administration Selection */}
                {availableAdministrations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-slate-700">Administraties</span>
                      <div className="flex gap-2">
                        {availableAdministrations.map(adminId => (
                          <button
                            key={adminId}
                            onClick={() => {
                              if (selectedAdministrations.includes(adminId)) {
                                setSelectedAdministrations(selectedAdministrations.filter(id => id !== adminId));
                              } else {
                                setSelectedAdministrations([...selectedAdministrations, adminId]);
                              }
                            }}
                            className={`
                              px-4 py-2 text-sm font-medium transition-colors rounded-lg border
                              ${selectedAdministrations.includes(adminId)
                                ? 'bg-[#222c56] text-white border-[#222c56]'
                                : 'bg-white text-[#222c56] border-slate-300 hover:bg-slate-50 hover:border-[#82cff4]'
                              }
                            `}
                          >
                            {adminId}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => setSelectedAdministrations(availableAdministrations)}
                          className="px-3 py-2 text-sm font-medium text-[#222c56] hover:text-[#82cff4] transition-colors"
                        >
                          Alles
                        </button>
                        <button
                          onClick={() => setSelectedAdministrations([])}
                          className="px-3 py-2 text-sm font-medium text-[#222c56] hover:text-[#82cff4] transition-colors"
                        >
                          Geen
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* AFAS Data Button with Cache Info */}
                <div className="space-y-3">
                  {/* Cache Info */}
                  {cacheInfo && (
                    <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
                      {cacheInfo.hasCache ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Cache status:</span>
                            <span className={`font-medium ${cacheInfo.isValid ? 'text-green-600' : 'text-orange-600'}`}>
                              {cacheInfo.isValid ? 'Geldig' : 'Verlopen'}
                            </span>
                          </div>
                          {cacheInfo.cachedAt && (
                            <div className="flex items-center justify-between">
                              <span>Opgehaald:</span>
                              <span>{cacheInfo.cachedAt}</span>
                            </div>
                          )}
                          {cacheInfo.expiresAt && (
                            <div className="flex items-center justify-between">
                              <span>Verloopt:</span>
                              <span>{cacheInfo.expiresAt}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span>Geen gecachte data</span>
                          <div className="text-xs text-slate-500 mt-1">
                            Data wordt elke keer opnieuw opgehaald
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Data Buttons */}
                  <div className="flex gap-2 justify-end">
                    {/* Force Refresh Button */}
                    {cacheInfo?.hasCache && (
                      <button
                        onClick={() => loadFinancialData(true)}
                        disabled={loading}
                        className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#222c56] hover:bg-slate-100 rounded-lg transition-colors border border-slate-300"
                        title="Forceer vernieuwing van data"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Vernieuw
                      </button>
                    )}
                    
                    {/* Main Data Button */}
                    <button
                      onClick={fetchAllRecords}
                      disabled={loading}
                      className={`
                        flex items-center px-6 py-3 text-sm font-medium transition-colors rounded-lg border
                        ${loading
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                          : 'bg-[#222c56] text-white border-[#222c56] hover:bg-[#222c56]/90 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:ring-offset-2'
                        }
                      `}
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          {loadingFromCache ? 'Cache laden...' : 'API laden...'}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                          </svg>
                          AFAS Data Laden
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress indicator */}
          {loading && (
            <div className="mt-6">
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#222c56]">
                    AFAS Data wordt opgehaald per 100k records...
                  </span>
                  <span className="text-sm text-slate-600 font-medium">
                    {progress.loaded.toLocaleString()} records | Batch {progress.pages}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                  <div className="bg-[#82cff4] h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min((progress.loaded / 500000) * 100, 100)}%` }}></div>
                </div>
                <div className="text-xs text-slate-500 text-center">
                  Cache uitgeschakeld - Direct van AFAS • Data wordt getoond zodra beschikbaar
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-6">
              <div className="rounded-lg bg-[#e56e61]/10 border border-[#e56e61]/20 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-[#e56e61]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-[#e56e61]">Fout bij het ophalen van data</h3>
                    <div className="mt-2 text-sm text-[#e56e61]">{error}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[90%] mx-auto px-6 py-8">
        {data && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            {/* Main Tab Navigation */}
            <div className="border-b border-slate-200 bg-slate-50 rounded-t-lg">
              <nav className="flex space-x-8 px-6 pt-6" aria-label="Main Tabs">
                {[
                  { id: 'ai-chat', name: 'AI Agent' },
                  { id: 'financial-checks', name: 'Financiële Controles' },
                  { id: 'financial-reports', name: 'Financiële Overzichten' },
                  { id: 'settings', name: 'Settings' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors rounded-t-lg relative ${activeTab === tab.id
                        ? 'border-[#222c56] text-[#222c56] bg-white'
                        : 'border-transparent text-slate-600 hover:text-[#222c56] hover:border-slate-300'
                      }`}
                  >
                    {tab.name}
                    {tab.badge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* AI Agent Tab */}
              {activeTab === 'ai-chat' && (
                <AIChat
                  periodFrom={`${startYear}-${String(startMonth).padStart(2, '0')}`}
                  periodTo={`${endYear}-${String(endMonth).padStart(2, '0')}`}
                  data={data}
                  allRecords={allRecords}
                  categoryMappings={categoryMappings}
                  setSelectedCategory={setSelectedCategory}
                  setSelectedMonth={setSelectedMonth}
                  messages={conversationMessages}
                  setMessages={setConversationMessages}
                  input={chatInput}
                  setInput={setChatInput}
                  loading={chatLoading}
                  setLoading={setChatLoading}
                  conversationId={currentConversationId}
                  conversations={conversations}
                  createNewConversation={createNewConversation}
                  switchConversation={switchConversation}
                  deleteConversation={deleteConversation}
                  generateConversationTitle={generateConversationTitle}
                />
              )}

              {/* Financial Checks Tab */}
              {activeTab === 'financial-checks' && (
                <FinancialChecks data={data} />
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <CategoryMappingSettings 
                  allRecords={allRecords || []}
                  onMappingsUpdated={handleMappingsUpdated}
                  isNewUser={isNewUser}
                  onSetupComplete={handleSetupComplete}
                />
              )}

              {/* Financial Reports Tab */}
              {activeTab === 'financial-reports' && (
                <div>
                  {/* Report Sub-Tab Navigation */}
                  <div className="border-b border-slate-200 bg-slate-50 mb-6 rounded-lg">
                    <nav className="flex space-x-8 px-6 pt-6" aria-label="Report Tabs">
                      {[
                        { id: 'balance', name: 'Balans' },
                        { id: 'excel-balance', name: 'Excel Balans' },
                        { id: 'management', name: 'K&O' },
                        { id: 'excel-enhanced-pnl', name: 'W&V' },
                        { id: 'cashflow', name: 'Kasstroomoverzicht' },
                        { id: 'excel-cashflow', name: 'Excel Kasstroom' },
                        { id: 'categories', name: 'Categorieën' }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveSubTab(tab.id)}
                          className={`py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors rounded-t-lg relative ${activeSubTab === tab.id
                              ? 'border-[#222c56] text-[#222c56] bg-white'
                              : 'border-transparent text-slate-600 hover:text-[#222c56] hover:border-slate-300'
                            }`}
                        >
                          {tab.name}
                          {tab.badge && (
                            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Report Content */}
                  {activeSubTab === 'balance' && <BalanceSheet data={data} allRecords={allRecords} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}
                  
                  {activeSubTab === 'excel-balance' && <ExcelBalanceSheet data={data} allRecords={allRecords} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}

                  {activeSubTab === 'management' && <ManagementRapportage data={data} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}

                  {activeSubTab === 'excel-enhanced-pnl' && <ExcelEnhancedProfitLoss data={data} allRecords={allRecords} categoryMappings={categoryMappings} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}
                  {activeSubTab === 'cashflow' && <KasstroomOverzicht data={data} allRecords={allRecords} categoryMappings={categoryMappings} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}
                  {activeSubTab === 'excel-cashflow' && <ExcelKasstroomOverzicht data={data} allRecords={allRecords} categoryMappings={categoryMappings} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}
                  {activeSubTab === 'categories' && <CategoryOverview data={data} setSelectedCategory={setSelectedCategory} setSelectedMonth={setSelectedMonth} />}
                </div>
              )}
            </div>

            {/* Selected Category Details */}
            {selectedCategory && (
              <div className="mt-8 bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                  <h3 className="text-lg font-semibold text-[#222c56]">
                    Transactie Details: {selectedCategory}
                    {selectedMonth && (
                      <span className="ml-2 text-sm font-normal text-slate-600">
                        ({selectedMonth ? data.monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === selectedMonth)?.monthName : 'Alle maanden'})
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedMonth(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-slate-300 border-collapse rounded-lg">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr className="border-b-2 border-slate-300">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#222c56] border-r border-slate-300">
                            DATUM
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#222c56] border-r border-slate-300">
                            BOEKSTUKNR
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#222c56] border-r border-slate-300">
                            CATEGORIE
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#222c56] border-r border-slate-300">
                            OMSCHRIJVING
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#222c56] border-r border-slate-300">
                            DEBET
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#222c56] border-r border-slate-300">
                            CREDIT
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#222c56]">
                            NETTO
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {(() => {
                          const records = selectedMonth 
                            ? data.monthlyData.find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === selectedMonth)?.records || []
                            : data.allRecords || [];
                          
                          const filteredRecords = records.filter(record => 
                            selectedCategory === 'ALLE_CATEGORIEËN' || record.Categorie === selectedCategory
                          );
                          
                          return filteredRecords.slice(0, 100).map((record, index) => (
                            <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200 hover:bg-[#82cff4]/10`}>
                              <td className="px-4 py-2 text-sm text-slate-900 border-r border-slate-200">
                                {new Date(record.Boekstukdatum).toLocaleDateString('nl-NL')}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-slate-900 border-r border-slate-200">
                                {record.Boekstuknummer}
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-700 border-r border-slate-200">
                                {record.Categorie}
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-700 max-w-xs truncate border-r border-slate-200">
                                {record.Omschrijving_boeking || record.Omschrijving || '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-mono text-red-700 border-r border-slate-200">
                                {record.Bedrag_debet ? formatCurrency(record.Bedrag_debet) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-mono text-slate-700 border-r border-slate-200">
                                {record.Bedrag_credit ? formatCurrency(record.Bedrag_credit) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-mono font-semibold">
                                <span className={((record.Bedrag_credit || 0) - (record.Bedrag_debet || 0)) >= 0 ? 'text-slate-700' : 'text-red-700'}>
                                  {formatCurrency((record.Bedrag_credit || 0) - (record.Bedrag_debet || 0))}
                                </span>
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
        )}

        {!data && !loading && (
          <div className="text-center py-12">
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-12">
              <div className="text-slate-400 mb-6">
                <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[#222c56] mb-3">
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
