'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const ENHANCED_PNL_CATEGORIES = {
  'Omzet': 'Directe omzet uit verkoop van producten of diensten',
  'Inkoopwaarde omzet': 'Directe kosten gerelateerd aan verkochte goederen', 
  'Provisies': 'Commissies en provisies betaald aan verkopers',
  'Personeelskosten direct': 'Directe loonkosten gerelateerd aan productie',
  'Autokosten': 'Voertuigkosten: brandstof, onderhoud, verzekering',
  'Marketingkosten': 'Marketing en reclame uitgaven',
  'Operationele personeelskosten': 'Indirecte personeelskosten: HR, training',
  'Huisvestingskosten': 'Kantoor/bedrijfspand: huur, energie, onderhoud',
  'Kantoorkosten': 'ICT, telefoon, internet, kantoorbenodigdheden',
  'Algemene kosten': 'Overige bedrijfskosten: verzekeringen, juridisch',
  'Afschrijvingskosten': 'Afschrijvingen op vaste activa',
  'Financieringskosten': 'Rente en kosten van leningen'
};

export default function CategoryMappingSettings({ 
  allRecords = [], 
  onMappingsUpdated = () => {},
  isNewUser = false,
  onSetupComplete = () => {}
}) {
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isGeneratingMappings, setIsGeneratingMappings] = useState(false);
  const [mappingProgress, setMappingProgress] = useState({ current: 0, total: 0 });
  const [editingCategory, setEditingCategory] = useState(null);
  
  const supabase = createClientComponentClient();

  // Extract unique category_3 values from AFAS data
  const getUniqueCategories = () => {
    const categories = new Map();
    
    allRecords.forEach(record => {
      const category3 = record.Omschrijving_3 || 'Overig';
      const typeRekening = record.Type_rekening;
      
      if (typeRekening === 'Kosten' || typeRekening === 'Opbrengsten') {
        if (!categories.has(category3)) {
          categories.set(category3, {
            category_3: category3,
            type_rekening: typeRekening,
            record_count: 0,
            total_amount: 0
          });
        }
        
        const cat = categories.get(category3);
        cat.record_count += 1;
        cat.total_amount += (record.Bedrag_debet || 0) - (record.Bedrag_credit || 0);
      }
    });
    
    return Array.from(categories.values()).sort((a, b) => b.record_count - a.record_count);
  };

  const uniqueCategories = getUniqueCategories();

  // Load existing mappings
  const loadMappings = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v2/category-mapping');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load mappings');
      }
      
      setMappings(data.mappings || []);
    } catch (err) {
      console.error('Error loading mappings:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate AI mappings individually for real progress
  const generateAIMappings = async (forceRemap = false) => {
    setIsGeneratingMappings(true);
    setError(null);
    
    try {
      console.log(`[CATEGORY-MAPPING] Starting individual AI mapping for ${uniqueCategories.length} categories`);
      
      // Filter categories that need mapping
      const existingMappings = mappings.reduce((acc, mapping) => {
        acc[mapping.category_3] = mapping;
        return acc;
      }, {});
      
      const categoriesToMap = uniqueCategories.filter(categoryInfo => {
        return forceRemap || !existingMappings[categoryInfo.category_3];
      });
      
      const totalToProcess = categoriesToMap.length;
      console.log(`[CATEGORY-MAPPING] Will process ${totalToProcess} categories individually`);
      setMappingProgress({ current: 0, total: totalToProcess });
      
      if (totalToProcess === 0) {
        console.log(`[CATEGORY-MAPPING] No categories to process`);
        return;
      }
      
      // Process categories in batches of 5 using Promise.all
      const results = [];
      const errors = [];
      const BATCH_SIZE = 5;
      
      for (let i = 0; i < categoriesToMap.length; i += BATCH_SIZE) {
        const batch = categoriesToMap.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(categoriesToMap.length / BATCH_SIZE);
        
        console.log(`[CATEGORY-MAPPING] Processing batch ${batchNumber}/${totalBatches} (${batch.length} categories)`);
        
        // Create promises for all categories in this batch
        const batchPromises = batch.map(async (categoryInfo, batchIndex) => {
          const overallIndex = i + batchIndex;
          try {
            console.log(`[CATEGORY-MAPPING] Batch ${batchNumber}: Processing "${categoryInfo.category_3}" (${overallIndex + 1}/${totalToProcess})`);
            
            const response = await fetch('/api/v2/category-mapping/single', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                categoryInfo,
                forceRemap
              }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.error || 'Failed to map category');
            }
            
            return { success: true, data, categoryInfo, index: overallIndex };
            
          } catch (err) {
            console.error(`[CATEGORY-MAPPING] Error processing "${categoryInfo.category_3}":`, err);
            return { 
              success: false, 
              error: err.message, 
              categoryInfo, 
              index: overallIndex 
            };
          }
        });
        
        // Wait for all promises in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Process results and update state
        batchResults.forEach(result => {
          if (result.success) {
            // Update local mappings state immediately for instant feedback
            if (result.data.status === 'mapped' || result.data.status === 'remapped') {
              setMappings(prev => {
                const updated = [...prev];
                const existingIndex = updated.findIndex(m => m.category_3 === result.data.mapping.category_3);
                if (existingIndex >= 0) {
                  updated[existingIndex] = result.data.mapping;
                } else {
                  updated.push(result.data.mapping);
                }
                return updated;
              });
            }
            results.push(result.data);
          } else {
            errors.push({
              category_3: result.categoryInfo.category_3,
              error: result.error
            });
          }
        });
        
        // Update progress after each batch
        const completedSoFar = Math.min(i + BATCH_SIZE, totalToProcess);
        setMappingProgress({ current: completedSoFar, total: totalToProcess });
        
        // Small delay between batches to prevent overwhelming the API
        if (i + BATCH_SIZE < categoriesToMap.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`[CATEGORY-MAPPING] Completed: ${results.length} successful, ${errors.length} errors`);
      
      // Final reload to ensure sync
      await loadMappings();
      onMappingsUpdated();
      
      if (errors.length > 0) {
        setError(`${errors.length} categorieën konden niet worden gemapped: ${errors.map(e => e.category_3).join(', ')}`);
      }
      
    } catch (err) {
      console.error('Error generating AI mappings:', err);
      setError(err.message);
    } finally {
      setIsGeneratingMappings(false);
      // Reset progress after a short delay
      setTimeout(() => {
        setMappingProgress({ current: 0, total: 0 });
      }, 3000);
    }
  };

  // Update specific mapping
  const updateMapping = async (category3, newMappedCategory) => {
    try {
      const response = await fetch('/api/v2/category-mapping', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category_3: category3,
          mapped_category: newMappedCategory,
          user_verified: true
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update mapping');
      }
      
      // Update local state
      setMappings(prev => prev.map(m => 
        m.category_3 === category3 
          ? { ...m, mapped_category: newMappedCategory, user_verified: true }
          : m
      ));
      
      setEditingCategory(null);
      onMappingsUpdated();
      
    } catch (err) {
      console.error('Error updating mapping:', err);
      setError(err.message);
    }
  };

  // Mark setup as completed
  const completeSetup = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          has_completed_initial_setup: true,
          enhanced_pnl_enabled: true
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating user settings:', error);
        return;
      }

      // Call the callback to navigate to dashboard
      onSetupComplete();
      
    } catch (err) {
      console.error('Error completing setup:', err);
    }
  };

  useEffect(() => {
    loadMappings();
  }, []);

  // Create mapping lookup for display
  const mappingLookup = mappings.reduce((acc, mapping) => {
    acc[mapping.category_3] = mapping;
    return acc;
  }, {});

  const mappedCount = mappings.length;
  const totalCount = uniqueCategories.length;
  const completionPercentage = totalCount > 0 ? Math.round((mappedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Categorie Mapping Settings</h2>
            <p className="text-slate-600 mt-1">
              Configureer hoe AFAS categorieën worden gemapped naar W&V categorieën
            </p>
          </div>
          {isNewUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <div className="text-sm font-medium text-blue-800">Welkom!</div>
              <div className="text-xs text-blue-600">Eerste keer setup</div>
            </div>
          )}
        </div>
      </div>

              {/* Progress Bar */}
      <div className="bg-white border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Mapping Voortgang</h3>
            <p className="text-sm text-slate-600">
              {mappedCount} van {totalCount} categorieën gemapped ({completionPercentage}%)
            </p>
            {isGeneratingMappings && mappingProgress.total > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                AI verwerkt in batches: {mappingProgress.current} van {mappingProgress.total} categorieën
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => generateAIMappings(false)}
              disabled={isGeneratingMappings}
              className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors rounded-lg"
            >
              {isGeneratingMappings 
                ? `AI Mapping... (${mappingProgress.current}/${mappingProgress.total})`
                : 'Start AI Mapping'
              }
            </button>
            {mappedCount > 0 && (
              <button
                onClick={() => generateAIMappings(true)}
                disabled={isGeneratingMappings}
                className="px-4 py-2 bg-slate-600 text-white font-medium hover:bg-slate-700 disabled:bg-slate-300 transition-colors rounded-lg"
              >
                Hermap Alles
              </button>
            )}
          </div>
        </div>
        
        {/* Progress bars */}
        <div className="space-y-3">
          {/* Overall progress */}
          <div>
            <div className="flex justify-between text-sm text-slate-600 mb-1">
              <span>Totaal gemapped</span>
              <span>{completionPercentage}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
          </div>
          
          {/* AI processing progress */}
          {isGeneratingMappings && mappingProgress.total > 0 && (
            <div>
              <div className="flex justify-between text-sm text-blue-600 mb-1">
                <span>AI verwerking</span>
                <span>{mappingProgress.total > 0 ? Math.round((mappingProgress.current / mappingProgress.total) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                  style={{ width: `${mappingProgress.total > 0 ? (mappingProgress.current / mappingProgress.total) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-blue-500 mt-1">
                Verwerkt {mappingProgress.current} van {mappingProgress.total} categorieën in batches van 5...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4">
          <div className="text-red-800 font-medium">Fout</div>
          <div className="text-red-700 text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Mappings Table */}
      <div className="bg-white border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Categorie Mappings</h3>
          <p className="text-sm text-slate-600">
            Bekijk en bewerk hoe AFAS categorieën worden gemapped naar W&V categorieën
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  AFAS Categorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  W&V Categorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {uniqueCategories.map((category, index) => {
                const mapping = mappingLookup[category.category_3];
                const isEditing = editingCategory === category.category_3;
                
                return (
                  <tr key={category.category_3} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {category.category_3}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        category.type_rekening === 'Opbrengsten' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {category.type_rekening}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {category.record_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {isEditing ? (
                        <select
                          value={mapping?.mapped_category || ''}
                          onChange={(e) => updateMapping(category.category_3, e.target.value)}
                          className="w-full text-slate-900 px-3 py-1 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        >
                          <option value="">Selecteer categorie...</option>
                          {Object.entries(ENHANCED_PNL_CATEGORIES).map(([key, description]) => (
                            <option key={key} value={key} className="text-slate-900">
                              {key} - {description.substring(0, 50)}...
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>
                          {mapping ? (
                                                      <div className="font-medium text-slate-900">{mapping.mapped_category}</div>
                          ) : (
                            <span className="text-slate-400 italic">Niet gemapped</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {mapping ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          mapping.user_verified 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {mapping.user_verified ? 'Geverifieerd' : 'AI Gemapped'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-800">
                          Niet gemapped
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {isEditing ? (
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          Annuleer
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingCategory(category.category_3)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Bewerk
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Setup Button for New Users */}
      {isNewUser && mappedCount > 0 && (
        <div className="bg-green-50 border border-green-200 p-6 text-center">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Setup Voltooien</h3>
          <p className="text-green-700 mb-4">
            Je hebt {mappedCount} categorieën gemapped. Klik hieronder om de setup te voltooien en naar je Enhanced P&L te gaan.
          </p>
          <button
            onClick={completeSetup}
            className="px-6 py-3 bg-green-600 text-white font-medium hover:bg-green-700 transition-colors rounded-lg"
          >
            Setup voltooien en naar dashboard
          </button>
        </div>
      )}
    </div>
  );
}

