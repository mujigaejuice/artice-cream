/** Live credit rollout smoke test using a disposable, verified account. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase/env";

type Mode = "inactive" | "guard" | "active";
const mode = process.argv.find((arg) => arg.startsWith("--mode="))?.slice(7) as Mode;
if (!["inactive", "guard", "active"].includes(mode) || !process.argv.includes("--production")) {
  throw new Error("Pass --production --mode=inactive|guard|active");
}
assert.equal(new URL(SUPABASE_URL()).hostname, "dtfslvnibnwtoxgijbtb.supabase.co");
const site = "https://artice-cream.vercel.app";
const variantId = 362;
const articleId = 1917;
const admin = createAdminClient();
const run = randomUUID();
const email = `credits-check-${run}@example.com`;
const password = `${randomUUID()}Aa1!`;
let userId: string | undefined;

async function main() {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    app_metadata: { credit_test: run } });
  if (created.error) throw new Error(`Fixture creation failed (${created.error.code ?? created.error.status})`);
  userId = created.data.user?.id;
  assert.ok(userId);
  try {
    const client = createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error(`Fixture sign-in failed (${signed.error.code ?? signed.error.status})`);
    const token = signed.data.session?.access_token;
    assert.ok(token);
    const request = async (path: string, body?: unknown) => {
      const response = await fetch(`${site}${path}`, {
        method: body === undefined ? "GET" : "POST", cache: "no-store",
        signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json();
      assert.equal(response.status, 200, `${path}: ${response.status} ${JSON.stringify(data)}`);
      return data;
    };
    const onboarding = await request("/api/onboarding");
    assert.equal(onboarding.isSignedIn, true);
    const domainId = onboarding.domains?.[0]?.id;
    assert.ok(Number.isSafeInteger(domainId));
    const preferences = await request("/api/onboarding", { selections: [{ domainId, rareChecked: 0 }] });
    assert.equal(preferences.ok, true);
    const before = await request("/api/credits");
    assert.equal(before.earningMode, mode === "active" ? "active" : "inactive");
    assert.equal(before.balance, 0);
    if (mode === "active") assert.equal(before.spendableBalance, 0);
    const reader = await request("/api/read/open", { variantId });
    assert.equal(reader.opened, true);
    assert.equal(reader.reader?.articleId, articleId);
    assert.equal(reader.reader?.progressStatus, "started");
    if (mode !== "inactive") {
      const oldWrite = await admin.from("user_article_progress")
        .update({ status: "completed" }).eq("user_id", userId).eq("article_id", articleId);
      assert.equal(oldWrite.error?.code, "55000", "old direct completion must be rejected");
      const oldLevel = await admin.from("user_domain_levels")
        .update({ level: 2 }).eq("user_id", userId).eq("domain_id", domainId);
      assert.equal(oldLevel.error?.code, "55000", "old direct level write must be rejected");
    }
    const quiz = await request(`/api/quiz?v=${variantId}`);
    assert.equal(quiz.mode, "quiz");
    assert.ok(quiz.questions?.length > 0);
    const answers = Object.fromEntries(quiz.questions.map((question: { id: number }) => [question.id, 0]));
    const grade = await request("/api/quiz/grade", { variantId, answers });
    assert.equal(grade.isReview, false);
    assert.equal(grade.credits?.status, mode === "active" ? "granted" : "disabled");
    assert.equal(grade.credits?.newlyGranted >= 110, mode === "active");
    const repeat = await request("/api/quiz/grade", { variantId, answers });
    assert.equal(repeat.isReview, true);
    assert.equal(repeat.credits?.newlyGranted, 0);
    const save = await request("/api/progress/save", { articleId });
    assert.equal(save.saved, true);
    const savedAgain = await request("/api/progress/save", { articleId });
    assert.equal(savedAgain.scoopId, save.scoopId);
    const cone = await request("/api/cone");
    assert.equal(cone.status, "ok");
    assert.ok(cone.scoops?.some((scoop: { articleId: number }) => scoop.articleId === articleId));
    const snapshot = await request("/api/credits");
    assert.deepEqual(await request("/api/credits"), snapshot, "balance persists across requests");
    const history = await request("/api/credits/history");
    if (mode === "active") {
      assert.equal(snapshot.balance, grade.credits.newlyGranted);
      assert.equal(snapshot.spendableBalance, snapshot.balance);
      assert.equal(snapshot.hasWelcome, true);
      assert.equal(history.events?.length, 3);
      assert.equal(history.events.reduce((sum: number, event: { amount: number }) => sum + event.amount, 0), snapshot.balance);
      const shop = await request("/api/shop");
      assert.equal(shop.spendingEnabled, false);
      assert.equal(shop.spendableBalance, shop.balance);
      assert.equal(shop.items?.length, 4);
      assert.deepEqual(shop.ownedItems, []);
      const blocked = await fetch(`${site}/api/credits/spend`, {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: "sugar-stars", catalogVersion: 1 }),
      });
      assert.equal(blocked.status, 503);
      assert.equal((await blocked.json()).error, "shop_unavailable");
    } else {
      assert.equal(snapshot.balance, 0);
      assert.deepEqual(history.events, []);
    }
    console.log(JSON.stringify({ mode, result: "passed", quizQuestions: quiz.questions.length,
      gradeStatus: grade.credits.status, balance: snapshot.balance, events: history.events.length }));
  } finally {
    if (userId) {
      const remaining = await admin.auth.admin.getUserById(userId);
      if (remaining.error) throw new Error("Could not verify credit fixture for cleanup");
      assert.equal(remaining.data.user.email, email);
      assert.equal(remaining.data.user.app_metadata.credit_test, run);
      const removed = await admin.auth.admin.deleteUser(userId, false);
      if (removed.error) throw new Error("Credit fixture cleanup failed");
    }
  }
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : "Credit production smoke failed");
  process.exitCode = 1;
});
