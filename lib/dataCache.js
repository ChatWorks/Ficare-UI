// Data caching utility for AFAS data
// Uses Supabase database cache with localStorage fallback

class DataCache {
  constructor() {
    this.CACHE_KEY = 'afas_financial_data';
    this.CACHE_VERSION_KEY = 'afas_data_version';
    this.CACHE_EXPIRY_KEY = 'afas_data_expiry';
    this.DEFAULT_EXPIRY_HOURS = 24; // 24 hours default
    this.USE_SUPABASE_CACHE = true; // Feature flag for Supabase caching
  }

  // Compress data using advanced JSON compression
  compressData(data) {
    try {
      const jsonString = JSON.stringify(data);
      
      // Advanced compression techniques
      let compressed = jsonString
        // Remove all unnecessary whitespace
        .replace(/\s+/g, ' ')
        .trim()
        // Replace common repeated patterns
        .replace(/"Admin\._zonder_admin\._filter"/g, '"A"')
        .replace(/"Omschrijving_3"/g, '"O3"')
        .replace(/"Omschrijving_2"/g, '"O2"')
        .replace(/"Rekeningnummer"/g, '"R"')
        .replace(/"Type_rekening"/g, '"T"')
        .replace(/"Datum"/g, '"D"')
        .replace(/"Debet"/g, '"Db"')
        .replace(/"Credit"/g, '"Cr"');
      
      console.log(`Compression: ${jsonString.length} → ${compressed.length} chars (${((1 - compressed.length/jsonString.length) * 100).toFixed(1)}% reduction)`);
      
      return compressed;
    } catch (error) {
      console.error('Error compressing data:', error);
      return null;
    }
  }

  // Decompress data
  decompressData(compressedData) {
    try {
      // Reverse the compression replacements
      let decompressed = compressedData
        .replace(/"A"/g, '"Admin._zonder_admin._filter"')
        .replace(/"O3"/g, '"Omschrijving_3"')
        .replace(/"O2"/g, '"Omschrijving_2"')
        .replace(/"R"/g, '"Rekeningnummer"')
        .replace(/"T"/g, '"Type_rekening"')
        .replace(/"D"/g, '"Datum"')
        .replace(/"Db"/g, '"Debet"')
        .replace(/"Cr"/g, '"Credit"');
      
      return JSON.parse(decompressed);
    } catch (error) {
      console.error('Error decompressing data:', error);
      return null;
    }
  }

