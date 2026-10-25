/** Real PostgreSQL sessions and RLS checks, isolated in an ephemeral Docker container. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const container = `artice-credits-test-${randomUUID()}`;
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
const grade = (user, variant, correct = 4) => {
  const entries = Array.from({ length: 4 }, (_, i) => {
    const answer = i < correct ? i : (i + 1) % 4;
    return [`${variant * 10 + i + 1}`, answer];
  });
  const body = JSON.stringify(Object.fromEntries(entries));
  return rpc(`public.grade_quiz_with_credits('${uid(user)}', ${variant}, '${body}'::jsonb)`);
};
const save = (user, article) => rpc(`public.save_article_progress('${uid(user)}', ${article})`);
const rows = async (query) => JSON.parse(await sql(`select coalesce(jsonb_agg(t), '[]'::jsonb) from (${query}) t;`));
const burst = (size, fn) => Promise.all(Array.from({ length: size }, (_, i) => fn(i)));

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
    'supabase/migrations/20261025052243_credits_core.sql',
    'supabase/migrations/20261025142945_credit_reads.sql']) {
    await sql(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  }

  await sql(`
    insert into auth.users(id) values ${Array.from({ length: 6 }, (_, i) => `('${uid(i + 1)}')`).join(',')};
    insert into public.domains(id, slug, name_ko) values (1,'cloud','클라우드'),(2,'data','데이터');
    insert into public.content_source_rights(source,rights_status,evidence_url,reviewed_at,allow_publish)
      values ('artice-original','permitted','https://fixture.invalid/rights',now(),true),
        ('fixture-external','permitted','https://fixture.invalid/rights',now(),true);
    insert into public.articles(id,domain_id,source,source_url,original_key,foundation_order,
      content_kind,editorial_status,reference_links,status,rights_status,rights_evidence_url,rights_reviewed_at,rights_attribution)
      select n,1,'artice-original',null,'cloud-' || n,n,'original','approved',
        '[{"title":"Reference","url":"https://fixture.invalid/reference"}]'::jsonb,
        'ready','permitted','https://fixture.invalid/rights',now(),null
      from generate_series(1,3) n;
    insert into public.articles(id,domain_id,source,source_url,content_kind,editorial_status,
      status,rights_status,rights_evidence_url,rights_reviewed_at,rights_attribution)
      values (4,1,'fixture-external','https://fixture.invalid/article/4','external','draft',
        'ready','permitted','https://fixture.invalid/rights',now(),
        '{"author":"A","originalTitle":"Article","licenseLabel":"CC BY","licenseUrl":"https://fixture.invalid/license","changes":"Translated","notices":"Notice"}'::jsonb);
    insert into public.article_variants(id,article_id,level,title,content_html,glossary)
      select n,n,case when n=4 then 2 else 1 end,'Fixture','<p>Fixture</p>','{}'::jsonb
      from generate_series(1,4) n;
    insert into public.article_variants(id,article_id,level,title,content_html,glossary)
      values (1001,1,2,'Other level','<p>Fixture</p>','{}'::jsonb);
    insert into public.quiz_questions(id,variant_id,position,prompt,options,correct_index)
      select v.id * 10 + p,v.id,p,p::text,'["a","b","c","d"]'::jsonb,p-1
      from public.article_variants v cross join generate_series(1,4) p;
    insert into public.user_article_progress(user_id,article_id,variant_id,status)
      values ('${uid(1)}',1,1,'started'),('${uid(2)}',4,4,'started'),
        ('${uid(3)}',1,1,'started'),('${uid(3)}',2,2,'started'),
        ('${uid(4)}',1,1,'started'),('${uid(5)}',3,3,'started');
    insert into public.user_domain_levels(user_id,domain_id,level,rolling_accuracy,quizzes_taken,recent_scores)
      values ('${uid(2)}',1,2,0.75,1,array[0.75]::real[]),
        ('${uid(5)}',1,3,1,5,array[1.0]::real[]);
    update public.credit_policy set write_contract_required=true, earning_mode='active',
      starts_at=clock_timestamp() where id=1;
  `);

  const reader = await rpc(`public.open_article_reader('${uid(4)}', 2)`);
  assert.equal(reader.opened, true);
  assert.equal(reader.progress.status, 'started');
  assert.equal((await rows(`select status from public.user_article_progress where user_id='${uid(4)}' and article_id=2`))[0].status,'started');

  const first = await burst(20, () => grade(1, 1, 3));
  assert.equal(first.filter(row => !row.isReview).length, 1);
  assert.equal(first.filter(row => row.credits.newlyGranted === 118).length, 1);
  assert.ok(first.every(row => row.credits.balance === 118));
  assert.deepEqual((await rows(`select reason,amount from public.credit_events where user_id='${uid(1)}' order by reason`))
    .map(({reason,amount}) => [reason,amount]), [['article_read',10],['quiz_bonus',8],['welcome',100]]);
  const snapshot = await rpc(`public.get_credit_snapshot('${uid(1)}')`);
  assert.equal(snapshot.balance, '118');
  assert.equal(snapshot.hasWelcome, true);
  const history = await rows(`select * from public.get_credit_history('${uid(1)}', null, null, 2)`);
  assert.equal(history.length, 2);
  assert.ok(history.find(row => row.reason === 'article_read' || row.reason === 'quiz_bonus')?.article_title === 'Fixture');
  const next = await rows(`select * from public.get_credit_history('${uid(1)}', '${history[1].created_at}', '${history[1].event_id}', 2)`);
  assert.equal(next.length, 1);
  assert.equal(new Set([...history, ...next].map(row => row.event_id)).size, 3);
  const alternate = await grade(1, 1001);
  assert.equal(alternate.isReview, true);
  assert.equal(alternate.credits.newlyGranted, 0);
  assert.equal((await rows(`select status from public.user_article_progress where user_id='${uid(1)}' and article_id=1`))[0].status,'completed');
  const saves = await burst(10, () => save(1, 1));
  assert.ok(saves.every(row => row.ok && row.scoopId === saves[0].scoopId));
  assert.equal((await rows(`select count(distinct saved_at) as dates from public.user_article_progress where user_id='${uid(1)}' and article_id=1`))[0].dates,1);
  console.log('PASS concurrent duplicate completion, level change, and idempotent saving');

  const external = await grade(2, 4, 0);
  assert.equal(external.score, 0);
  assert.equal(external.credits.newlyGranted, 110);
  assert.equal(external.newLevel, 1);
  assert.equal((await rows(`select quizzes_taken from public.user_domain_levels where user_id='${uid(2)}' and domain_id=1`))[0].quizzes_taken,2);
  assert.equal((await grade(2,4)).isReview,true);
  const different = await Promise.all([grade(3,1,4),grade(3,2,2)]);
  assert.ok(different.every(row => !row.isReview));
  assert.equal(different.reduce((n,row) => n + row.credits.newlyGranted,0),135);
  assert.equal((await rows(`select count(*) as count from public.credit_events where user_id='${uid(3)}'`))[0].count,5);
  await sql(`insert into public.user_article_progress(user_id,article_id,variant_id,status)
    values ('${uid(6)}',3,3,'started');`);
  assert.equal((await grade(6,3,1)).credits.newlyGranted,113);
  await sql(`update public.credit_policy set earning_mode='paused' where id=1;
    insert into public.user_article_progress(user_id,article_id,variant_id,status)
      values ('${uid(6)}',2,2,'started');`);
  assert.deepEqual(await grade(6,2),{error:'credits temporarily unavailable'});
  assert.equal((await rows(`select status from public.user_article_progress where user_id='${uid(6)}' and article_id=2`))[0].status,'started');
  await sql(`update public.credit_policy set earning_mode='active' where id=1;`);
  assert.equal((await grade(6,2)).credits.newlyGranted,20);
  console.log('PASS external proficiency, original practice, concurrent distinct articles and one welcome grant');

  await sql(`create function credit_test_fail() returns trigger language plpgsql as $$
    begin if new.user_id='${uid(4)}' then raise exception 'injected credit failure'; end if; return new; end; $$;
    create trigger credit_test_fail before insert on public.credit_events
      for each row execute function credit_test_fail();`);
  await assert.rejects(() => grade(4,1), /injected credit failure/);
  assert.equal((await rows(`select status from public.user_article_progress where user_id='${uid(4)}' and article_id=1`))[0].status,'started');
  assert.equal((await rows(`select count(*) as count from public.credit_events where user_id='${uid(4)}'`))[0].count,0);
  await sql('drop trigger credit_test_fail on public.credit_events; drop function credit_test_fail();');
  const preferences = await rpc(`public.save_onboarding_preferences('${uid(5)}', '[{"domainId":1,"rareChecked":0},{"domainId":2,"rareChecked":0}]'::jsonb)`);
  assert.equal(preferences.added,1);
  const levels = await rows(`select domain_id,level,quizzes_taken, recent_scores from public.user_domain_levels where user_id='${uid(5)}' order by domain_id`);
  assert.equal(levels[0].level,3);
  assert.equal(levels[0].quizzes_taken,5);
  assert.deepEqual(levels[0].recent_scores,[1]);
  assert.equal(levels[1].level,1);
  await assert.rejects(() => sql(`update public.user_article_progress set status='completed' where user_id='${uid(5)}' and article_id=3;`), /credit write contract required/);
  await assert.rejects(() => sql(`update public.user_domain_levels set level=1 where user_id='${uid(5)}' and domain_id=1;`), /credit write contract required/);
  await assert.rejects(() => sql(`select set_config('app.credit_writer','v1',false);
    update public.user_domain_levels set level=1 where user_id='${uid(5)}' and domain_id=1;`), /credit write contract required/);
  assert.equal((await grade(5,3)).credits.newlyGranted,120);
  await assert.rejects(() => sql(`delete from public.user_article_progress where user_id='${uid(5)}' and article_id=3;`), /credit write contract required/);
  assert.equal(await sql(`select has_function_privilege('authenticated','public.grade_quiz_with_credits(uuid,bigint,jsonb)','execute');`),'f');
  assert.equal(await sql(`select has_function_privilege('authenticated','public.get_credit_snapshot(uuid)','execute');`),'f');
  assert.equal(await sql(`select has_function_privilege('authenticated','public.get_credit_history(uuid,timestamptz,bigint,integer)','execute');`),'f');
  await assert.rejects(() => sql(`set role authenticated; insert into public.credit_events(user_id,amount,reason,source_id,policy_version) values ('${uid(5)}',10,'article_read','fake',1);`), /permission denied|row-level security/);
  await sql(`update public.articles set rights_status='blocked' where id=1;`);
  const withdrawn = await rows(`select * from public.get_credit_history('${uid(1)}', null, null, 5)`);
  assert.ok(withdrawn.every(row => row.article_title === null));
  assert.equal((await rpc(`public.get_credit_snapshot('${uid(1)}')`)).balance, '118');
  await sql(`delete from auth.users where id='${uid(6)}';`);
  assert.equal((await rows(`select count(*) as count from public.credit_events where user_id='${uid(6)}'`))[0].count,0);
  console.log('PASS transactional rollback, onboarding preservation, legacy-write guard and database privileges');
} finally {
  await command(['stop', container]).catch(() => {});
}
