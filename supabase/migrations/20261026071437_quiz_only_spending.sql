-- Only first quiz-completion earnings fund cosmetic purchases. Administrative
-- adjustments can change the displayed ledger balance but cannot create
-- purchasing power. Existing purchases reduce both balances.
begin;

create function public.get_quiz_spendable_balance(p_user_id uuid)
returns bigint language sql stable security invoker set search_path = '' as $$
  select greatest(0, least(
    coalesce(sum(e.amount), 0),
    coalesce(sum(case when e.reason in ('article_read','quiz_bonus','welcome','purchase')
      then e.amount else 0 end), 0)
  ))::bigint
  from public.credit_events e where e.user_id = p_user_id;
$$;
revoke all on function public.get_quiz_spendable_balance(uuid) from public, anon, authenticated;
grant execute on function public.get_quiz_spendable_balance(uuid) to service_role;

create or replace function public.get_credit_snapshot(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'balance', coalesce((select sum(e.amount) from public.credit_events e
      where e.user_id = p_user_id), 0)::text,
    'spendableBalance', public.get_quiz_spendable_balance(p_user_id)::text,
    'policyVersion', p.version,
    'earningMode', p.earning_mode,
    'spendingEnabled', p.spending_enabled,
    'hasWelcome', exists (select 1 from public.credit_events e
      where e.user_id = p_user_id and e.reason = 'welcome' and e.source_id = 'account'),
    'rules', jsonb_build_object('article', p.article_reward,
      'quizBonusMax', p.quiz_bonus_max, 'welcome', p.welcome_reward)
  ) || public.get_cosmetic_state(p_user_id)
  from public.credit_policy p
  where p.id = 1 and exists (select 1 from public.profiles where id = p_user_id);
$$;

create or replace function public.get_shop_snapshot(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'balance', coalesce((select sum(e.amount) from public.credit_events e
      where e.user_id = p_user_id), 0)::text,
    'spendableBalance', public.get_quiz_spendable_balance(p_user_id)::text,
    'spendingEnabled', p.spending_enabled,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'slot', i.slot, 'nameKo', i.name_ko,
      'price', i.price, 'assetKey', i.asset_key,
      'catalogVersion', i.catalog_version, 'isActive', i.is_active,
      'owned', u.item_id is not null) order by i.slot, i.sort_order, i.id)
      from public.cosmetic_items i
      left join public.user_unlocks u on u.user_id = p_user_id and u.item_id = i.id), '[]'::jsonb)
  ) || public.get_cosmetic_state(p_user_id)
  from public.credit_policy p
  where p.id = 1 and exists (select 1 from public.profiles where id = p_user_id);
$$;

create or replace function public.spend_credits(p_user_id uuid, p_item_id text, p_catalog_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_policy public.credit_policy%rowtype;
  v_item public.cosmetic_items%rowtype;
  v_balance bigint;
  v_spendable bigint;
  v_event_id bigint;
begin
  if p_item_id is null or length(p_item_id) > 64 or p_catalog_version is null or p_catalog_version <= 0 then
    return jsonb_build_object('error','invalid_body');
  end if;
  perform id from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error','unauthenticated'); end if;
  select coalesce(sum(amount),0) into v_balance from public.credit_events where user_id = p_user_id;
  v_spendable := public.get_quiz_spendable_balance(p_user_id);
  if exists (select 1 from public.user_unlocks where user_id = p_user_id and item_id = p_item_id) then
    return jsonb_build_object('status','already_owned','itemId',p_item_id,
      'balance',v_balance,'spendableBalance',v_spendable);
  end if;
  select * into v_policy from public.credit_policy where id = 1 for share;
  if not v_policy.spending_enabled then return jsonb_build_object('error','shop_unavailable'); end if;
  select * into v_item from public.cosmetic_items where id = p_item_id for share;
  if not found or not v_item.is_active then return jsonb_build_object('error','not_found'); end if;
  if v_item.catalog_version <> p_catalog_version then
    return jsonb_build_object('error','price_changed','price',v_item.price,
      'catalogVersion',v_item.catalog_version);
  end if;
  if v_spendable < v_item.price then
    return jsonb_build_object('error','insufficient_credits','balance',v_balance,
      'spendableBalance',v_spendable,'shortfall',v_item.price-v_spendable);
  end if;
  insert into public.credit_events(user_id,amount,reason,source_id,policy_version,metadata)
    values(p_user_id,-v_item.price,'purchase','item:' || v_item.id,v_policy.version,
      jsonb_build_object('itemId',v_item.id,'price',v_item.price,
        'catalogVersion',v_item.catalog_version)) returning id into v_event_id;
  insert into public.user_unlocks(user_id,item_id,purchase_event_id)
    values(p_user_id,v_item.id,v_event_id);
  return jsonb_build_object('status','purchased','itemId',v_item.id,
    'balance',v_balance-v_item.price,'spendableBalance',v_spendable-v_item.price);
end;
$$;

notify pgrst, 'reload schema';
commit;
