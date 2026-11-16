/** Bookmark RPC against real PostgreSQL in an ephemeral Docker container. No credentials or production DB. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const container = `artice-bookmarks-test-${randomUUID()}`;
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err || out)));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
const sql = statement => command(['exec', '-i', container, 'psql', '-U', 'postgres', '-XAtq', '-v', 'ON_ERROR_STOP=1'], statement);
const rpc = async expression => JSON.parse(await sql(`set role service_role; select ${expression};`));
const bookmark = (user, article, on) => rpc(`public.set_article_bookmark('${uid(user)}', ${article}, ${on})`);
const reader = (user, variant) => rpc(`public.open_article_reader('${uid(user)}', ${variant})`);
const rows = async query => JSON.parse(await sql(`select coalesce(jsonb_agg(t), '[]'::jsonb) from (${query}) t;`));
const progress = user => rows(`select article_id, variant_id, status, quiz_score, started_at, completed_at, saved_at,
  bookmarked_at from public.user_article_progress where user_id='${uid(user)}' order by article_id`);
const quota = user => rows(`select quota_date, free_used, ad_unlocks from public.daily_quota where user_id='${uid(user)}'`);

try {
  await command(['run', '--detach', '--rm', '--name', container, '--network', 'none',
    '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { await command(['exec', container, 'pg_isready', '-U', 'postgres']); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  assert.ok(ready, 'isolated PostgreSQL did not start');
  await sql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function auth.jwt() returns jsonb language sql as 'select null::jsonb';
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to service_role, authenticated;
    alter default privileges in schema public grant all on sequences to service_role, authenticated;
  `);
  for (const file of ['supabase/migrations/0001_init.sql', 'supabase/policies.sql',
    'supabase/migrations/0002_content_rights.sql',
    'supabase/migrations/0003_source_candidates.sql',
    'supabase/migrations/0004_licensed_source_collection.sql',
    'supabase/migrations/0005_more_licensed_collection.sql',
    'supabase/migrations/0006_atomic_quota.sql',
    'supabase/migrations/20261022095402_original_foundations.sql',
    'supabase/migrations/20261022180420_article_reader_rpc.sql',
    'supabase/migrations/20261025145740_credits_core.sql',
    'supabase/migrations/20261116120000_article_bookmarks.sql']) {
    await sql(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  }

  await sql(`
    insert into auth.users(id) values ('${uid(1)}'),('${uid(2)}');
    insert into public.domains(id, slug, name_ko) values (1,'cloud','클라우드');
    insert into public.content_source_rights(source,rights_status,evidence_url,reviewed_at,allow_publish)
      values ('fixture-external','permitted','https://fixture.invalid/rights',now(),true);
    insert into public.articles(id,domain_id,source,source_url,content_kind,editorial_status,
      status,rights_status,rights_evidence_url,rights_reviewed_at,rights_attribution)
      select n,1,'fixture-external','https://fixture.invalid/article/' || n,'external','draft',
        'ready','permitted','https://fixture.invalid/rights',now(),
        '{"author":"A","originalTitle":"Article","licenseLabel":"CC BY","licenseUrl":"https://fixture.invalid/license","changes":"Translated","notices":""}'::jsonb
      from generate_series(1,3) n;
    insert into public.article_variants(id,article_id,level,title,content_html,glossary)
      select n,n,2,'Fixture ' || n,'<p>Fixture</p>','{}'::jsonb from generate_series(1,3) n;
    update public.credit_policy set write_contract_required=true, earning_mode='active',
      starts_at=clock_timestamp() where id=1;
  `);

  // First open spends the free read and creates the only progress row.
  const first = await reader(1, 1);
  assert.equal(first.opened, true);
  assert.equal(first.progress.bookmarked, false, 'reader projection includes bookmark state');
  const quotaAfterOpen = await quota(1);
  assert.equal(quotaAfterOpen[0].free_used, true);
  const before = await progress(1);

  const on = await bookmark(1, 1, true);
  assert.deepEqual({ ...on, bookmarkedAt: undefined }, { ok: true, articleId: 1, bookmarked: true, bookmarkedAt: undefined });
  const after = await progress(1);
  assert.equal(after.length, 1);
  assert.ok(after[0].bookmarked_at, 'bookmark is stored');
  assert.deepEqual({ ...after[0], bookmarked_at: null }, before[0], 'only bookmarked_at changes');
  assert.deepEqual(await quota(1), quotaAfterOpen, 'bookmarking never touches quota');

  const again = await bookmark(1, 1, true);
  assert.equal(again.bookmarkedAt, on.bookmarkedAt, 'repeat bookmark keeps the original time');

  // No progress row: no bookmark, no row, no quota.
  assert.deepEqual(await bookmark(1, 2, true), { error: 'not found' });
  assert.deepEqual(await bookmark(2, 1, true), { error: 'not found' }, 'another user cannot bookmark through someone else\'s read');
  assert.equal((await progress(1)).length, 1);
  assert.equal((await progress(2)).length, 0);
  assert.deepEqual(await quota(2), []);
  assert.deepEqual(await quota(1), quotaAfterOpen);

  // Reopening is the existing free path and now reports the bookmark.
  const reopened = await reader(1, 1);
  assert.equal(reopened.opened, true);
  assert.equal(reopened.progress.bookmarked, true);
  assert.deepEqual(await quota(1), quotaAfterOpen, 'reopen stays free');
  // The free read is spent: an unopened article remains locked even after bookmarking attempts.
  const locked = await reader(1, 2);
  assert.equal(locked.opened, false, 'bookmarks never unlock new articles');

  // The legacy write guard still blocks any other progress update path.
  await assert.rejects(() => sql(`set role service_role; update public.user_article_progress set bookmarked_at=null where user_id='${uid(1)}';`),
    /credit write contract required/);
  await sql(`set role authenticated; update public.user_article_progress set bookmarked_at=null where user_id='${uid(1)}';`).catch(() => {});
  assert.ok((await progress(1))[0].bookmarked_at, 'clients cannot write bookmarks directly');
  assert.equal(await sql(`select has_function_privilege('authenticated','public.set_article_bookmark(uuid,bigint,boolean)','execute');`), 'f');
  assert.equal(await sql(`select has_function_privilege('anon','public.set_article_bookmark(uuid,bigint,boolean)','execute');`), 'f');
  assert.equal(await sql(`select has_function_privilege('authenticated','public.open_article_reader(uuid,bigint)','execute');`), 'f');
  assert.match(await sql(`select indexdef from pg_indexes where indexname='user_article_progress_bookmarks_idx';`),
    /\(user_id, bookmarked_at DESC, id DESC\) WHERE \(bookmarked_at IS NOT NULL\)/);

  // Withdrawn articles cannot be newly bookmarked, but can always be removed.
  await sql(`update public.articles set rights_status='blocked' where id=1;`);
  await bookmark(1, 1, false);
  assert.deepEqual(await bookmark(1, 1, true), { error: 'not found' });
  await sql(`update public.articles set rights_status='permitted' where id=1;`);
  assert.equal((await bookmark(1, 1, true)).bookmarked, true);
  await sql(`update public.articles set rights_status='blocked' where id=1;`);
  assert.deepEqual(await bookmark(1, 1, false), { ok: true, articleId: 1, bookmarked: false, bookmarkedAt: null });

  // Account deletion cascades through profiles to bookmarked progress rows.
  await sql(`update public.articles set rights_status='permitted' where id=1;`);
  await bookmark(1, 1, true);
  await sql(`delete from auth.users where id='${uid(1)}';`);
  assert.equal((await progress(1)).length, 0, 'account deletion removes bookmarks');
  console.log('PASS bookmark RPC: existing-row only, quota untouched, reader projection, guard/privileges, rights gate and deletion cascade');
} finally {
  await command(['stop', container]).catch(() => {});
}
