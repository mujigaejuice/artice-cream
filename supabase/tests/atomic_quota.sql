-- Live DB smoke check. All fixtures are private to this transaction and rolled back.
-- Apply 0006_atomic_quota.sql first. Requires at least five existing articles with variants.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

create temp table quota_check_fixture (
  user_id uuid, article_ids bigint[], variant_ids bigint[], nonce text
) on commit drop;
grant select on quota_check_fixture to service_role;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_articles bigint[];
  v_variants bigint[];
  v_function text;
begin
  foreach v_function in array array[
    'public.quota_state(uuid,date)', 'public.get_daily_quota(uuid)',
    'public.open_article_with_quota(uuid,bigint,bigint)', 'public.grant_ad_unlock(uuid,text)'
  ] loop
    if has_function_privilege('anon', v_function, 'execute') or
      has_function_privilege('authenticated', v_function, 'execute') or
      not has_function_privilege('service_role', v_function, 'execute') then
      raise exception 'unexpected RPC privileges: %', v_function;
    end if;
  end loop;

  select array_agg(article_id order by article_id), array_agg(id order by article_id)
    into v_articles, v_variants from (
      select distinct on (article_id) id, article_id
      from public.article_variants where article_id is not null order by article_id, id limit 5
    ) variants;
  if coalesce(cardinality(v_articles), 0) < 5 then raise exception 'five existing articles required'; end if;

  insert into auth.users(id, email, raw_app_meta_data)
    values (v_user, 'quota-check-' || v_user::text || '@example.com', '{"quota_test":true}');
  insert into quota_check_fixture values (v_user, v_articles, v_variants, 'quota-check-' || v_user::text);
end;
$$;

set local role service_role;
do $$
declare
  f record;
  q jsonb;
  r jsonb;
  i int;
begin
  select * into strict f from pg_temp.quota_check_fixture;
  q := public.get_daily_quota(f.user_id);
  if (q->>'remaining')::int <> 1 or
    q->>'date' <> ((statement_timestamp() at time zone 'Asia/Seoul')::date)::text then
    raise exception 'invalid initial KST quota: %', q;
  end if;

  for i in 1..2 loop
    r := public.open_article_with_quota(f.user_id, f.article_ids[1], f.variant_ids[1]);
    if r->>'opened' <> 'true' then raise exception 'initial/repeated read failed'; end if;
  end loop;
  q := public.get_daily_quota(f.user_id);
  if (q->>'remaining')::int <> 0 then raise exception 'first read must debit exactly once'; end if;
  r := public.open_article_with_quota(f.user_id, f.article_ids[2], f.variant_ids[2]);
  if r->>'opened' <> 'false' then raise exception 'exhausted free allowance was bypassed'; end if;

  for i in 1..3 loop
    r := public.grant_ad_unlock(f.user_id, f.nonce || '-' || i);
    if r->>'status' <> 'granted' then raise exception 'reward grant failed: %', r; end if;
    r := public.grant_ad_unlock(f.user_id, f.nonce || '-' || i);
    if r->>'status' <> 'replayed' then raise exception 'idempotent reward replay failed'; end if;
  end loop;
  r := public.grant_ad_unlock(f.user_id, f.nonce || '-over-limit');
  if r->>'status' <> 'limit' then raise exception 'daily reward cap was bypassed'; end if;
  q := public.get_daily_quota(f.user_id);
  if (q->>'adUnlocks')::int <> 3 or (q->>'adUnlocksGrantedToday')::int <> 3 or
    q->>'canUnlockWithAd' <> 'false' then raise exception 'reward balance mismatch: %', q; end if;

  for i in 2..4 loop
    r := public.open_article_with_quota(f.user_id, f.article_ids[i], f.variant_ids[i]);
    if r->>'opened' <> 'true' then raise exception 'rewarded read failed'; end if;
  end loop;
  r := public.open_article_with_quota(f.user_id, f.article_ids[5], f.variant_ids[5]);
  if r->>'opened' <> 'false' then raise exception 'exhausted rewarded allowance was bypassed'; end if;
  q := public.get_daily_quota(f.user_id);
  if (q->>'remaining')::int <> 0 or q->>'canUnlockWithAd' <> 'false' or
    (select count(*) from public.user_article_progress where user_id = f.user_id) <> 4 or
    (select count(*) from public.ad_views where user_id = f.user_id and reward_verified) <> 3 then
    raise exception 'final quota/progress/ledger mismatch';
  end if;
end;
$$;
reset role;
rollback;

select jsonb_build_object(
  'result', 'atomic quota smoke checks passed; all fixtures rolled back',
  'profiles', (select count(*) from public.profiles),
  'progress', (select count(*) from public.user_article_progress),
  'daily_quota', (select count(*) from public.daily_quota),
  'ad_views', (select count(*) from public.ad_views)
) as verification;
