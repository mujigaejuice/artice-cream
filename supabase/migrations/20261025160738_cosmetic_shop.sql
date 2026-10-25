-- P3 catalog, ownership, and atomic credit spending. Catalog and spending stay off
-- until the web and native bundles both contain every seeded asset.
begin;

create table public.cosmetic_items (
  id text primary key check (id ~ '^[a-z0-9-]{1,64}$'),
  slot text not null check (slot in ('palette','cone','topping','background')),
  name_ko text not null check (length(trim(name_ko)) between 1 and 80),
  price integer not null check (price > 0),
  asset_key text not null check (asset_key ~ '^[a-z0-9-]{1,64}$'),
  catalog_version integer not null default 1 check (catalog_version > 0),
  is_active boolean not null default false,
  sort_order integer not null default 0
);
create index cosmetic_items_order_idx on public.cosmetic_items (slot, sort_order, id);

create table public.user_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.cosmetic_items(id),
  purchase_event_id bigint not null unique references public.credit_events(id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index user_unlocks_item_idx on public.user_unlocks (item_id);

create table public.user_cosmetics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null check (slot in ('palette','cone','topping','background')),
  item_id text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  foreign key (user_id, item_id) references public.user_unlocks(user_id, item_id) on delete cascade
);
create index user_cosmetics_owned_idx on public.user_cosmetics (user_id, item_id);

alter table public.cosmetic_items enable row level security;
alter table public.user_unlocks enable row level security;
alter table public.user_cosmetics enable row level security;
revoke all on public.cosmetic_items, public.user_unlocks, public.user_cosmetics from public, anon, authenticated;
grant select, insert, update, delete on public.cosmetic_items, public.user_unlocks, public.user_cosmetics to service_role;
grant select on public.user_unlocks, public.user_cosmetics to authenticated;
create policy "own unlocks readable" on public.user_unlocks for select to authenticated
  using (user_id = (select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true');
create policy "own cosmetics readable" on public.user_cosmetics for select to authenticated
  using (user_id = (select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true');

-- The renderer owns these keys. Keep the rows inactive until both bundles ship.
insert into public.cosmetic_items(id,slot,name_ko,price,asset_key,sort_order) values
  ('berry-palette','palette','베리빛 스쿱',130,'berry-palette',10),
  ('cocoa-cone','cone','코코아 콘',140,'cocoa-cone',10),
  ('sugar-stars','topping','설탕 별 토핑',150,'sugar-stars',10),
  ('night-sky','background','밤하늘 배경',120,'night-sky',10);

create function public.get_cosmetic_state(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'ownedItems', coalesce((select jsonb_agg(u.item_id order by u.acquired_at, u.item_id)
      from public.user_unlocks u where u.user_id = p_user_id), '[]'::jsonb),
    'equipped', coalesce((select jsonb_object_agg(c.slot, c.item_id)
      from public.user_cosmetics c where c.user_id = p_user_id), '{}'::jsonb)
  );
$$;

create or replace function public.get_credit_snapshot(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'balance', coalesce((select sum(e.amount) from public.credit_events e
      where e.user_id = p_user_id), 0)::text,
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

create function public.get_shop_snapshot(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'balance', coalesce((select sum(e.amount) from public.credit_events e
      where e.user_id = p_user_id), 0)::text,
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

create function public.spend_credits(p_user_id uuid, p_item_id text, p_catalog_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_policy public.credit_policy%rowtype;
  v_item public.cosmetic_items%rowtype;
  v_balance bigint;
  v_event_id bigint;
begin
  if p_item_id is null or length(p_item_id) > 64 or p_catalog_version is null or p_catalog_version <= 0 then
    return jsonb_build_object('error','invalid_body');
  end if;
  perform id from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error','unauthenticated'); end if;
  select coalesce(sum(amount),0) into v_balance from public.credit_events where user_id = p_user_id;
  if exists (select 1 from public.user_unlocks where user_id = p_user_id and item_id = p_item_id) then
    return jsonb_build_object('status','already_owned','itemId',p_item_id,'balance',v_balance);
  end if;
  select * into v_policy from public.credit_policy where id = 1 for share;
  if not v_policy.spending_enabled then return jsonb_build_object('error','shop_unavailable'); end if;
  select * into v_item from public.cosmetic_items where id = p_item_id for share;
  if not found or not v_item.is_active then return jsonb_build_object('error','not_found'); end if;
  if v_item.catalog_version <> p_catalog_version then
    return jsonb_build_object('error','price_changed','price',v_item.price,
      'catalogVersion',v_item.catalog_version);
  end if;
  if v_balance < v_item.price then
    return jsonb_build_object('error','insufficient_credits','balance',v_balance,
      'shortfall',v_item.price-v_balance);
  end if;
  insert into public.credit_events(user_id,amount,reason,source_id,policy_version,metadata)
    values(p_user_id,-v_item.price,'purchase','item:' || v_item.id,v_policy.version,
      jsonb_build_object('itemId',v_item.id,'price',v_item.price,
        'catalogVersion',v_item.catalog_version)) returning id into v_event_id;
  insert into public.user_unlocks(user_id,item_id,purchase_event_id)
    values(p_user_id,v_item.id,v_event_id);
  return jsonb_build_object('status','purchased','itemId',v_item.id,
    'balance',v_balance-v_item.price);
end;
$$;

create function public.equip_cosmetic(p_user_id uuid, p_slot text, p_item_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_item_slot text;
begin
  if p_slot is null or p_slot not in ('palette','cone','topping','background') then
    return jsonb_build_object('error','invalid_body');
  end if;
  perform id from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error','unauthenticated'); end if;
  if p_item_id is null then
    delete from public.user_cosmetics where user_id = p_user_id and slot = p_slot;
  else
    select i.slot into v_item_slot from public.user_unlocks u
      join public.cosmetic_items i on i.id = u.item_id
      where u.user_id = p_user_id and u.item_id = p_item_id;
    if not found then return jsonb_build_object('error','item_not_owned'); end if;
    if v_item_slot <> p_slot then return jsonb_build_object('error','wrong_slot'); end if;
    insert into public.user_cosmetics(user_id,slot,item_id)
      values(p_user_id,p_slot,p_item_id)
      on conflict (user_id,slot) do update set item_id = excluded.item_id,
        updated_at = clock_timestamp();
  end if;
  return jsonb_build_object('status','equipped',
    'equipped',public.get_cosmetic_state(p_user_id)->'equipped');
end;
$$;

revoke all on function public.get_cosmetic_state(uuid), public.get_shop_snapshot(uuid),
  public.spend_credits(uuid,text,integer), public.equip_cosmetic(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.get_cosmetic_state(uuid), public.get_shop_snapshot(uuid),
  public.spend_credits(uuid,text,integer), public.equip_cosmetic(uuid,text,text)
  to service_role;

notify pgrst, 'reload schema';
commit;
