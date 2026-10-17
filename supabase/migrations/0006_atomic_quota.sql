-- Deploy before the API code. All quota mutations share a per-user row lock.
begin;

create index ad_views_verified_user_created_idx
  on public.ad_views (user_id, created_at) where reward_verified = true;

-- One snapshot for the remaining balance and the total granted on a KST day.
create function public.quota_state(p_user_id uuid, p_date date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with balance as (
    select coalesce(q.free_used, false) as free_used, coalesce(q.ad_unlocks, 0) as ad_unlocks
    from (select 1) as seed
    left join public.daily_quota q on q.user_id = p_user_id and q.quota_date = p_date
  ), grants as (
    select count(*)::int as granted from public.ad_views
    where user_id = p_user_id and reward_verified = true
      and created_at >= (p_date::timestamp at time zone 'Asia/Seoul')
      and created_at < ((p_date + 1)::timestamp at time zone 'Asia/Seoul')
  )
  select jsonb_build_object(
    'date', p_date, 'freeUsed', free_used, 'adUnlocks', ad_unlocks,
    'remaining', (case when free_used then 0 else 1 end) + ad_unlocks,
    'canRead', not free_used or ad_unlocks > 0,
    'adUnlocksGrantedToday', granted, 'canUnlockWithAd', granted < 3
  ) from balance cross join grants;
$$;

create function public.get_daily_quota(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.quota_state(p_user_id, (statement_timestamp() at time zone 'Asia/Seoul')::date);
$$;

create function public.open_article_with_quota(p_user_id uuid, p_article_id bigint, p_variant_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_date date;
  v_quota jsonb;
begin
  -- Serializes opens AND rewards, including requests straddling midnight.
  -- Other users remain independent. A missing/deleted account cannot get a grant.
  perform id from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile not found' using errcode = '23503'; end if;
  v_date := (clock_timestamp() at time zone 'Asia/Seoul')::date;

  if not exists (select 1 from public.article_variants where id = p_variant_id and article_id = p_article_id) then
    raise exception 'variant does not belong to article' using errcode = '22023';
  end if;

  if exists (select 1 from public.user_article_progress where user_id = p_user_id and article_id = p_article_id) then
    return jsonb_build_object('opened', true);
  end if;

  v_quota := public.quota_state(p_user_id, v_date);
  if not (v_quota->>'canRead')::boolean then
    return jsonb_build_object('opened', false, 'quota', v_quota);
  end if;

  insert into public.daily_quota(user_id, quota_date, free_used, ad_unlocks)
    values (p_user_id, v_date, false, 0) on conflict (user_id, quota_date) do nothing;

  update public.daily_quota set
    ad_unlocks = coalesce(ad_unlocks, 0) - case when free_used then 1 else 0 end,
    free_used = true
    where user_id = p_user_id and quota_date = v_date;

  -- Failure rolls back the debit as well; no uncharged progress is ever visible.
  insert into public.user_article_progress(user_id, article_id, variant_id, status)
    values (p_user_id, p_article_id, p_variant_id, 'started');
  return jsonb_build_object('opened', true);
end;
$$;

create function public.grant_ad_unlock(p_user_id uuid, p_nonce text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz;
  v_date date;
  v_quota jsonb;
  v_view public.ad_views%rowtype;
  v_inserted bigint;
begin
  if p_nonce is null or length(p_nonce) = 0 or length(p_nonce) > 512 then
    raise exception 'invalid nonce' using errcode = '22023';
  end if;
  perform id from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile not found' using errcode = '23503'; end if;
  v_now := clock_timestamp();
  v_date := (v_now at time zone 'Asia/Seoul')::date;
  v_quota := public.quota_state(p_user_id, v_date);

  select * into v_view from public.ad_views where nonce = p_nonce;
  if found then
    -- A retry after a lost HTTP response succeeds without awarding twice.
    -- Legacy incomplete rows are never granted again: their payout is unknown.
    if v_view.user_id = p_user_id and v_view.reward_verified then
      return jsonb_build_object('status', 'replayed', 'quota', v_quota);
    end if;
    return jsonb_build_object('status', 'conflict');
  end if;

  if not (v_quota->>'canUnlockWithAd')::boolean then
    return jsonb_build_object('status', 'limit');
  end if;

  insert into public.ad_views(user_id, nonce, reward_verified, created_at)
    values (p_user_id, p_nonce, true, v_now)
    on conflict (nonce) do nothing returning id into v_inserted;
  if v_inserted is null then return jsonb_build_object('status', 'conflict'); end if;

  insert into public.daily_quota(user_id, quota_date, free_used, ad_unlocks)
    values (p_user_id, v_date, false, 1)
    on conflict (user_id, quota_date) do update
      set ad_unlocks = coalesce(public.daily_quota.ad_unlocks, 0) + 1;

  -- The verified ledger entry and balance become visible together at commit.
  return jsonb_build_object('status', 'granted', 'quota', public.quota_state(p_user_id, v_date));
end;
$$;

-- RPCs trust only the authenticated user ID supplied by our server.
revoke all on function public.quota_state(uuid, date), public.get_daily_quota(uuid),
  public.open_article_with_quota(uuid, bigint, bigint), public.grant_ad_unlock(uuid, text)
  from public, anon, authenticated;
grant execute on function public.quota_state(uuid, date), public.get_daily_quota(uuid),
  public.open_article_with_quota(uuid, bigint, bigint), public.grant_ad_unlock(uuid, text)
  to service_role;

notify pgrst, 'reload schema';
commit;
