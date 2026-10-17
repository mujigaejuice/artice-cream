/** Live, read-only RPC check. No account or content fixture is created. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase/env";

async function main() {
  assert.ok(process.argv.includes("--production"), "requires explicit --production");
  assert.equal(new URL(SUPABASE_URL()).hostname, "dtfslvnibnwtoxgijbtb.supabase.co");
  const admin = createAdminClient();
  const guest = createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const missingUser = randomUUID();
  const profile = await admin.from("profiles").select("id").eq("id", missingUser).maybeSingle();
  assert.equal(profile.error, null);
  assert.equal(profile.data, null, "probe must not refer to an existing user");

  const quota = await admin.rpc("get_daily_quota", { p_user_id: missingUser });
  assert.equal(quota.error, null, "PostgREST schema must expose the new RPC");
  assert.match(quota.data.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual({ ...quota.data, date: undefined }, {
    date: undefined, freeUsed: false, adUnlocks: 0, remaining: 1,
    canRead: true, canUnlockWithAd: true, adUnlocksGrantedToday: 0,
  });
  const calls = [
    ["get_daily_quota", { p_user_id: missingUser }],
    ["quota_state", { p_user_id: missingUser, p_date: quota.data.date }],
    ["open_article_with_quota", { p_user_id: missingUser, p_article_id: 0, p_variant_id: 0 }],
    ["grant_ad_unlock", { p_user_id: missingUser, p_nonce: `readonly-probe-${missingUser}` }],
  ] as const;
  for (const [name, args] of calls) {
    const denied = await guest.rpc(name, args);
    assert.equal(denied.error?.code, "42501", `${name}: unauthenticated caller must be denied`);
  }
  for (const [name, args] of calls.slice(2)) {
    // Both functions reject a nonexistent profile before any write or content lookup.
    const rejected = await admin.rpc(name, args);
    assert.equal(rejected.error?.code, "23503", `${name}: missing profile must prevent mutation`);
  }
  console.log("Production quota RPC checks passed: REST schema loaded, quota shape correct, all guest calls denied, missing-user writes rejected; no fixtures created.");
}
main().catch(cause => {
  console.error(cause instanceof Error ? cause.message : "Quota RPC verification failed");
  process.exitCode = 1;
});
