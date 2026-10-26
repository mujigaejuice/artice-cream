-- Additional scenes, toppings, textures, and one purchased palette with eight saved colors.
-- New items are seeded inactive; activate only after the web bundle is live.
begin;

alter table public.cosmetic_items drop constraint cosmetic_items_slot_check;
alter table public.cosmetic_items add constraint cosmetic_items_slot_check
  check (slot in ('palette','cone','topping','background','texture','music'));
alter table public.user_cosmetics drop constraint user_cosmetics_slot_check;
alter table public.user_cosmetics add constraint user_cosmetics_slot_check
  check (slot in ('palette','cone','topping','background','texture','music'));

insert into public.cosmetic_items(id,slot,name_ko,price,asset_key,sort_order) values
  ('pink-parlor','background','분홍 아이스크림 가게',120,'pink-parlor',20),
  ('turkish-stand','background','터키 아이스크림 가판대',120,'turkish-stand',30),
  ('evening-street','background','노을빛 길거리',120,'evening-street',40),
  ('rainbow-sprinkles','topping','무지개 스프링클',150,'rainbow-sprinkles',20),
  ('chocolate-drizzle','topping','초코 드리즐',150,'chocolate-drizzle',30),
  ('cheese-cubes','topping','치즈 큐브',150,'cheese-cubes',40),
  ('fresh-strawberry','topping','생딸기 토핑',150,'fresh-strawberry',50),
  ('cloud-swirl','texture','구름 실결 질감',130,'cloud-swirl',10),
  ('gelato-folds','texture','젤라또 결 질감',130,'gelato-folds',20);

create table public.user_scoop_colors (
  user_id uuid not null references public.profiles(id) on delete cascade,
  domain_slug text not null check (domain_slug in ('cloud','infra','data','cs-fundamentals',
    'deep-learning','llm','ai-security','security')),
  color_hex text not null check (color_hex ~ '^#[0-9A-F]{6}$'),
  updated_at timestamptz not null default now(),
  primary key (user_id, domain_slug)
);
alter table public.user_scoop_colors enable row level security;
revoke all on public.user_scoop_colors from public, anon, authenticated;
grant select, insert, update, delete on public.user_scoop_colors to service_role;
grant select on public.user_scoop_colors to authenticated;
create policy "own scoop colors readable" on public.user_scoop_colors for select to authenticated
  using (user_id = (select auth.uid()) and
    coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true');

create or replace function public.get_cosmetic_state(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'ownedItems', coalesce((select jsonb_agg(u.item_id order by u.acquired_at, u.item_id)
      from public.user_unlocks u where u.user_id = p_user_id), '[]'::jsonb),
    'equipped', coalesce((select jsonb_object_agg(c.slot, c.item_id)
      from public.user_cosmetics c where c.user_id = p_user_id), '{}'::jsonb),
    'scoopColors', coalesce((select jsonb_object_agg(c.domain_slug, c.color_hex)
      from public.user_scoop_colors c where c.user_id = p_user_id), '{}'::jsonb)
  );
$$;

create or replace function public.equip_cosmetic(p_user_id uuid, p_slot text, p_item_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_item_slot text;
begin
  if p_slot is null or p_slot not in ('palette','cone','topping','background','texture','music') then
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

create function public.set_scoop_colors(p_user_id uuid, p_colors jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_entry record;
begin
  if p_colors is null or jsonb_typeof(p_colors) <> 'object' then
    return jsonb_build_object('error','invalid_body');
  end if;
  for v_entry in select key, value from jsonb_each(p_colors) loop
    if v_entry.key not in ('cloud','infra','data','cs-fundamentals','deep-learning',
        'llm','ai-security','security') or jsonb_typeof(v_entry.value) <> 'string'
        or (v_entry.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then
      return jsonb_build_object('error','invalid_body');
    end if;
  end loop;

  perform id from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error','unauthenticated'); end if;
  if not exists (select 1 from public.user_unlocks
    where user_id = p_user_id and item_id = 'berry-palette') then
    return jsonb_build_object('error','item_not_owned');
  end if;

  delete from public.user_scoop_colors where user_id = p_user_id;
  insert into public.user_scoop_colors(user_id,domain_slug,color_hex)
    select p_user_id, key, upper(value #>> '{}') from jsonb_each(p_colors);
  insert into public.user_cosmetics(user_id,slot,item_id)
    values(p_user_id,'palette','berry-palette')
    on conflict (user_id,slot) do update set item_id = excluded.item_id,
      updated_at = clock_timestamp();
  return jsonb_build_object('status','saved') || public.get_cosmetic_state(p_user_id);
end;
$$;
revoke all on function public.set_scoop_colors(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.set_scoop_colors(uuid,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
