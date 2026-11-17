-- Re-onboarding retake: a domain the user already has can be quizzed again from
-- "온보딩 다시 하기". Such a selection carries {"retake": true} next to {"level": 1..3}
-- and overwrites the level, restarting the recent-score window so old scores do not
-- immediately move the new starting level. quizzes_taken (reading history) is kept.
-- Selections without retake still never overwrite an existing level.
-- The result gains "retaken" (rows overwritten) so the API can tell this version apart.
begin;

create or replace function public.save_onboarding_preferences(p_user_id uuid, p_selections jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_item jsonb;
  v_domain_id integer;
  v_level integer;
  v_seen integer[] := '{}'::integer[];
  v_added integer := 0;
  v_retaken integer := 0;
begin
  if jsonb_typeof(p_selections) <> 'array' or jsonb_array_length(p_selections) > 32 then
    return jsonb_build_object('error', 'invalid body');
  end if;
  perform id from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error', 'unauthenticated'); end if;
  perform id from public.credit_policy where id = 1 for share;
  for v_item in select value from jsonb_array_elements(p_selections) as value loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'domainId', '') !~ '^[0-9]{1,8}$'
       or (v_item ? 'level') = (v_item ? 'rareChecked')
       or (v_item ? 'level' and (jsonb_typeof(v_item->'level') <> 'number'
            or coalesce(v_item->>'level', '') !~ '^[123]$'))
       or (v_item ? 'rareChecked' and (jsonb_typeof(v_item->'rareChecked') <> 'number'
            or coalesce(v_item->>'rareChecked', '') !~ '^[0-4]$'))
       or (v_item ? 'retake' and (v_item->'retake' <> 'true'::jsonb or not v_item ? 'level')) then
      return jsonb_build_object('error', 'invalid body');
    end if;
    v_domain_id := (v_item->>'domainId')::integer;
    if v_domain_id = any(v_seen)
       or not exists (select 1 from public.domains where id = v_domain_id and active) then
      return jsonb_build_object('error', 'invalid body');
    end if;
    v_seen := v_seen || v_domain_id;
  end loop;
  perform set_config('app.credit_writer', 'v1', true);
  for v_item in select value from jsonb_array_elements(p_selections) as value loop
    v_domain_id := (v_item->>'domainId')::integer;
    v_level := case
      when v_item ? 'level' then (v_item->>'level')::integer
      when (v_item->>'rareChecked')::integer >= 3 then 3
      when (v_item->>'rareChecked')::integer >= 1 then 2
      else 1 end;
    insert into public.user_domain_levels (user_id, domain_id, level)
      values (p_user_id, v_domain_id, v_level)
      on conflict (user_id, domain_id) do nothing;
    if found then
      v_added := v_added + 1;
    elsif v_item ? 'retake' then
      update public.user_domain_levels
        set level = v_level, recent_scores = '{}', rolling_accuracy = 0, updated_at = now()
        where user_id = p_user_id and domain_id = v_domain_id;
      v_retaken := v_retaken + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'added', v_added, 'retaken', v_retaken);
end;
$$;

commit;
