import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";

/**
 * Service-role client — bypasses RLS entirely.
 *
 * Only for code paths that must be authoritative: the ingest pipeline, quiz
 * grading (reads answers, writes progress and levels), and quota enforcement.
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
