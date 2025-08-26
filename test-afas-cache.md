# AFAS Supabase Cache - Test Plan

## Implementatie Voltooid ✅

### 1. Database Schema
- ✅ `afas_data_cache` tabel toegevoegd
- ✅ `afas_refresh_logs` tabel toegevoegd  
- ✅ RLS policies geconfigureerd

### 2. API Endpoints
- ✅ `/api/v2/afas-cache` (GET, POST, DELETE)
- ✅ `/api/v2/afas-refresh` (POST)

### 3. Library Updates
- ✅ `dataCache.js` uitgebreid met Supabase functionaliteit
- ✅ Fallback naar localStorage behouden
- ✅ Feature flag `USE_SUPABASE_CACHE` toegevoegd

### 4. Frontend Integration
- ✅ Demo page geüpdatet met async cache support
- ✅ Supabase cache info toegevoegd aan UI
- ✅ Defensieve implementatie met fallbacks

## Test Scenario's

### Scenario 1: Eerste keer laden (geen cache)
1. Open `/dashboard` 
2. Verwacht: Data wordt opgehaald van AFAS API
3. Verwacht: Data wordt opgeslagen in Supabase cache
4. Check console logs voor `[SUPABASE-CACHE]` berichten

### Scenario 2: Tweede keer laden (cache hit)
1. Refresh de pagina
2. Verwacht: Data wordt geladen uit Supabase cache
3. Verwacht: Snellere laadtijd
4. Check console logs voor cache hit berichten

### Scenario 3: Force refresh
1. Klik op refresh knop
2. Verwacht: Nieuwe data wordt opgehaald via `/api/v2/afas-refresh`
3. Verwacht: Cache wordt geüpdatet
4. Check console logs voor refresh API calls

### Scenario 4: Fallback naar localStorage
1. Zet `USE_SUPABASE_CACHE = false` in `dataCache.js`
2. Test dat localStorage fallback nog steeds werkt
3. Zet feature flag weer aan

### Scenario 5: Grote datasets (>50MB)
1. Test met zeer grote dataset
2. Verwacht: Waarschuwing over grootte limiet
3. Verwacht: Graceful fallback naar localStorage of geen caching

## Monitoring

### Console Logs te Controleren:
- `[SUPABASE-CACHE]` - Supabase cache operaties
- `[LOCAL-CACHE]` - localStorage operaties  
- `[AFAS-REFRESH]` - AFAS refresh API
- `[AFAS-CACHE]` - AFAS cache API
- `[DEMO]` - Frontend operaties

### Performance Metrics:
- Cache hit/miss ratio
- Data loading tijden
- Compressie effectiviteit
- Storage usage

## Rollback Plan

Als er problemen zijn:

1. **Disable Supabase Cache:**
   ```javascript
   // In lib/dataCache.js
   this.USE_SUPABASE_CACHE = false;
   ```

2. **Database Rollback:**
   ```sql
   DROP TABLE IF EXISTS afas_refresh_logs;
   DROP TABLE IF EXISTS afas_data_cache;
   ```

3. **API Endpoints:**
   - Verwijder `/api/v2/afas-cache/` directory
   - Verwijder `/api/v2/afas-refresh/` directory

## Voordelen van Nieuwe Implementatie

1. **Schaalbaarheid**: Geen 5MB localStorage limiet meer
2. **Multi-device**: Cache werkt op alle apparaten van gebruiker  
3. **Audit Trail**: Volledige refresh geschiedenis in database
4. **Performance**: Betere compressie en caching strategieën
5. **Reliability**: Geen data verlies bij browser cache clearing
6. **Defensief**: Volledig backwards compatible met localStorage fallback

## Aandachtspunten

1. **Database Storage**: Monitor Supabase storage usage
2. **API Costs**: Monitor aantal API calls naar AFAS
3. **Performance**: Controleer laadtijden met grote datasets
4. **Error Handling**: Controleer graceful fallbacks bij failures
