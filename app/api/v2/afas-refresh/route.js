import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { performance } from 'perf_hooks';

// POST: Force refresh AFAS data from source and cache it
export async function POST(request) {
  const startTime = performance.now();
  console.log('[AFAS-REFRESH] POST: Starting AFAS data refresh');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[AFAS-REFRESH] POST: Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { refreshType = 'manual', expiryHours = 24 } = body;

    console.log(`[AFAS-REFRESH] POST: User ${user.id}, refreshType=${refreshType}`);

    let fetchStartTime = performance.now();
    let allData = [];
    let totalRecords = 0;

    try {
      // Fetch data from AFAS API (using existing logic from financial/all route)
      console.log('[AFAS-REFRESH] POST: Fetching data from AFAS API...');
      
      // Paging config (same as existing implementation)
      let skip = 0;
      const take = 20000; // Same as existing
      let hasMoreData = true;
      let pageCount = 0;
      const maxPages = 50; // Safety limit (1M records max)

      while (hasMoreData && pageCount < maxPages) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const afasUrl = `https://96778.resttest.afas.online/ProfitRestServices/connectors/Innoworks_Financiele_mutaties?skip=${skip}&take=${take}&orderbyfieldids=-Boekstukdatum`;
        
        console.log(`[AFAS-REFRESH] POST: Fetching page ${pageCount + 1}, skip=${skip}, take=${take}`);

        const response = await fetch(afasUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-language': 'nl-nl',
            'Authorization': 'AfasToken PHRva2VuPjx2ZXJzaW9uPjE8L3ZlcnNpb24+PGRhdGE+RTI4OUU4M0NGQTNGNDhDNjkyQzQzNTJGNjYxMDE3QzlFQkI1MDk0M0RDOTk0MTkwOTU1RUREQTg4NjJDQjM4OTwvZGF0YT48L3Rva2VuPg=='
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorMsg = `AFAS API error: ${response.status} ${response.statusText}`;
          console.error('[AFAS-REFRESH] POST:', errorMsg);
          
          // Log failed refresh
          await supabase.from('afas_refresh_logs').insert({
            user_id: user.id,
            refresh_type: refreshType,
            records_fetched: totalRecords,
            duration_ms: Math.round(performance.now() - startTime),
            success: false,
            error_message: errorMsg
          });

          return NextResponse.json({ 
            error: 'AFAS API request failed',
            details: errorMsg
          }, { status: 502 });
        }

        const batchData = await response.json();
        
        if (!batchData.rows || batchData.rows.length === 0) {
          console.log('[AFAS-REFRESH] POST: No more data available');
          hasMoreData = false;
          break;
        }

        console.log(`[AFAS-REFRESH] POST: Received ${batchData.rows.length} records from page ${pageCount + 1}`);
        
        allData = allData.concat(batchData.rows);
        totalRecords += batchData.rows.length;
        
        // If we got less than requested, we've reached the end
        if (batchData.rows.length < take) {
          hasMoreData = false;
        } else {
          skip += take;
          pageCount++;
        }
      }

      if (pageCount >= maxPages) {
        console.warn(`[AFAS-REFRESH] POST: Hit page limit (${maxPages}), may have more data available`);
      }

      const fetchDuration = (performance.now() - fetchStartTime).toFixed(2);
      console.log(`[AFAS-REFRESH] POST: Fetched ${totalRecords} records in ${fetchDuration}ms`);

    } catch (fetchError) {
      console.error('[AFAS-REFRESH] POST: AFAS fetch error:', fetchError);
      
      // Log failed refresh
      await supabase.from('afas_refresh_logs').insert({
        user_id: user.id,
        refresh_type: refreshType,
        records_fetched: 0,
        duration_ms: Math.round(performance.now() - startTime),
        success: false,
        error_message: fetchError.message
      });

      return NextResponse.json({ 
        error: 'Failed to fetch AFAS data',
        details: fetchError.message
      }, { status: 500 });
    }

    // Calculate data size
    const jsonString = JSON.stringify(allData);
    const dataSizeMB = (new Blob([jsonString]).size / (1024 * 1024)).toFixed(2);
    
    console.log(`[AFAS-REFRESH] POST: Data size: ${dataSizeMB}MB`);

    // Try to cache the data (with size limits)
    let cacheSuccess = false;
    let cacheError = null;

    if (parseFloat(dataSizeMB) <= 50) { // Same limit as cache API
      try {
        console.log('[AFAS-REFRESH] POST: Attempting to cache data...');
        
        // Use internal cache API logic
        const cacheResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/v2/afas-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({
            data: allData,
            recordCount: totalRecords,
            expiryHours
          })
        });

        if (cacheResponse.ok) {
          cacheSuccess = true;
          console.log('[AFAS-REFRESH] POST: Data cached successfully');
        } else {
          const cacheErrorData = await cacheResponse.json();
          cacheError = cacheErrorData.error || 'Cache storage failed';
          console.warn('[AFAS-REFRESH] POST: Cache storage failed:', cacheError);
        }
      } catch (cachingError) {
        cacheError = cachingError.message;
        console.warn('[AFAS-REFRESH] POST: Cache storage error:', cachingError);
      }
    } else {
      cacheError = `Data too large for caching (${dataSizeMB}MB > 50MB limit)`;
      console.warn('[AFAS-REFRESH] POST:', cacheError);
    }

    const totalDuration = Math.round(performance.now() - startTime);

    // Log successful refresh
    await supabase.from('afas_refresh_logs').insert({
      user_id: user.id,
      refresh_type: refreshType,
      records_fetched: totalRecords,
      data_size_mb: parseFloat(dataSizeMB),
      duration_ms: totalDuration,
      success: true
    });

    console.log(`[AFAS-REFRESH] POST: Refresh completed successfully (${totalRecords} records, ${dataSizeMB}MB, ${totalDuration}ms)`);

    return NextResponse.json({
      success: true,
      data: allData,
      meta: {
        recordCount: totalRecords,
        dataSizeMB: parseFloat(dataSizeMB),
        fetchDurationMs: Math.round(performance.now() - fetchStartTime),
        totalDurationMs: totalDuration,
        cached: cacheSuccess,
        cacheError: cacheSuccess ? null : cacheError,
        refreshType
      },
      source: 'AFAS API v2 - refresh'
    });

  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error('[AFAS-REFRESH] POST: Unexpected error:', error);

    // Log failed refresh
    try {
      const cookieStore = await cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await supabase.from('afas_refresh_logs').insert({
          user_id: user.id,
          refresh_type: refreshType || 'manual',
          records_fetched: 0,
          duration_ms: duration,
          success: false,
          error_message: error.message
        });
      }
    } catch (logError) {
      console.error('[AFAS-REFRESH] POST: Failed to log error:', logError);
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message,
      duration: `${duration}ms`
    }, { status: 500 });
  }
}
