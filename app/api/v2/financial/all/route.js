import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { performance } from 'perf_hooks';

// Async function to fetch fresh AFAS data and update cache in background
async function updateAfasCacheInBackground(userId, supabase) {
  try {
    console.log(`[FINANCIAL-ALL] Background: Starting AFAS fetch for user ${userId}`);
    const fetchStart = performance.now();
    
    let allData = [];
    let skip = 0;
    const take = 20000;
    let hasMoreData = true;
    let pagesFetched = 0;
    const ABSOLUTE_MAX_RECORDS = 1000000;

    while (hasMoreData) {
      const afasUrl = `https://96778.resttest.afas.online/ProfitRestServices/connectors/Innoworks_Financiele_mutaties?skip=${skip}&take=${take}&orderbyfieldids=-Boekstukdatum`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      try {
        const response = await fetch(afasUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-language': 'nl-nl',
            'Authorization': 'AfasToken ' + process.env.AFAS_TOKEN
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`[FINANCIAL-ALL] Background: AFAS fetch failed: ${response.status}`);
          break;
        }

        const batchData = await response.json();
        if (!batchData.rows || batchData.rows.length === 0) {
          hasMoreData = false;
          break;
        }

        allData = allData.concat(batchData.rows);
        pagesFetched += 1;

        if (batchData.rows.length < take) {
          hasMoreData = false;
        } else {
          skip += take;
        }

        if (allData.length >= ABSOLUTE_MAX_RECORDS) {
          console.warn('[FINANCIAL-ALL] Background: Safety stop reached');
          hasMoreData = false;
          break;
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error('[FINANCIAL-ALL] Background: Fetch error:', fetchError);
        break;
      }
    }

    const fetchDuration = (performance.now() - fetchStart).toFixed(2);
    console.log(`[FINANCIAL-ALL] Background: Fetched ${allData.length} records in ${fetchDuration}ms`);

    // Update cache directly using supabase client
    if (allData.length > 0) {
      try {
        const { gzipSync } = await import('zlib');
        const crypto = await import('crypto');
        
        // Calculate data size
        const jsonString = JSON.stringify(allData);
        const dataSizeMB = (new Blob([jsonString]).size / (1024 * 1024)).toFixed(2);
        
        // Compress data
        const buffer = Buffer.from(jsonString, 'utf8');
        const compressedBuffer = gzipSync(buffer, { level: 9 });
        const base64Data = compressedBuffer.toString('base64');
        
        // Create data hash
        const dataHash = crypto.createHash('md5').update(jsonString).digest('hex');
        
        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        // Clear existing cache
        await supabase
          .from('afas_data_cache')
          .delete()
          .eq('user_id', userId);
        
        // Insert new cache entry
        const { error: insertError } = await supabase
          .from('afas_data_cache')
          .insert({
            user_id: userId,
            data_hash: dataHash,
            compressed_data: base64Data,
            record_count: allData.length,
            data_size_mb: parseFloat(dataSizeMB),
            expires_at: expiresAt.toISOString()
          });
        
        if (insertError) {
          console.error('[FINANCIAL-ALL] Background: Cache insert error:', insertError);
        } else {
          console.log(`[FINANCIAL-ALL] Background: Successfully cached ${allData.length} records (${dataSizeMB}MB)`);
        }
      } catch (cacheError) {
        console.error('[FINANCIAL-ALL] Background: Cache error:', cacheError);
      }
    }
  } catch (error) {
    console.error('[FINANCIAL-ALL] Background: Unexpected error:', error);
  }
}

// API Route: Smart financial data fetching with async cache strategy
export async function GET(request) {
  const startTime = performance.now();
  console.log('[FINANCIAL-ALL] GET: Starting request');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[FINANCIAL-ALL] GET: Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const singlePage = searchParams.get('singlePage') === '1' || searchParams.get('mode') === 'paged';

    // Handle single page requests directly from AFAS
    if (singlePage) {
      const skipQ = parseInt(searchParams.get('skip') || '0');
      const takeQ = parseInt(searchParams.get('take') || '100000');
      
      console.log(`[FINANCIAL-ALL] GET: Single page mode - skip:${skipQ}, take:${takeQ}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const afasUrl = `https://96778.resttest.afas.online/ProfitRestServices/connectors/Innoworks_Financiele_mutaties?skip=${skipQ}&take=${takeQ}&orderbyfieldids=-Boekstukdatum`;
      
      const response = await fetch(afasUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-language': 'nl-nl',
          'Authorization': 'AfasToken ' + process.env.AFAS_TOKEN
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          { error: 'AFAS fetch failed', status: response.status },
          { status: 502 }
        );
      }

      const batchData = await response.json();
      const rows = batchData.rows || [];
      const hasMore = rows.length === takeQ;
      const duration = (performance.now() - startTime).toFixed(2);

      return NextResponse.json({
        source: 'AFAS API v2 - singlePage',
        mode: 'singlePage',
        count: rows.length,
        hasMore,
        nextSkip: skipQ + rows.length,
        pageSize: takeQ,
        rows,
        duration: `${duration}ms`
      });
    }

    console.log(`[FINANCIAL-ALL] GET: User ${user.id}, forceRefresh=${forceRefresh} - CACHE TEMPORARILY DISABLED`);

    // TEMPORARILY SKIP ALL CACHE OPERATIONS - DIRECT AFAS FETCH ONLY

    // DIRECT AFAS FETCH - NO CACHE
    console.log('[FINANCIAL-ALL] GET: Fetching directly from AFAS (cache disabled)');
    
    let allData = [];
    let skip = 0;
    const take = 20000;
    let hasMoreData = true;
    let pagesFetched = 0;
    const ABSOLUTE_MAX_RECORDS = 1000000;

    while (hasMoreData) {
      const afasUrl = `https://96778.resttest.afas.online/ProfitRestServices/connectors/Innoworks_Financiele_mutaties?skip=${skip}&take=${take}&orderbyfieldids=-Boekstukdatum`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      const response = await fetch(afasUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-language': 'nl-nl',
          'Authorization': 'AfasToken ' + process.env.AFAS_TOKEN
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[FINANCIAL-ALL] GET: AFAS fetch failed: ${response.status}`);
        return NextResponse.json(
          { error: 'AFAS fetch failed', status: response.status },
          { status: 502 }
        );
      }

      const batchData = await response.json();
      if (!batchData.rows || batchData.rows.length === 0) {
        hasMoreData = false;
        break;
      }

      allData = allData.concat(batchData.rows);
      pagesFetched += 1;

      if (batchData.rows.length < take) {
        hasMoreData = false;
      } else {
        skip += take;
      }

      if (allData.length >= ABSOLUTE_MAX_RECORDS) {
        console.warn('[FINANCIAL-ALL] GET: Safety stop reached');
        hasMoreData = false;
        break;
      }
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[FINANCIAL-ALL] GET: Fetched ${allData.length} records directly from AFAS in ${duration}ms`);

    // NO CACHE OPERATIONS - RETURN DIRECTLY
    return NextResponse.json({
      source: 'AFAS API v2 - direct fetch (cache disabled)',
      totalRecords: allData.length,
      fetchedAll: true,
      pagesFetched,
      pageSize: take,
      allRecords: allData,
      cached: false,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error('[FINANCIAL-ALL] GET: Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message,
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

