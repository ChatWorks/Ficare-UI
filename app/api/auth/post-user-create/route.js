import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { performance } from "perf_hooks";

export async function POST() {
  const startTime = performance.now();
  console.log("[post-user-create] Starting user initialization process");

  try {
    const cookieStore = await cookies();
    const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      console.log("[post-user-create] Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[post-user-create] Processing user: ${user.id}`);

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // server-only!
    );

  // 1) Check if already initialized
  console.log("[post-user-create] Checking initialization status");
  const [{ data: prof }, { data: mem }] = await Promise.all([
    admin.from("profiles").select("initialized_at").eq("user_id", user.id).maybeSingle(),
    admin.from("company_members").select("id").eq("user_id", user.id).limit(1),
  ]);

  if (prof?.initialized_at && mem?.length) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[post-user-create] User already initialized (duration: ${duration}ms)`);
    return NextResponse.json({ ok: true, skipped: "already-initialized" });
  }

  // 2) Determine company from domain
  const email = (user.email || "").toLowerCase();
  const domain = email.split("@").pop();
  console.log(`[post-user-create] Looking up company for domain: ${domain}`);

  const { data: cd } = await admin
    .from("company_domains")
    .select("company_id")
    .eq("domain", domain)
    .limit(1)
    .maybeSingle();

  if (!cd?.company_id) {
    console.log(`[post-user-create] No company found for domain ${domain}, updating profile only`);
    await admin.from("profiles").upsert(
      [{ user_id: user.id, full_name: user.user_metadata?.name ?? null, initialized_at: new Date().toISOString() }],
      { onConflict: "user_id" }
    );
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[post-user-create] Profile updated without company (duration: ${duration}ms)`);
    return NextResponse.json({ ok: true, note: "no company for domain" });
  }

  const companyId = cd.company_id;
  console.log(`[post-user-create] Found company: ${companyId}, performing upserts`);

  // 3) Upserts (idempotent)
  console.log(`[post-user-create] Attempting profile upsert`, {
    table: 'profiles',
    user_id: user.id,
    operation: 'upsert',
    conflict_target: 'user_id'
  });
  
  const { data: profileData, error: profileError } = await admin.from("profiles").upsert(
    [{ user_id: user.id, full_name: user.user_metadata?.name ?? null, initialized_at: new Date().toISOString() }],
    { onConflict: "user_id" }
  );
  
  if (profileError) {
    console.error(`[post-user-create] Profile upsert failed:`, {
      error: profileError,
      status: profileError.status,
      message: profileError.message,
      details: profileError.details
    });
    throw profileError;
  }
  console.log(`[post-user-create] Profile upserted for user: ${user.id}`);

  console.log(`[post-user-create] Attempting company member upsert`, {
    table: 'company_members',
    user_id: user.id,
    company_id: companyId,
    operation: 'upsert',
    conflict_target: 'company_id,user_id'
  });

  const { data: memberData, error: memberError } = await admin.from("company_members").upsert(
    [{ company_id: companyId, user_id: user.id, role: "member", status: "pending" }],
    { onConflict: "company_id,user_id" }
  );

  if (memberError) {
    console.error(`[post-user-create] Company member upsert failed:`, {
      error: memberError,
      status: memberError.status,
      message: memberError.message,
      details: memberError.details
    });
    throw memberError;
  }
  console.log(`[post-user-create] Company member status updated`);

  const duration = (performance.now() - startTime).toFixed(2);
  console.log(`[post-user-create] User initialization completed successfully (duration: ${duration}ms)`);
  return NextResponse.json({ ok: true });
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    
    // Log detailed error information
    console.error(`[post-user-create] Error during user initialization (duration: ${duration}ms):`, {
      error_message: error.message,
      error_code: error?.code,
      status: error?.status,
      details: error?.details,
      hint: error?.hint,
      // Include Supabase specific error details if available
      supabase_status: error?.status,
      supabase_statusText: error?.statusText,
      supabase_error: error?.error,
      // Include request context
      operation: error?.operation || 'unknown',
      endpoint: error?.url || 'unknown'
    });

    // Determine appropriate status code
    const statusCode = error?.status || 500;
    const errorMessage = error?.message || "Internal server error";
    
    return NextResponse.json({ 
      error: errorMessage,
      code: error?.code,
      details: error?.details
    }, { status: statusCode });
  }
}
