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
    'supabase/migrations/20261025145740_credits_core.sql',
    'supabase/migrations/20261025145758_credit_reads.sql',
    'supabase/migrations/20261025160738_cosmetic_shop.sql',
    'supabase/migrations/20261026071437_quiz_only_spending.sql',
    'supabase/migrations/20261026184211_music_shop.sql',
    'supabase/migrations/20261026192933_expanded_cone_cosmetics.sql',
    // 운영 적용 순서 그대로 전체 체인을 올린다.
    'supabase/migrations/20261116090000_ingest_runs.sql',
    'supabase/migrations/20261116120000_article_bookmarks.sql',
    'supabase/migrations/20261117010000_streak_reward.sql',
    'supabase/migrations/20261117120000_onboarding_quiz_level.sql',
    'supabase/migrations/20261118090000_onboarding_retake.sql']) {
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
  // Onboarding quiz: the server sends the level it graded; rareChecked stays for older app builds.
  await sql(`insert into auth.users(id) values ('${uid(7)}');`);
  const quiz = await rpc(`public.save_onboarding_preferences('${uid(7)}', '[{"domainId":1,"level":3},{"domainId":2,"level":1}]'::jsonb)`);
  assert.equal(quiz.added,2);
  const quizLevels = await rows(`select domain_id,level from public.user_domain_levels where user_id='${uid(7)}' order by domain_id`);
  assert.deepEqual(quizLevels.map(row => row.level),[3,1]);
  assert.equal((await rpc(`public.save_onboarding_preferences('${uid(7)}', '[{"domainId":1,"level":1}]'::jsonb)`)).added,0);
  assert.equal((await rows(`select level from public.user_domain_levels where user_id='${uid(7)}' and domain_id=1`))[0].level,3);
  for (const bad of ['{"domainId":1,"level":0}', '{"domainId":1,"level":4}', '{"domainId":1,"level":"2"}',
    '{"domainId":1,"level":2,"rareChecked":1}', '{"domainId":1}']) {
    assert.equal((await rpc(`public.save_onboarding_preferences('${uid(7)}', '[${bad}]'::jsonb)`)).error,'invalid body',bad);
  }
  // Re-onboarding retake: only an explicit retake overwrites a level, and it restarts the recent-score window.
  await sql(`set role service_role; select set_config('app.credit_writer','v1',false);
    update public.user_domain_levels set recent_scores='{0.25,0.5}', rolling_accuracy=0.4, quizzes_taken=6
      where user_id='${uid(7)}' and domain_id=1;`);
  const retake = await rpc(`public.save_onboarding_preferences('${uid(7)}', '[{"domainId":1,"level":1,"retake":true},{"domainId":2,"level":3}]'::jsonb)`);
  assert.equal(retake.ok,true);
  assert.equal(retake.added,0);
  assert.equal(retake.retaken,1);
  const retakenLevels = await rows(`select domain_id,level,recent_scores,rolling_accuracy,quizzes_taken from public.user_domain_levels
    where user_id='${uid(7)}' order by domain_id`);
  assert.deepEqual(retakenLevels.map(row => row.level),[1,1],'retake overwrites; a plain save still does not');
  assert.deepEqual(retakenLevels[0].recent_scores,[]);
  assert.equal(retakenLevels[0].rolling_accuracy,0);
  assert.equal(retakenLevels[0].quizzes_taken,6,'reading history count is kept');
  for (const bad of ['{"domainId":1,"rareChecked":1,"retake":true}', '{"domainId":1,"level":2,"retake":false}',
    '{"domainId":1,"level":2,"retake":"yes"}']) {
    assert.equal((await rpc(`public.save_onboarding_preferences('${uid(7)}', '[${bad}]'::jsonb)`)).error,'invalid body',bad);
  }
  await sql(`delete from auth.users where id='${uid(7)}';`);
  await assert.rejects(() => sql(`update public.user_article_progress set status='completed' where user_id='${uid(5)}' and article_id=3;`), /credit write contract required/);
  await assert.rejects(() => sql(`update public.user_domain_levels set level=1 where user_id='${uid(5)}' and domain_id=1;`), /credit write contract required/);
  await assert.rejects(() => sql(`select set_config('app.credit_writer','v1',false);
    update public.user_domain_levels set level=1 where user_id='${uid(5)}' and domain_id=1;`), /credit write contract required/);
  assert.equal((await grade(5,3)).credits.newlyGranted,120);
  await assert.rejects(() => sql(`delete from public.user_article_progress where user_id='${uid(5)}' and article_id=3;`), /credit write contract required/);
  assert.equal(await sql(`select has_function_privilege('authenticated','public.grade_quiz_with_credits(uuid,bigint,jsonb)','execute');`),'f');
  assert.equal(await sql(`select has_function_privilege('authenticated','public.get_credit_snapshot(uuid)','execute');`),'f');
  assert.equal(await sql(`select has_function_privilege('authenticated','public.get_quiz_spendable_balance(uuid)','execute');`),'f');
  assert.equal(await sql(`select has_function_privilege('authenticated','public.get_credit_history(uuid,timestamptz,bigint,integer)','execute');`),'f');
  await assert.rejects(() => sql(`set role authenticated; insert into public.credit_events(user_id,amount,reason,source_id,policy_version) values ('${uid(5)}',10,'article_read','fake',1);`), /permission denied|row-level security/);
  await sql(`update public.articles set rights_status='blocked' where id=1;`);
  const withdrawn = await rows(`select * from public.get_credit_history('${uid(1)}', null, null, 5)`);
  assert.ok(withdrawn.every(row => row.article_title === null));
  assert.equal((await rpc(`public.get_credit_snapshot('${uid(1)}')`)).balance, '118');
  await sql(`update public.credit_policy set spending_enabled=true where id=1;
    update public.cosmetic_items set is_active=true;
    insert into public.credit_events(user_id,amount,reason,source_id,policy_version)
      values('${uid(5)}',500,'adjustment','shop-fixture',1);`);
  await sql(await readFile(new URL('../supabase/migrations/20261026185542_music_price_150.sql', import.meta.url), 'utf8'));
  const spend = (user, item, version = 1) => rpc(`public.spend_credits('${uid(user)}','${item}',${version})`);
  assert.equal((await spend(1,'berry-palette')).error,'insufficient_credits');
  assert.equal((await spend(5,'sugar-stars')).error,'insufficient_credits');
  assert.equal((await spend(5,'sugar-stars')).shortfall,30);
  const adjusted = await rpc(`public.get_shop_snapshot('${uid(5)}')`);
  assert.equal(adjusted.balance,'620');
  assert.equal(adjusted.spendableBalance,'120');
  assert.equal((await rpc(`public.get_credit_snapshot('${uid(5)}')`)).spendableBalance,'120');
  assert.equal((await spend(6,'berry-palette',2)).error,'price_changed');
  const duplicate = await burst(12, () => spend(3,'berry-palette'));
  assert.equal(duplicate.filter(row => row.status === 'purchased').length,1);
  assert.equal(duplicate.filter(row => row.status === 'already_owned').length,11);
  assert.equal((await rows(`select count(*) as n from public.credit_events where user_id='${uid(3)}' and reason='purchase'`))[0].n,1);
  assert.equal((await rpc(`public.equip_cosmetic('${uid(3)}','cone','berry-palette')`)).error,'wrong_slot');
  assert.equal((await rpc(`public.equip_cosmetic('${uid(3)}','palette','berry-palette')`)).equipped.palette,'berry-palette');
  assert.equal((await rpc(`public.equip_cosmetic('${uid(3)}','palette',null)`)).equipped.palette,undefined);
  assert.equal((await rpc(`public.set_scoop_colors('${uid(6)}','{}'::jsonb)`)).error,'item_not_owned');
  assert.equal((await rpc(`public.set_scoop_colors('${uid(3)}','{"wrong":"#123456"}'::jsonb)`)).error,'invalid_body');
  const chosenColors = { cloud:'#8A6CCF', infra:'#EBAE8A', data:'#75B3A2',
    'cs-fundamentals':'#E7C06F', 'deep-learning':'#8E9BD7', llm:'#C88FD1',
    'ai-security':'#E985A3', security:'#A0B66A' };
  const savedColors = await rpc(`public.set_scoop_colors('${uid(3)}','${JSON.stringify(chosenColors)}'::jsonb)`);
  assert.equal(savedColors.status,'saved');
  assert.equal(savedColors.equipped.palette,'berry-palette');
  assert.deepEqual(savedColors.scoopColors,chosenColors);
  assert.deepEqual((await rpc(`public.get_shop_snapshot('${uid(3)}')`)).scoopColors,chosenColors);
  assert.equal((await rows(`select count(*) as n from public.user_scoop_colors where user_id='${uid(3)}'`))[0].n,8);
  assert.equal(await sql(`select has_function_privilege('authenticated','public.set_scoop_colors(uuid,jsonb)','execute');`),'f');
  await assert.rejects(() => sql(`set role authenticated; insert into public.user_scoop_colors(user_id,domain_slug,color_hex)
    values ('${uid(6)}','cloud','#FFFFFF');`), /permission denied|row-level security/);
  assert.equal((await spend(6,'berry-palette')).status,'purchased');
  assert.equal((await spend(6,'cocoa-cone')).error,'insufficient_credits');
  assert.equal((await spend(6,'sugar-stars')).error,'insufficient_credits');
  assert.equal((await rpc(`public.get_shop_snapshot('${uid(6)}')`)).spendableBalance,'3');
  await sql(`update public.credit_policy set spending_enabled=false where id=1;`);
  assert.equal((await spend(6,'berry-palette')).status,'already_owned');
  assert.equal((await spend(5,'night-sky')).error,'shop_unavailable');
  await sql(`update public.credit_policy set spending_enabled=true where id=1;
    create function shop_test_fail() returns trigger language plpgsql as $$
      begin if new.user_id='${uid(5)}' then raise exception 'injected unlock failure'; end if; return new; end; $$;
    create trigger shop_test_fail before insert on public.user_unlocks
      for each row execute function shop_test_fail();`);
  await assert.rejects(() => spend(5,'night-sky'), /injected unlock failure/);
  assert.equal((await rows(`select count(*) as n from public.credit_events where user_id='${uid(5)}' and reason='purchase'`))[0].n,0);
  await sql(`drop trigger shop_test_fail on public.user_unlocks; drop function shop_test_fail();`);
  assert.equal((await spend(5,'one-scoop-of-joy')).error,'price_changed');
  assert.equal((await spend(5,'one-scoop-of-joy',2)).shortfall,30);
  await sql(`insert into public.credit_events(user_id,amount,reason,source_id,policy_version)
    values('${uid(5)}',30,'quiz_bonus','music-quiz-fixture',1);`);
  assert.equal((await rpc(`public.get_shop_snapshot('${uid(5)}')`)).spendableBalance,'150');
  assert.equal((await spend(5,'one-scoop-of-joy',2)).status,'purchased');
  assert.equal((await spend(5,'tiptoe-into-sunlight',2)).error,'insufficient_credits');
  assert.equal((await rpc(`public.equip_cosmetic('${uid(5)}','music','one-scoop-of-joy')`)).equipped.music,'one-scoop-of-joy');
  assert.equal((await rpc(`public.equip_cosmetic('${uid(5)}','music',null)`)).equipped.music,undefined);
  assert.equal((await spend(5,'cloud-swirl')).shortfall,130);
  await sql(`insert into public.credit_events(user_id,amount,reason,source_id,policy_version)
    values('${uid(5)}',130,'quiz_bonus','texture-quiz-fixture',1);`);
  assert.equal((await spend(5,'cloud-swirl')).status,'purchased');
  assert.equal((await rpc(`public.equip_cosmetic('${uid(5)}','texture','cloud-swirl')`)).equipped.texture,'cloud-swirl');
  assert.equal((await rpc(`public.equip_cosmetic('${uid(5)}','texture',null)`)).equipped.texture,undefined);
  assert.equal((await rpc(`public.get_shop_snapshot('${uid(5)}')`)).spendableBalance,'0');
  assert.equal((await rpc(`public.get_shop_snapshot('${uid(5)}')`)).balance,'500');
  await assert.rejects(() => sql(`set role authenticated; insert into public.user_unlocks(user_id,item_id,purchase_event_id)
    values('${uid(1)}','berry-palette',1);`), /permission denied|row-level security/);
  console.log('PASS shop duplicate purchase, overspend, equip/reset, sale pause, rollback and privileges');
  await sql(`delete from auth.users where id='${uid(6)}';`);
  assert.equal((await rows(`select count(*) as count from public.credit_events where user_id='${uid(6)}'`))[0].count,0);
  assert.equal((await rows(`select count(*) as count from public.user_unlocks where user_id='${uid(6)}'`))[0].count,0);
  console.log('PASS transactional rollback, onboarding preservation, legacy-write guard and database privileges');
  // Streak reward (크레딧정책.md P4). Dates are relative to the container's current KST day.
  const today = await sql(`select to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD');`);
  const kstDay = offset => new Date(Date.parse(`${today}T00:00:00Z`) - offset * 86_400_000).toISOString().slice(0, 10);
  const at = (offset, time = '12:00') => `((date '${today}' - ${offset})::timestamp + time '${time}') at time zone 'Asia/Seoul'`;
  const seedCompleted = (user, entries) => sql(`set role service_role;
    select set_config('app.credit_writer', 'v1', false);
    insert into public.user_article_progress(user_id,article_id,variant_id,status,quiz_score,completed_at)
      values ${entries.map(([article, offset, time]) => `('${uid(user)}',${article},${article},'completed',1,${at(offset, time)})`).join(',')};`);
  const startArticles = (user, articles) => sql(`insert into public.user_article_progress(user_id,article_id,variant_id,status)
    values ${articles.map(article => `('${uid(user)}',${article},${article},'started')`).join(',')};`);
  const streakEvents = user => rows(`select source_id, amount, policy_version, metadata
    from public.credit_events where user_id='${uid(user)}' and reason='streak' order by source_id`);
  const streakState = async user => (await rpc(`public.get_credit_snapshot('${uid(user)}')`)).streak;
  // Completed articles 10+offset.. on KST days -to..-from (one per day).
  const days = (from, to, offset = 0) => Array.from({ length: to - from + 1 }, (_, i) => [10 + offset + i, to - i]);
  await sql(`
    insert into auth.users(id) values ${Array.from({ length: 6 }, (_, i) => `('${uid(i + 7)}')`).join(',')};
    insert into public.articles(id,domain_id,source,source_url,original_key,foundation_order,
      content_kind,editorial_status,reference_links,status,rights_status,rights_evidence_url,rights_reviewed_at,rights_attribution)
      select n,1,'artice-original',null,'streak-' || n,n,'original','approved',
        '[{"title":"Reference","url":"https://fixture.invalid/reference"}]'::jsonb,
        'ready','permitted','https://fixture.invalid/rights',now(),null
      from generate_series(10,59) n;
    insert into public.article_variants(id,article_id,level,title,content_html,glossary)
      select n,n,1,'Streak fixture','<p>Fixture</p>','{}'::jsonb from generate_series(10,59) n;
    insert into public.quiz_questions(id,variant_id,position,prompt,options,correct_index)
      select v * 10 + p,v,p,p::text,'["a","b","c","d"]'::jsonb,p-1
      from generate_series(10,59) v cross join generate_series(1,4) p;
  `);
  const migrated = (await rows(`select streak_enabled, streak_counts_from, streak_reward, version from public.credit_policy`))[0];
  assert.deepEqual([migrated.streak_enabled, migrated.streak_counts_from, migrated.streak_reward], [false, null, 50]);

  // Disabled: six earlier days plus today is a 7-day run, but nothing is granted.
  await seedCompleted(7, days(1, 6));
  await startArticles(7, [50]);
  const disabled = await grade(7, 50);
  assert.equal(disabled.credits.newlyGranted, 120);
  assert.equal(disabled.credits.streakReward, 0);
  assert.equal((await streakEvents(7)).length, 0);
  assert.deepEqual(await streakState(7), { enabled: false, reward: 50, blockDays: 7, days: 0, lastDay: null });

  // Activation needs a counting start and a policy version bump; the start never moves earlier.
  await assert.rejects(() => sql(`update public.credit_policy set streak_enabled=true, version=version+1 where id=1;`), /credit_policy_streak_start_check/);
  await assert.rejects(() => sql(`update public.credit_policy set streak_enabled=true, streak_counts_from=date '${kstDay(20)}' where id=1;`),
    /streak activation requires a new policy version/);
  await sql(`update public.credit_policy set streak_enabled=true, streak_counts_from=date '${kstDay(20)}', version=version+1 where id=1;`);
  const streakVersion = migrated.version + 1;
  await assert.rejects(() => sql(`update public.credit_policy set streak_counts_from=date '${kstDay(21)}' where id=1;`),
    /streak count start cannot move earlier/);
  await assert.rejects(() => sql(`update public.credit_policy set streak_reward=60 where id=1;`),
    /streak reward change requires a new policy version/);
  assert.equal(await sql(`select has_function_privilege('authenticated','public.grant_credit_streak(uuid,bigint,timestamptz)','execute');`), 'f');
  assert.equal(await sql(`select has_function_privilege('authenticated','public.get_credit_streak(uuid)','execute');`), 'f');
  assert.equal(await sql(`select has_function_privilege('anon','public.credit_streak_runs(uuid,date,date)','execute');`), 'f');

  // Day 7: two completions on one earlier date count once; concurrent first completions
  // and retries on day 7 grant exactly one block.
  await seedCompleted(8, [...days(1, 6), [30, 3, '08:00']]);
  await startArticles(8, [50, 51]);
  const day7 = await Promise.all([...Array.from({ length: 6 }, () => grade(8, 50)),
    ...Array.from({ length: 6 }, () => grade(8, 51))]);
  assert.equal(day7.filter(row => !row.isReview).length, 2);
  assert.equal(day7.reduce((n, row) => n + row.credits.newlyGranted, 0), 20 + 20 + 100 + 50);
  const day7Events = await streakEvents(8);
  assert.deepEqual(day7Events.map(row => [row.source_id, row.amount, row.policy_version, row.metadata.days]),
    [[`streak:${kstDay(6)}:1`, 50, streakVersion, 7]]);
  assert.equal((await rpc(`public.get_credit_result('${uid(8)}', ${day7Events[0].metadata.articleId})`)).streakReward, 50);
  assert.deepEqual(await streakState(8), { enabled: true, reward: 50, blockDays: 7, days: 7, lastDay: today });
  const spendSnapshot = await rpc(`public.get_credit_snapshot('${uid(8)}')`);
  assert.equal(spendSnapshot.balance, '190');
  assert.equal(spendSnapshot.spendableBalance, '140', 'streak credits are not quiz-spendable');
  console.log('PASS streak off by default, activation guard, day-7 grant once under concurrency, same-day dedupe');

  // Day 14 pays block 2 only (no back-pay of an unpaid block 1), once under retries.
  await seedCompleted(9, days(1, 13));
  await startArticles(9, [50]);
  const day14 = await burst(8, () => grade(9, 50));
  assert.equal(day14.filter(row => row.credits.newlyGranted > 0).length, 1);
  assert.deepEqual((await streakEvents(9)).map(row => row.source_id), [`streak:${kstDay(13)}:2`]);
  assert.equal(await rpc(`public.grant_credit_streak('${uid(9)}', 50, now())`), 0);
  assert.equal((await streakEvents(9)).length, 1);

  // Reviews add no date: re-grading an old article today keeps the streak at six days.
  await seedCompleted(10, days(1, 6));
  const review = await grade(10, 10);
  assert.equal(review.isReview, true);
  assert.equal((await streakEvents(10)).length, 0);
  assert.equal((await streakState(10)).days, 6);
  await startArticles(10, [50]);
  assert.equal((await grade(10, 50)).credits.streakReward, 50);

  // A missing day starts a new run: days -8..-7 and -5..today make a 6-day run.
  await seedCompleted(11, [[10, 8], [11, 7], ...days(1, 5, 2)]);
  await startArticles(11, [50]);
  assert.equal((await grade(11, 50)).credits.streakReward, 0);
  assert.equal((await streakEvents(11)).length, 0);
  assert.equal((await streakState(11)).days, 6);

  // KST day boundary: 23:30 and 00:30 KST fall on consecutive KST dates but on one UTC date.
  await seedCompleted(12, [[10, 3, '23:30'], [11, 2, '00:30']]);
  const boundary = await rows(`select run_start::text, run_end::text, run_days
    from public.credit_streak_runs('${uid(12)}', date '${kstDay(20)}', date '${today}')`);
  assert.deepEqual(boundary, [{ run_start: kstDay(3), run_end: kstDay(2), run_days: 2 }]);
  assert.equal(await sql(`select count(distinct (completed_at at time zone 'UTC')::date) from public.user_article_progress where user_id='${uid(12)}';`), '1');

  // Nothing before streak_counts_from: with the start moved to 3 days ago, days -6..today
  // form a 4-day counted run and no reward.
  await sql(`update public.credit_policy set streak_counts_from=date '${kstDay(3)}' where id=1;`);
  await seedCompleted(12, [[20, 6], [21, 5], [22, 4], [23, 1]]);
  await startArticles(12, [50]);
  assert.equal((await grade(12, 50)).credits.streakReward, 0);
  assert.equal((await streakEvents(12)).length, 0);
  assert.equal((await streakState(12)).days, 4);
  await sql(`update public.credit_policy set streak_enabled=false where id=1;`);
  assert.equal((await streakState(8)).enabled, false);
  console.log('PASS streak day-14 block, review exclusion, gap reset, KST boundary and counting start');
} finally {
  await command(['stop', container]).catch(() => {});
}