  // Check if cache is valid (not expired)
  isCacheValid() {
    try {
      const expiry = localStorage.getItem(this.CACHE_EXPIRY_KEY);
      if (!expiry) return false;
      
      const expiryTime = new Date(expiry);
      const now = new Date();
      
      return now < expiryTime;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  // Get data size in MB
  getDataSize(data) {
    const jsonString = JSON.stringify(data);
    const sizeInBytes = new Blob([jsonString]).size;
    return (sizeInBytes / (1024 * 1024)).toFixed(2);
  }

  // Check available storage space
  getStorageInfo() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        return navigator.storage.estimate();
      }
      return Promise.resolve({ quota: 0, usage: 0 });
    } catch (error) {
      console.error('Error getting storage info:', error);
      return Promise.resolve({ quota: 0, usage: 0 });
    }
  }

  // Clear all localStorage except essential items
  clearAllLocalStorage() {
    try {
      const essential = ['supabase.auth.token', 'auth-token'];
      const toKeep = {};
      
      essential.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) toKeep[key] = value;
      });
      
      localStorage.clear();
      
      Object.keys(toKeep).forEach(key => {
        localStorage.setItem(key, toKeep[key]);
      });
      
      console.log('Cleared all localStorage except essential items');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  // Save data to Supabase cache with localStorage fallback
  async saveToSupabase(data, expiryHours = this.DEFAULT_EXPIRY_HOURS) {
    try {
      const originalSize = this.getDataSize(data);
      console.log(`[SUPABASE-CACHE] Attempting to cache AFAS data (${originalSize}MB)...`);

      const response = await fetch('/api/v2/afas-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: data,
          recordCount: data.length,
          expiryHours: expiryHours
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[SUPABASE-CACHE] ✅ Data cached successfully (${result.meta.dataSizeMB}MB)`);
        return true;
      } else {
        const error = await response.json();
        console.warn(`[SUPABASE-CACHE] ❌ Failed to cache data:`, error.error);
        return false;
      }
    } catch (error) {
      console.error('[SUPABASE-CACHE] 💥 Error saving to Supabase cache:', error);
      return false;
    }
  }

  // Load data from Supabase cache
  async loadFromSupabase() {
    try {
      console.log('[SUPABASE-CACHE] Attempting to load cached data...');

      const response = await fetch('/api/v2/afas-cache', {
        method: 'GET'
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.cached && result.data) {
          console.log(`[SUPABASE-CACHE] ✅ Loaded cached data (${result.meta.recordCount} records, ${result.meta.dataSizeMB}MB)`);
          console.log(`[SUPABASE-CACHE] Last refreshed: ${new Date(result.meta.lastRefreshed).toLocaleString('nl-NL')}`);
          return result.data;
        } else {
          console.log(`[SUPABASE-CACHE] No valid cache found: ${result.message}`);
          return null;
        }
      } else {
        console.warn('[SUPABASE-CACHE] Failed to load cache:', response.status);
        return null;
      }
    } catch (error) {
      console.error('[SUPABASE-CACHE] 💥 Error loading from Supabase cache:', error);
      return null;
    }
  }

  // Clear Supabase cache
  async clearSupabaseCache() {
    try {
      console.log('[SUPABASE-CACHE] Clearing cache...');

      const response = await fetch('/api/v2/afas-cache', {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log('[SUPABASE-CACHE] ✅ Cache cleared successfully');
        return true;
      } else {
        console.warn('[SUPABASE-CACHE] Failed to clear cache:', response.status);
        return false;
      }
    } catch (error) {
      console.error('[SUPABASE-CACHE] 💥 Error clearing Supabase cache:', error);
      return false;
    }
  }

  // Save data to cache with size limits (now with Supabase support)
  async saveToCache(data, expiryHours = this.DEFAULT_EXPIRY_HOURS) {
    // Try Supabase cache first if enabled
    if (this.USE_SUPABASE_CACHE) {
      const supabaseSuccess = await this.saveToSupabase(data, expiryHours);
      if (supabaseSuccess) {
        // Also try to save to localStorage as backup (with smaller size limits)
        await this.saveToLocalStorage(data, expiryHours);
        return true;
      }
      console.log('[CACHE] Supabase cache failed, falling back to localStorage...');
    }

    // Fallback to localStorage
    return await this.saveToLocalStorage(data, expiryHours);
  }

  // Save data to localStorage (extracted from original saveToCache)
  async saveToLocalStorage(data, expiryHours = this.DEFAULT_EXPIRY_HOURS) {
    try {
      const originalSize = this.getDataSize(data);
      console.log(`[LOCAL-CACHE] Attempting to cache AFAS data (${originalSize}MB)...`);
      
      // Hard limit: Don't even try if original data is >200MB
      if (parseFloat(originalSize) > 200) {
        console.warn(`[LOCAL-CACHE] ❌ Dataset too large to cache (${originalSize}MB > 200MB limit)`);
        console.warn('[LOCAL-CACHE] 💡 AFAS dataset is too large for client-side caching. Data will be fetched fresh each time.');
        return false;
      }
      
      const compressed = this.compressData(data);
      if (!compressed) {
        console.error('[LOCAL-CACHE] Failed to compress data for caching');
        return false;
      }

      const compressedSize = (new Blob([compressed]).size / (1024 * 1024)).toFixed(2);
      console.log(`[LOCAL-CACHE] Compressed size: ${compressedSize}MB (${((1 - parseFloat(compressedSize)/parseFloat(originalSize)) * 100).toFixed(1)}% reduction)`);

      // Hard limit: Don't cache if compressed data is still >15MB (localStorage limit)
      if (parseFloat(compressedSize) > 15) {
        console.warn(`[LOCAL-CACHE] ❌ Compressed data still too large (${compressedSize}MB > 15MB limit)`);
        console.warn('[LOCAL-CACHE] 💡 Even after compression, dataset is too large for localStorage. Consider reducing the date range.');
        return false;
      }

      // Calculate expiry time
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + expiryHours);

      // Clear any existing cache first to maximize available space
      this.clearLocalCache();

      // Try to save to localStorage
      try {
        localStorage.setItem(this.CACHE_KEY, compressed);
        localStorage.setItem(this.CACHE_VERSION_KEY, Date.now().toString());
        localStorage.setItem(this.CACHE_EXPIRY_KEY, expiry.toISOString());

        console.log(`[LOCAL-CACHE] ✅ Data cached successfully (${compressedSize}MB). Expires: ${expiry.toLocaleString('nl-NL')}`);
        return true;

      } catch (storageError) {
        if (storageError.name === 'QuotaExceededError') {
          console.warn(`[LOCAL-CACHE] ❌ localStorage quota exceeded (${compressedSize}MB)`);
          console.warn('[LOCAL-CACHE] 💡 Browser storage limit reached. Data will be fetched fresh each time.');
          console.warn('[LOCAL-CACHE] 💡 Try reducing the date range to cache smaller datasets.');
          return false;
        }
        console.error('[LOCAL-CACHE] Storage error:', storageError);
        return false;
      }

    } catch (error) {
      console.error('[LOCAL-CACHE] 💥 Error saving to cache:', error);
      return false;
    }
  }

  // Load data from cache (now with Supabase support)
  async loadFromCache() {
    // Try Supabase cache first if enabled
    if (this.USE_SUPABASE_CACHE) {
      const supabaseData = await this.loadFromSupabase();
      if (supabaseData) {
        return supabaseData;
      }
      console.log('[CACHE] Supabase cache miss, trying localStorage...');
    }

    // Fallback to localStorage
    return this.loadFromLocalStorage();
  }

  // Load data from localStorage (extracted from original loadFromCache)
  loadFromLocalStorage() {
    try {
      if (!this.isCacheValid()) {
        console.log('[LOCAL-CACHE] Cache expired or invalid');
        this.clearLocalCache();
        return null;
      }

      const compressed = localStorage.getItem(this.CACHE_KEY);
      if (!compressed) {
        console.log('[LOCAL-CACHE] No cached data found');
        return null;
      }

      const data = this.decompressData(compressed);
      if (!data) {
        console.error('[LOCAL-CACHE] Failed to decompress cached data');
        this.clearLocalCache();
        return null;
      }

      const version = localStorage.getItem(this.CACHE_VERSION_KEY);
      const expiry = localStorage.getItem(this.CACHE_EXPIRY_KEY);
      
      console.log(`[LOCAL-CACHE] Loaded cached data (${this.getDataSize(data)}MB) from ${new Date(parseInt(version)).toLocaleString('nl-NL')}`);
      console.log(`[LOCAL-CACHE] Cache expires: ${new Date(expiry).toLocaleString('nl-NL')}`);
      
      return data;

    } catch (error) {
      console.error('[LOCAL-CACHE] Error loading from cache:', error);
      this.clearLocalCache();
      return null;
    }
  }

  // Clear all caches (Supabase and localStorage)
  async clearCache() {
    // Clear Supabase cache if enabled
    if (this.USE_SUPABASE_CACHE) {
      await this.clearSupabaseCache();
    }
    
    // Always clear localStorage cache too
    this.clearLocalCache();
  }

  // Clear localStorage cache only
  clearLocalCache() {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      localStorage.removeItem(this.CACHE_VERSION_KEY);
      localStorage.removeItem(this.CACHE_EXPIRY_KEY);
      console.log('[LOCAL-CACHE] Cache cleared');
    } catch (error) {
      console.error('[LOCAL-CACHE] Error clearing cache:', error);
    }
  }

  // Get cache info
  getCacheInfo() {
    try {
      const hasCache = localStorage.getItem(this.CACHE_KEY) !== null;
      const version = localStorage.getItem(this.CACHE_VERSION_KEY);
      const expiry = localStorage.getItem(this.CACHE_EXPIRY_KEY);
      
      if (!hasCache) {
        return { hasCache: false };
      }

      const isValid = this.isCacheValid();
      const cachedAt = version ? new Date(parseInt(version)) : null;
      const expiresAt = expiry ? new Date(expiry) : null;

      return {
        hasCache: true,
        isValid,
        cachedAt: cachedAt?.toLocaleString('nl-NL'),
        expiresAt: expiresAt?.toLocaleString('nl-NL'),
        version
      };

    } catch (error) {
      console.error('Error getting cache info:', error);
      return { hasCache: false, error: error.message };
    }
  }

  // Force refresh using new AFAS refresh API
  async forceRefresh() {
    console.log('[CACHE] Forcing data refresh...');
    
    // Clear existing caches first
    await this.clearCache();
    
    // Use new AFAS refresh API if Supabase is enabled
    if (this.USE_SUPABASE_CACHE) {
      try {
        console.log('[CACHE] Using AFAS refresh API...');
        const response = await fetch('/api/v2/afas-refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            refreshType: 'manual',
            expiryHours: this.DEFAULT_EXPIRY_HOURS
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`[CACHE] ✅ Refresh completed: ${result.meta.recordCount} records, ${result.meta.dataSizeMB}MB`);
          return result.data;
        } else {
          const error = await response.json();
          console.warn('[CACHE] ❌ AFAS refresh failed:', error.error);
          return null;
        }
      } catch (error) {
        console.error('[CACHE] 💥 Error during AFAS refresh:', error);
        return null;
      }
    } else {
      console.log('[CACHE] Supabase cache disabled, using traditional refresh');
      return null;
    }
  }

  // Add method to get Supabase cache info
  async getSupabaseCacheInfo() {
    if (!this.USE_SUPABASE_CACHE) {
      return { hasCache: false, source: 'supabase-disabled' };
    }

    try {
      const response = await fetch('/api/v2/afas-cache?summary=true');
      if (response.ok) {
        const result = await response.json();
        if (result.cached) {
          return {
            hasCache: true,
            source: 'supabase',
            recordCount: result.summary.recordCount,
            dataSizeMB: result.summary.dataSizeMB,
            lastRefreshed: result.summary.lastRefreshed,
            expiresAt: result.summary.expiresAt
          };
        }
      }
      return { hasCache: false, source: 'supabase' };
    } catch (error) {
      console.error('[CACHE] Error getting Supabase cache info:', error);
      return { hasCache: false, source: 'supabase', error: error.message };
    }
  }
}

// Export singleton instance
export const dataCache = new DataCache();
