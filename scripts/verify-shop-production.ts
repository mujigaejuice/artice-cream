/** Live web shop smoke test with a disposable account. Run only with --production. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase/env";

if (!process.argv.includes("--production")) throw new Error("Pass --production");
assert.equal(new URL(SUPABASE_URL()).hostname, "dtfslvnibnwtoxgijbtb.supabase.co");
const site = "https://artice-cream.vercel.app";
const admin = createAdminClient();
const run = randomUUID();
const email = `shop-check-${run}@example.com`;
const password = `${randomUUID()}Aa1!`;
const variantId = 362;
const articleId = 1917;
const itemId = process.argv.includes("--palette") ? "berry-palette"
  : process.argv.includes("--texture") ? "cloud-swirl"
  : process.argv.includes("--scene") ? "pink-parlor"
  : process.argv.includes("--topping") ? "rainbow-sprinkles"
  : process.argv.includes("--music") ? "one-scoop-of-joy" : "night-sky";
const slot = itemId === "berry-palette" ? "palette" : itemId === "cloud-swirl" ? "texture"
  : itemId === "rainbow-sprinkles" ? "topping" : itemId === "one-scoop-of-joy" ? "music" : "background";
const expectedPrice = slot === "music" || slot === "topping" ? 150
  : slot === "palette" || slot === "texture" ? 130 : 120;
const catalogVersion = slot === "music" || slot === "palette" ? 2 : 1;
const extraQuizzes = expectedPrice === 150 ? 2 : expectedPrice > 120 ? 1 : 0;
const quizCredits = 120 + extraQuizzes * 20;
const finalSpendable = quizCredits - expectedPrice;
const finalBalance = 500 + finalSpendable;
let userId: string | undefined;

async function main() {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    app_metadata: { shop_test: run } });
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
    const request = async (path: string, body?: unknown, expected = 200) => {
      const response = await fetch(`${site}${path}`, {
        method: body === undefined ? "GET" : "POST", cache: "no-store",
        signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json();
      assert.equal(response.status, expected, `${path}: ${response.status} ${JSON.stringify(data)}`);
      return data;
    };
    const completeQuiz = async (selectedVariant: number, expectedArticle: number) => {
      const reader = await request("/api/read/open", { variantId: selectedVariant });
      assert.equal(reader.opened, true);
      assert.equal(reader.reader?.articleId, expectedArticle);
      const quiz = await request(`/api/quiz?v=${selectedVariant}`);
      assert.equal(quiz.mode, "quiz");
      const { data: keys, error: keyError } = await admin.from("quiz_questions")
        .select("id,correct_index").eq("variant_id", selectedVariant);
      if (keyError) throw keyError;
      assert.equal(keys?.length, quiz.questions?.length);
      const questionIds = new Set(quiz.questions.map((question: { id: number }) => question.id));
      assert.ok(keys?.every((key) => questionIds.has(key.id)));
      const answers = Object.fromEntries(keys!.map((key) => [key.id, key.correct_index]));
      const grade = await request("/api/quiz/grade", { variantId: selectedVariant, answers });
      assert.equal(grade.isReview, false);
      assert.equal(grade.credits?.status, "granted");
      return grade.credits.newlyGranted as number;
    };
    const onboarding = await request("/api/onboarding");
    const domainId = onboarding.domains?.[0]?.id;
    assert.ok(Number.isSafeInteger(domainId));
    assert.equal((await request("/api/onboarding", { selections: [{ domainId, rareChecked: 0 }] })).ok, true);
    const before = await request("/api/shop");
    assert.equal(before.spendingEnabled, true);
    assert.equal(before.balance, 0);
    assert.equal(before.spendableBalance, 0);
    assert.equal(before.items?.length, 17);
    assert.ok(before.items.every((item: { isActive: boolean }) => item.isActive));
    for (const [key, price] of Object.entries({ "pink-parlor": 120, "turkish-stand": 120,
      "evening-street": 120, "rainbow-sprinkles": 150, "chocolate-drizzle": 150,
      "cheese-cubes": 150, "fresh-strawberry": 150, "cloud-swirl": 130, "gelato-folds": 130 })) {
      assert.equal(before.items.find((item: { id: string }) => item.id === key)?.price, price);
    }
    const product = before.items.find((item: { id: string }) => item.id === itemId);
    assert.equal(product?.price, expectedPrice);
    assert.equal(product?.catalogVersion, catalogVersion);
    if (catalogVersion === 2) {
      const stale = await request("/api/credits/spend", { itemId, catalogVersion: 1 }, 409);
      assert.equal(stale.error, "price_changed");
    }
    if (slot === "palette") {
      assert.equal((await request("/api/cosmetics/colors", { colors: { cloud: "#8A6CCF" } }, 403)).error,
        "item_not_owned");
    }
    if (slot === "music") {
      for (const name of ["one-scoop-of-joy", "tiptoe-into-sunlight", "two-scoops-of-july", "waffle-cone-waltz"]) {
        const media = await fetch(`${site}/audio/${name}.mp3`, { method: "HEAD",
          signal: AbortSignal.timeout(30_000) });
        assert.equal(media.status, 200, `${name} audio asset`);
      }
    }

    const adjustment = await admin.from("credit_events").insert({ user_id: userId,
      amount: 500, reason: "adjustment", source_id: `shop-test:${run}`,
      policy_version: (await request("/api/credits")).policyVersion,
      metadata: { purpose: "temporary shop smoke" } });
    if (adjustment.error) throw adjustment.error;
    const adjusted = await request("/api/shop");
    assert.equal(adjusted.balance, 500);
    assert.equal(adjusted.spendableBalance, 0);
    const unaffordable = await request("/api/credits/spend", { itemId, catalogVersion }, 409);
    assert.equal(unaffordable.error, "insufficient_credits");
    assert.equal(unaffordable.shortfall, expectedPrice);

    assert.equal(await completeQuiz(variantId, articleId), 120);
    const earned = await request("/api/shop");
    assert.equal(earned.balance, 620);
    assert.equal(earned.spendableBalance, 120);
    if (extraQuizzes) {
      const stillShort = await request("/api/credits/spend", { itemId, catalogVersion }, 409);
      assert.equal(stillShort.error, "insufficient_credits");
      assert.equal(stillShort.shortfall, expectedPrice - 120);
      for (const [nextVariant, nextArticle] of [[367, 1922], [368, 1923]].slice(0, extraQuizzes)) {
        const grant: { data: unknown; error: unknown } = await admin.rpc("grant_ad_unlock", {
          p_user_id: userId, p_nonce: `shop-test:${run}:${nextVariant}`,
        });
        if (grant.error) throw grant.error;
        assert.equal((grant.data as { status?: string } | null)?.status, "granted");
        assert.equal(await completeQuiz(nextVariant, nextArticle), 20);
      }
      const ready = await request("/api/shop");
      assert.equal(ready.balance, 500 + quizCredits);
      assert.equal(ready.spendableBalance, quizCredits);
    }

    const bought = await request("/api/credits/spend", { itemId, catalogVersion });
    assert.equal(bought.status, "purchased");
    assert.equal(bought.balance, finalBalance);
    assert.equal(bought.spendableBalance, finalSpendable);
    const repeat = await request("/api/credits/spend", { itemId, catalogVersion });
    assert.equal(repeat.status, "already_owned");
    const equip = await request("/api/cosmetics/equip", { slot, itemId });
    assert.equal(equip.equipped[slot], itemId);
    if (slot === "palette") {
      const colors = { cloud: "#8A6CCF", infra: "#EBAE8A", data: "#75B3A2",
        "cs-fundamentals": "#E7C06F", "deep-learning": "#8E9BD7", llm: "#C88FD1",
        "ai-security": "#E985A3", security: "#A0B66A" };
      assert.equal((await request("/api/cosmetics/colors", { colors: { unknown: "#123456" } }, 400)).error,
        "invalid_body");
      const saved = await request("/api/cosmetics/colors", { colors });
      assert.deepEqual(saved.scoopColors, colors);
      assert.equal(saved.equipped.palette, itemId);
    }
    const after = await request("/api/shop");
    assert.equal(after.balance, finalBalance);
    assert.equal(after.spendableBalance, finalSpendable);
    assert.deepEqual(after.ownedItems, [itemId]);
    assert.equal(after.equipped[slot], itemId);
    if (slot === "palette") assert.equal(Object.keys(after.scoopColors).length, 8);
    assert.equal((await request("/api/credits")).spendableBalance, finalSpendable);
    assert.equal((await request("/api/credits/spend", { itemId: "sugar-stars", catalogVersion: 1 }, 409)).error,
      "insufficient_credits");
    assert.deepEqual((await request("/api/cosmetics/equip", { slot, itemId: null })).equipped, {});
    const history = await request("/api/credits/history");
    assert.equal(history.events?.filter((event: { reason: string }) => event.reason === "purchase").length, 1);
    assert.equal(history.events?.reduce((total: number, event: { amount: number }) => total + event.amount, 0), finalBalance);
    console.log(JSON.stringify({ result: "passed", articleId, quizCredits,
      adjustmentExcluded: 500, purchase: itemId, purchasePrice: expectedPrice, finalSpendable }));
  } finally {
    if (userId) {
      const remaining = await admin.auth.admin.getUserById(userId);
      if (remaining.error) throw new Error("Could not verify shop fixture for cleanup");
      assert.equal(remaining.data.user.email, email);
      assert.equal(remaining.data.user.app_metadata.shop_test, run);
      const removed = await admin.auth.admin.deleteUser(userId, false);
      if (removed.error) throw new Error("Shop fixture cleanup failed");
    }
  }
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : "Shop production smoke failed");
  process.exitCode = 1;
});
