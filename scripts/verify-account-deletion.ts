/** Live integration check. Creates/deletes only its own uniquely tagged test user.
 * node --env-file=.env.local --import=tsx scripts/verify-account-deletion.ts
 * No email is sent. No pre-existing account or shared article is modified.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase/env";
import { GET, POST } from "../app/api/account/delete/route.api";

async function main() {
  const admin = createAdminClient();
  const run = randomUUID();
  const email = `deletion-check-${run}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const client = createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let fixtureId: string | undefined;
  const tables = ["profiles", "user_domain_levels", "user_article_progress", "daily_quota", "ad_views"];
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { account_deletion_test: run } });
    if (created.error) throw new Error(`Fixture creation failed (${created.error.code ?? created.error.status})`);
    fixtureId = created.data.user?.id;
    assert.ok(fixtureId, "fixture user created");

    const { data: domains, error: domainError } = await admin.from("domains").select("id").limit(1);
    assert.equal(domainError, null);
    assert.ok(domains?.length, "a seeded domain is required");
    const { data: variants, error: variantError } = await admin.from("article_variants").select("id,article_id").limit(1);
    assert.equal(variantError, null);
    assert.ok(variants?.length, "an existing shared article is required (read only)");
    const variant = variants[0];
    const fixtureRows: Array<[string, Record<string, unknown>]> = [
      ["user_domain_levels", { user_id: fixtureId, domain_id: domains[0].id, level: 2, recent_scores: [0.5] }],
      ["user_article_progress", { user_id: fixtureId, article_id: variant.article_id, variant_id: variant.id, status: "saved", quiz_score: 0.5, quiz_answers: { "1": 0 } }],
      ["daily_quota", { user_id: fixtureId, quota_date: "2000-01-01", free_used: true, ad_unlocks: 1 }],
      ["ad_views", { user_id: fixtureId, nonce: `account-deletion-test-${run}`, reward_verified: true, unlocked_variant_id: variant.id }],
    ];
    for (const [table, row] of fixtureRows) {
      const { error } = await admin.from(table).insert(row);
      assert.equal(error, null, `seed ${table}`);
    }
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error(`Fixture login failed (${signed.error.code ?? signed.error.status})`);
    assert.ok(signed.data.session);
    const otherDeviceJwt = signed.data.session.access_token;
    const otherRefreshToken = signed.data.session.refresh_token;
    // Generate (do not email) the same existing-account magic link used by the UI.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw new Error(`Fixture link failed (${link.error.code ?? link.error.status})`);
    const confirmed = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
    if (confirmed.error) throw new Error(`Fixture confirmation failed (${confirmed.error.code ?? confirmed.error.status})`);
    assert.ok(confirmed.data.session);
    const jwt = confirmed.data.session.access_token;
    const refreshToken = confirmed.data.session.refresh_token;
    const makeRequest = () => new Request("http://localhost:3000/api/account/delete", {
      method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expectedUserId: fixtureId, confirmation: "계정 삭제" }),
    });
    assert.equal((await (await GET(makeRequest())).json()).canDelete, true, "live authentication time recognized");
    for (const table of tables) {
      const { count, error }: { count: number | null; error: unknown } = await admin.from(table).select("*", { count: "exact", head: true })
        .eq(table === "profiles" ? "id" : "user_id", fixtureId);
      assert.equal(error, null);
      assert.equal(count, 1, `fixture exists in ${table}`);
    }
    const response = await POST(makeRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { deleted: true });
    for (const table of tables) {
      const { count, error }: { count: number | null; error: unknown } = await admin.from(table).select("*", { count: "exact", head: true })
        .eq(table === "profiles" ? "id" : "user_id", fixtureId);
      assert.equal(error, null);
      assert.equal(count, 0, `no personal rows remain in ${table}`);
    }
    const removedAuth = await admin.auth.admin.getUserById(fixtureId);
    assert.equal(removedAuth.data.user, null, "Auth user removed");
    assert.equal((await GET(makeRequest())).status, 401, "old JWT cannot use account API");
    assert.equal((await POST(makeRequest())).status, 401, "repeated request cannot act with old JWT");
    const otherDeviceRequest = new Request("http://localhost:3000/api/account/delete", { headers: { Authorization: `Bearer ${otherDeviceJwt}` } });
    assert.equal((await GET(otherDeviceRequest)).status, 401, "another device's JWT cannot access the account");

    // Direct PostgREST and in-flight server writes cannot recreate the deleted user data.
    const stale = createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const oldRead = await stale.from("profiles").select("id").eq("id", fixtureId);
    assert.ok(oldRead.error || oldRead.data?.length === 0, "stale direct client sees no profile");
    const oldWrite = await stale.from("user_domain_levels").upsert({ user_id: fixtureId, domain_id: domains[0].id, level: 2 });
    assert.ok(oldWrite.error, "stale direct client cannot resurrect levels");
    const lateWrite = await admin.from("daily_quota").insert({ user_id: fixtureId, quota_date: "2000-01-02" });
    assert.ok(lateWrite.error, "an in-flight service write cannot resurrect quota");
    const refreshed = await client.auth.refreshSession({ refresh_token: refreshToken });
    assert.ok(refreshed.error, "old refresh token is unusable");
    const otherRefreshed = await client.auth.refreshSession({ refresh_token: otherRefreshToken });
    assert.ok(otherRefreshed.error, "another device's refresh token is unusable");
    const shared = await admin.from("article_variants").select("id").eq("id", variant.id).single();
    assert.equal(shared.error, null);
    assert.equal(shared.data.id, variant.id, "shared content is preserved");
    console.log("Live account deletion passed: email-link auth; Auth + 5 personal tables removed; both devices' JWT/API and refresh blocked; direct/late writes blocked; shared content preserved.");
  } finally {
    if (fixtureId) {
      const remaining = await admin.auth.admin.getUserById(fixtureId);
      if (remaining.data.user) {
        // Never delete an account unless both our unique address and tag match.
        assert.equal(remaining.data.user.email, email);
        assert.equal(remaining.data.user.app_metadata.account_deletion_test, run);
        const cleaned = await admin.auth.admin.deleteUser(fixtureId, false);
        if (cleaned.error) throw new Error(`Test fixture cleanup failed (${cleaned.error.code ?? cleaned.error.status})`);
      } else if (remaining.error && !["user_not_found"].includes(remaining.error.code ?? "") && remaining.error.status !== 404) {
        throw new Error("Could not verify test fixture cleanup; rerun inspection before creating another fixture");
      }
    }
  }
}

main().catch((error: unknown) => {
  // Assertion data can include provider responses; output only the failure message.
  console.error(error instanceof Error ? error.message : "Live deletion check failed");
  process.exitCode = 1;
});
