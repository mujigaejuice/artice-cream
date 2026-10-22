/** Real concurrent PostgreSQL sessions. No credentials, ports or production DB. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

function command(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", chunk => { err += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err || out)));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

const container = `artice-quota-test-${randomUUID()}`;
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sql = statement => command(["exec", "-i", container, "psql", "-U", "postgres", "-XAtq", "-v", "ON_ERROR_STOP=1"], statement);
const rpc = async expression => JSON.parse(await sql(`set role service_role; select ${expression};`));
const quota = n => rpc(`public.get_daily_quota('${uid(n)}')`);
const open = (n, article, variant = article) => rpc(`public.open_article_with_quota('${uid(n)}', ${article}, ${variant})`);
const reward = (n, nonce) => rpc(`public.grant_ad_unlock('${uid(n)}', '${nonce}')`);
const count = async (table, n) => Number(await sql(`select count(*) from public.${table} where user_id = '${uid(n)}';`));
const burst = (size, fn) => Promise.all(Array.from({ length: size }, (_, i) => fn(i)));

try {
  await command(["run", "--detach", "--rm", "--name", container, "--network", "none",
    "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"]);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { await command(["exec", container, "pg_isready", "-U", "postgres"]); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  assert.ok(ready, "temporary PostgreSQL did not start");
  await sql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to service_role, authenticated;
    alter default privileges in schema public grant all on sequences to service_role, authenticated;
  `);
  for (const file of ["supabase/migrations/0001_init.sql", "supabase/policies.sql",
    "supabase/migrations/0002_content_rights.sql", "supabase/migrations/0006_atomic_quota.sql",
    "supabase/migrations/20261022095402_original_foundations.sql",
    "supabase/migrations/20261022180420_article_reader_rpc.sql"]) {
    await sql(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
  }
  await sql(`
    insert into auth.users(id) values ${Array.from({ length: 24 }, (_, i) => `('${uid(i + 1)}')`).join(",")};
    insert into articles(id, source_url) select n, 'https://fixture.invalid/' || n from generate_series(1, 30) n;
    insert into article_variants(id, article_id, level, title, content_html, glossary)
      select n, n, 2, 'Fixture', '<p>Fixture</p>', '{}'::jsonb from generate_series(1, 30) n;
    insert into article_variants(id, article_id, level, title, content_html, glossary)
      values (1001, 1, 3, 'Other level', '<p>Fixture</p>', '{}');
  `);

  const different = await burst(12, i => open(1, i + 1));
  assert.equal(different.filter(r => r.opened).length, 1, "one free read across simultaneous different articles");
  assert.equal(await count("user_article_progress", 1), 1, "denied reads leave no progress");
  assert.equal((await quota(1)).remaining, 0);

  assert.ok((await burst(12, i => open(2, 1, i % 2 ? 1001 : 1))).every(r => r.opened));
  assert.equal(await count("user_article_progress", 2), 1, "one debit across duplicate opens and levels");
  await sql(`update user_article_progress set status = 'saved', quiz_score = 1 where user_id = '${uid(2)}';`);
  assert.equal((await open(2, 1)).opened, true);
  assert.equal(await sql(`select status from user_article_progress where user_id = '${uid(2)}';`), "saved");
  assert.equal((await quota(2)).remaining, 0);
  console.log("PASS concurrent different articles, duplicate opens, level changes and saved rereads");

  const duplicate = await burst(12, () => reward(3, "duplicate"));
  assert.equal(duplicate.filter(r => r.status === "granted").length, 1);
  assert.equal(duplicate.filter(r => r.status === "replayed").length, 11);
  assert.equal(await count("ad_views", 3), 1);
  assert.equal((await quota(3)).adUnlocks, 1);
  await open(3, 1);
  assert.equal((await quota(3)).adUnlocks, 1, "free allowance is consumed before ad credit");
  assert.equal((await reward(4, "duplicate")).status, "conflict", "nonce belongs to one user");

  const distinct = await burst(12, i => reward(4, `distinct-${i}`));
  assert.equal(distinct.filter(r => r.status === "granted").length, 3);
  assert.equal(distinct.filter(r => r.status === "limit").length, 9);
  assert.equal(await count("ad_views", 4), 3, "rejected grants leave no ledger entries");
  assert.equal((await quota(4)).remaining, 4);
  assert.equal((await burst(12, i => open(4, i + 1))).filter(r => r.opened).length, 4);
  assert.equal((await quota(4)).remaining, 0);
  assert.equal((await reward(4, "after-spending")).status, "limit", "spending must not reset the grant cap");
  const winningNonce = await sql(`select nonce from ad_views where user_id = '${uid(4)}' order by id limit 1;`);
  assert.equal((await reward(4, winningNonce)).status, "replayed", "retry still succeeds at the cap");
  console.log("PASS concurrent rewards, idempotent replay, free-first spending and three-grant cap");

  const mixed = await Promise.all([burst(3, i => reward(5, `mixed-${i}`)), burst(12, i => open(5, i + 1))]);
  assert.ok(mixed[0].every(r => r.status === "granted"));
  // Retry any requests that legitimately ran before a grant arrived.
  await burst(12, i => open(5, i + 1));
  assert.equal(await count("user_article_progress", 5), 4);
  assert.equal((await quota(5)).remaining, 0, "reads and rewards cannot overwrite each other's balance");
  assert.equal((await quota(5)).adUnlocksGrantedToday, 3);
  console.log("PASS simultaneous reads and rewards without lost updates");

  await sql(`
    create function quota_test_fail() returns trigger language plpgsql as $$
    begin raise exception 'injected storage failure'; end; $$;
    create trigger quota_test_progress before insert on user_article_progress
      for each row when (new.user_id = '${uid(6)}') execute function quota_test_fail();
    create trigger quota_test_balance before insert or update on daily_quota
      for each row when (new.user_id = '${uid(7)}') execute function quota_test_fail();
  `);
  await assert.rejects(open(6, 1), /injected storage failure/);
  assert.equal(await count("daily_quota", 6), 0, "debit is rolled back when progress insertion fails");
  assert.equal(await count("user_article_progress", 6), 0);
  await assert.rejects(reward(7, "retry-after-failure"), /injected storage failure/);
  assert.equal(await count("ad_views", 7), 0, "ledger insertion is rolled back when balance write fails");
  assert.equal(await count("daily_quota", 7), 0);
  await sql("drop trigger quota_test_progress on user_article_progress; drop trigger quota_test_balance on daily_quota;");
  assert.equal((await open(6, 1)).opened, true);
  assert.equal((await reward(7, "retry-after-failure")).status, "granted");
  await assert.rejects(open(8, 1, 2), /variant does not belong/);
  assert.equal((await quota(8)).remaining, 1);
  await assert.rejects(reward(99, "missing-user"), /profile not found/);
  await sql(`insert into ad_views(user_id, nonce, reward_verified) values ('${uid(8)}', 'legacy-incomplete', false);`);
  assert.equal((await reward(8, "legacy-incomplete")).status, "conflict");
  assert.equal((await quota(8)).adUnlocks, 0);
  console.log("PASS transaction rollback, safe retry, invalid variant/account and legacy incomplete nonce");

  await sql(`
    insert into daily_quota(user_id, quota_date, free_used, ad_unlocks)
      values ('${uid(9)}', (now() at time zone 'Asia/Seoul')::date - 1, true, 2);
    insert into ad_views(user_id, nonce, reward_verified, created_at)
      select '${uid(9)}', 'yesterday-' || n, true,
        (((now() at time zone 'Asia/Seoul')::date - 1)::timestamp at time zone 'Asia/Seoul')
      from generate_series(1,3) n;
    insert into ad_views(user_id, nonce, reward_verified, created_at) values
      ('${uid(10)}', 'before-midnight', true, '2026-10-15T14:59:59.999Z'),
      ('${uid(10)}', 'at-midnight', true, '2026-10-15T15:00:00Z'),
      ('${uid(10)}', 'next-midnight', true, '2026-10-16T15:00:00Z');
  `);
  const today = await quota(9);
  assert.equal(today.date, await sql("select (now() at time zone 'Asia/Seoul')::date;"));
  assert.equal(today.remaining, 1, "yesterday's balance does not carry over");
  assert.equal(today.adUnlocksGrantedToday, 0);
  assert.equal((await reward(9, "yesterday-1")).status, "replayed");
  assert.equal((await quota(9)).adUnlocks, 0, "old successful nonce cannot grant again today");
  assert.equal((await rpc(`public.quota_state('${uid(10)}', '2026-10-16')`)).adUnlocksGrantedToday, 1);
  console.log("PASS KST day boundary, daily reset and cross-day reward replay");

  const reader = (n, variant = 20) => rpc(`public.open_article_reader('${uid(n)}', ${variant})`);
  await sql(`
    insert into content_source_rights(source, rights_status, evidence_url, reviewed_at, allow_publish)
      values ('reader-test', 'permitted', 'https://fixture.invalid/license', now() - interval '1 day', true),
        ('artice-original', 'permitted', 'https://fixture.invalid/original', now() - interval '1 day', true);
    update articles set source = 'reader-test', rights_status = 'permitted',
      rights_evidence_url = 'https://fixture.invalid/license', rights_reviewed_at = now() - interval '1 day',
      original_text = 'PRIVATE ORIGINAL', rights_review_note = 'PRIVATE NOTE',
      rights_attribution = '{"author":"Author","originalTitle":"Title","licenseLabel":"CC BY","licenseUrl":"https://fixture.invalid/license","changes":"Adapted","notices":""}'
      where id between 20 and 30;
  `);
  const readerBurst = await burst(12, () => reader(13));
  assert.ok(readerBurst.every(r => r.opened && r.progress.status === "started"));
  assert.equal(await count("user_article_progress", 13), 1);
  assert.equal((await quota(13)).remaining, 0);
  assert.doesNotMatch(JSON.stringify(readerBurst), /PRIVATE|original_text|rights_review_note|quiz_answers|correct_index/);
  const locked = await reader(13, 21);
  assert.equal(locked.opened, false);
  assert.equal(locked.variant, undefined, "quota denial contains no body");
  await sql(`update user_article_progress set status = 'saved', quiz_score = 0.75 where user_id = '${uid(13)}';`);
  assert.deepEqual((await reader(13)).progress, { status: "saved", quiz_score: 0.75 });
  assert.deepEqual(await reader(14, 999999), { error: "not found" });
  for (const change of ["rights_status = 'blocked'", "rights_expires_at = now() - interval '1 second'",
    "rights_attribution = null", "status = 'pending'"]) {
    await sql(`update articles set ${change} where id = 21;`);
    assert.deepEqual(await reader(14, 21), { error: "not found" });
    assert.equal(await count("daily_quota", 14), 0, "denied rights cannot debit quota");
    assert.equal(await count("user_article_progress", 14), 0);
    await sql(`update articles set rights_status = 'permitted', rights_expires_at = null, status = 'ready',
      rights_attribution = (select rights_attribution from articles where id = 20) where id = 21;`);
  }
  await sql("update content_source_rights set allow_publish = false where source = 'reader-test';");
  assert.deepEqual(await reader(13), { error: "not found" }, "withdrawal also blocks saved rereads");
  assert.deepEqual(await reader(14, 21), { error: "not found" });
  await sql("update content_source_rights set allow_publish = true where source = 'reader-test';");
  const differentReaders = await burst(10, i => reader(15, 20 + i));
  assert.equal(differentReaders.filter(r => r.opened).length, 1);
  assert.equal(await count("user_article_progress", 15), 1);
  await sql(`
    insert into domains(id, slug, name_ko) values (190, 'reader-test', '테스트');
    insert into articles(id, domain_id, source, source_url, content_kind, original_key, foundation_order,
      editorial_status, reference_links, rights_status, rights_evidence_url, rights_reviewed_at)
      values (200, 190, 'artice-original', null, 'original', 'reader-01', 1, 'approved',
        '[{"title":"Reference","url":"https://fixture.invalid/ref","checkedAt":"2026-01-01"}]',
        'permitted', 'https://fixture.invalid/original', now() - interval '1 day');
    insert into article_variants(id, article_id, level, title, content_html, glossary)
      values (200, 200, 1, 'Original', '<p>Original</p>', '{}');
  `);
  const original = await reader(16, 200);
  assert.equal(original.opened, true);
  assert.equal(original.variant.articles.content_kind, "original");
  assert.equal(original.variant.articles.reference_links.length, 1);
  assert.equal(original.variant.articles.domains.slug, "reader-test");
  await sql("update articles set editorial_status = 'withdrawn' where id = 200;");
  assert.deepEqual(await reader(16, 200), { error: "not found" });
  await sql(`create trigger reader_test_progress before insert on user_article_progress
    for each row when (new.user_id = '${uid(18)}') execute function quota_test_fail();`);
  await assert.rejects(reader(18), /injected storage failure/);
  assert.equal(await count("daily_quota", 18), 0);
  assert.equal(await count("user_article_progress", 18), 0);
  await sql("drop trigger reader_test_progress on user_article_progress;");
  assert.equal((await reader(18)).opened, true);
  await assert.rejects(reader(99), /profile not found/);
  console.log("PASS reader RPC: concurrent opens, locked/withdrawn content, originals, projection and rollback");

  for (const role of ["anon", "authenticated"]) {
    for (const expression of [
      `public.quota_state('${uid(1)}', current_date)`, `public.get_daily_quota('${uid(1)}')`,
      `public.open_article_with_quota('${uid(1)}', 1, 1)`, `public.grant_ad_unlock('${uid(1)}', 'unauthorized')`,
      `public.open_article_reader('${uid(1)}', 20)`,
    ]) await assert.rejects(sql(`set role ${role}; select ${expression};`), /permission denied/);
  }
  console.log("PASS RPC permissions: only service_role can read or mutate quota via RPC");
  console.log("All PostgreSQL quota checks passed.");
} finally {
  // Only this randomly named, isolated test container is removed.
  await command(["rm", "--force", container]);
}
