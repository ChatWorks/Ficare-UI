import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { performance } from 'perf_hooks';
import { gzipSync, gunzipSync } from 'zlib';

// GET: Retrieve cached AFAS data for authenticated user
export async function GET(request) {
  const startTime = performance.now();
  console.log('[AFAS-CACHE] GET: Starting cache retrieval');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[AFAS-CACHE] GET: Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const summaryOnly = searchParams.get('summary') === 'true';

    console.log(`[AFAS-CACHE] GET: User ${user.id}, summary=${summaryOnly}`);

    // Query cache table
    let query = supabase
      .from('afas_data_cache')
      .select(summaryOnly ? 'id,record_count,data_size_mb,last_refreshed_at,expires_at' : '*')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('last_refreshed_at', { ascending: false })
      .limit(1);

    const { data: cacheData, error: queryError } = await query;

    if (queryError) {
      console.error('[AFAS-CACHE] GET: Database query error:', queryError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const duration = (performance.now() - startTime).toFixed(2);

    if (!cacheData || cacheData.length === 0) {
      console.log(`[AFAS-CACHE] GET: No valid cache found (duration: ${duration}ms)`);
      return NextResponse.json({ 
        cached: false, 
        message: 'No valid cache found',
        duration: `${duration}ms`
      });
    }

    const cache = cacheData[0];
    
    if (summaryOnly) {
      console.log(`[AFAS-CACHE] GET: Returning cache summary (duration: ${duration}ms)`);
      return NextResponse.json({
        cached: true,
        summary: {
          recordCount: cache.record_count,
          dataSizeMB: cache.data_size_mb,
          lastRefreshed: cache.last_refreshed_at,
          expiresAt: cache.expires_at
        },
        duration: `${duration}ms`
      });
    }

    // Decompress data
    let decompressedData;
    try {
      if (cache.compressed_data) {
        console.log('[AFAS-CACHE] GET: Decompressing data...');
        
        let compressedBuffer;
        
        // Handle different data types from Supabase more robustly
        if (typeof cache.compressed_data === 'string') {
          // Check if it's a hex string (common corruption pattern)
          if (cache.compressed_data.match(/^[0-9a-fA-F]+$/)) {
            console.log('[AFAS-CACHE] GET: Detected hex string format');
            compressedBuffer = Buffer.from(cache.compressed_data, 'hex');
          } else {
            // Assume base64
            compressedBuffer = Buffer.from(cache.compressed_data, 'base64');
          }
        } else if (Buffer.isBuffer(cache.compressed_data)) {
          compressedBuffer = cache.compressed_data;
        } else if (cache.compressed_data && cache.compressed_data.type === 'Buffer' && Array.isArray(cache.compressed_data.data)) {
          compressedBuffer = Buffer.from(cache.compressed_data.data);
        } else if (cache.compressed_data instanceof Uint8Array) {
          compressedBuffer = Buffer.from(cache.compressed_data);
        } else {
          console.warn('[AFAS-CACHE] GET: Unknown compressed data format, attempting conversion');
          compressedBuffer = Buffer.from(cache.compressed_data);
        }
        
        console.log(`[AFAS-CACHE] GET: Decompressing ${compressedBuffer.length} bytes...`);
        
        // Validate gzip header before decompression
        if (compressedBuffer.length < 3 || compressedBuffer[0] !== 0x1f || compressedBuffer[1] !== 0x8b) {
          throw new Error('Invalid gzip header - data may be corrupted');
        }
        
        const decompressedBuffer = gunzipSync(compressedBuffer);
        const jsonString = decompressedBuffer.toString('utf8');
        decompressedData = JSON.parse(jsonString);
        
        console.log(`[AFAS-CACHE] GET: Successfully decompressed to ${jsonString.length} chars`);
      } else {
        console.warn('[AFAS-CACHE] GET: No compressed data found in cache');
        return NextResponse.json({ 
          cached: false, 
          message: 'Cache data corrupted',
          duration: `${duration}ms`
        });
      }
    } catch (decompressError) {
      console.error('[AFAS-CACHE] GET: Decompression error:', decompressError);
      console.error('[AFAS-CACHE] GET: Compressed data type:', typeof cache.compressed_data);
      console.error('[AFAS-CACHE] GET: Compressed data sample:', cache.compressed_data?.toString?.()?.substring(0, 100));
      
      // Clear corrupted cache entry
      console.log('[AFAS-CACHE] GET: Clearing corrupted cache entry...');
      await supabase
        .from('afas_data_cache')
        .delete()
        .eq('id', cache.id);
      
      return NextResponse.json({ 
        cached: false, 
        message: 'Cache corrupted and cleared',
        duration: `${duration}ms`
      });
    }

    console.log(`[AFAS-CACHE] GET: Successfully returned ${cache.record_count} records (${cache.data_size_mb}MB, duration: ${duration}ms)`);
    
    return NextResponse.json({
      cached: true,
      data: decompressedData,
      meta: {
        recordCount: cache.record_count,
        dataSizeMB: cache.data_size_mb,
        lastRefreshed: cache.last_refreshed_at,
        expiresAt: cache.expires_at
      },
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error('[AFAS-CACHE] GET: Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

// POST: Store AFAS data in cache for authenticated user
export async function POST(request) {
  const startTime = performance.now();
  console.log('[AFAS-CACHE] POST: Starting cache storage');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[AFAS-CACHE] POST: Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data, recordCount, expiryHours = 24, companyId } = body;

    if (!data) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    console.log(`[AFAS-CACHE] POST: User ${user.id}, storing ${recordCount || 'unknown'} records`);

    // Calculate data size
    const jsonString = JSON.stringify(data);
    const dataSizeMB = (new Blob([jsonString]).size / (1024 * 1024)).toFixed(2);

    console.log(`[AFAS-CACHE] POST: Data size: ${dataSizeMB}MB`);

    // Check size limits (200MB uncompressed limit - we'll compress heavily)
    if (parseFloat(dataSizeMB) > 200) {
      console.warn(`[AFAS-CACHE] POST: Data too large (${dataSizeMB}MB > 200MB limit)`);
      return NextResponse.json({ 
        error: 'Data too large for caching',
        sizeMB: dataSizeMB,
        limit: '200MB'
      }, { status: 413 });
    }

    // Compress data using gzip
    console.log(`[AFAS-CACHE] POST: Compressing ${dataSizeMB}MB of data...`);
    const compressionStart = performance.now();
    
    const buffer = Buffer.from(jsonString, 'utf8');
    const compressedBuffer = gzipSync(buffer, { level: 9 }); // Maximum compression
    
    const compressedSizeMB = (compressedBuffer.length / (1024 * 1024)).toFixed(2);
    const compressionRatio = ((1 - compressedBuffer.length / buffer.length) * 100).toFixed(1);
    const compressionDuration = (performance.now() - compressionStart).toFixed(2);
    
    console.log(`[AFAS-CACHE] POST: Compressed ${dataSizeMB}MB → ${compressedSizeMB}MB (${compressionRatio}% reduction) in ${compressionDuration}ms`);
    
    // Check if compressed data is still too large (25MB limit for database storage)
    if (parseFloat(compressedSizeMB) > 25) {
      console.warn(`[AFAS-CACHE] POST: Compressed data still too large (${compressedSizeMB}MB > 25MB limit)`);
      return NextResponse.json({ 
        error: 'Data too large even after compression',
        originalSizeMB: dataSizeMB,
        compressedSizeMB: compressedSizeMB,
        compressionRatio: `${compressionRatio}%`,
        limit: '25MB compressed'
      }, { status: 413 });
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Create data hash for change detection
    const dataHash = require('crypto').createHash('md5').update(jsonString).digest('hex');

    // Clear existing cache for this user
    const { error: deleteError } = await supabase
      .from('afas_data_cache')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.warn('[AFAS-CACHE] POST: Error clearing old cache:', deleteError);
    }

    // Convert buffer to base64 for reliable storage
    const base64Data = compressedBuffer.toString('base64');
    
    // Insert new cache entry
    const { data: insertData, error: insertError } = await supabase
      .from('afas_data_cache')
      .insert({
        user_id: user.id,
        company_id: companyId,
        data_hash: dataHash,
        compressed_data: base64Data, // Store as base64 string for reliability
        record_count: recordCount || data.length,
        data_size_mb: parseFloat(dataSizeMB),
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('[AFAS-CACHE] POST: Database insert error:', insertError);
      return NextResponse.json({ error: 'Failed to store cache' }, { status: 500 });
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[AFAS-CACHE] POST: Successfully cached ${recordCount || data.length} records (${dataSizeMB}MB → ${compressedSizeMB}MB, duration: ${duration}ms)`);

    return NextResponse.json({
      success: true,
      meta: {
        recordCount: recordCount || data.length,
        originalSizeMB: parseFloat(dataSizeMB),
        compressedSizeMB: parseFloat(compressedSizeMB),
        compressionRatio: `${compressionRatio}%`,
        expiresAt: expiresAt.toISOString(),
        dataHash
      },
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error('[AFAS-CACHE] POST: Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

// DELETE: Clear cache for authenticated user
export async function DELETE(request) {
  const startTime = performance.now();
  console.log('[AFAS-CACHE] DELETE: Starting cache deletion');

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[AFAS-CACHE] DELETE: Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[AFAS-CACHE] DELETE: User ${user.id}`);

    // Delete cache entries for this user
    const { error: deleteError } = await supabase
      .from('afas_data_cache')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[AFAS-CACHE] DELETE: Database delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[AFAS-CACHE] DELETE: Successfully cleared cache (duration: ${duration}ms)`);

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error('[AFAS-CACHE] DELETE: Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}
