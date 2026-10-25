-- Credit earning and atomic grading. Apply before the API deployment, with
-- earning inactive and the legacy-write guard off.
begin;

create table public.credit_policy (
  id smallint primary key default 1 check (id = 1),
  version integer not null default 1 check (version > 0),
  starts_at timestamptz,
  earning_mode text not null default 'inactive'
    check (earning_mode in ('inactive', 'active', 'paused')),
  spending_enabled boolean not null default false,
  write_contract_required boolean not null default false,
  article_reward integer not null default 10 check (article_reward > 0),
  quiz_bonus_max integer not null default 10 check (quiz_bonus_max >= 0),
  welcome_reward integer not null default 100 check (welcome_reward > 0),
  updated_at timestamptz not null default now(),
  check ((earning_mode = 'inactive' and starts_at is null)
    or (earning_mode in ('active', 'paused') and starts_at is not null and write_contract_required))
);
insert into public.credit_policy (id) values (1);

create table public.credit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null check (reason in ('article_read', 'quiz_bonus', 'welcome', 'purchase', 'adjustment')),
  source_id text not null check (length(source_id) between 1 and 256),
  policy_version integer not null check (policy_version > 0),
  related_event_id bigint references public.credit_events(id),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, reason, source_id),
  check ((reason in ('article_read', 'welcome') and amount > 0)
    or (reason = 'quiz_bonus' and amount >= 0)
    or (reason = 'purchase' and amount < 0)
    or (reason = 'adjustment' and amount <> 0))
);
create index credit_events_user_created_idx on public.credit_events (user_id, created_at desc, id desc);
create index credit_events_related_idx on public.credit_events (related_event_id)
  where related_event_id is not null;

alter table public.credit_policy enable row level security;
alter table public.credit_events enable row level security;
revoke all on public.credit_policy, public.credit_events from public, anon, authenticated;
revoke all on sequence public.credit_events_id_seq from public, anon, authenticated;
grant select, insert, update, delete on public.credit_policy, public.credit_events to service_role;
grant usage, select on sequence public.credit_events_id_seq to service_role;
grant select on public.credit_events to authenticated;
create policy "own credits readable" on public.credit_events for select to authenticated
  using (user_id = (select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true');

create function public.guard_credit_policy_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.starts_at is not null and new.starts_at is distinct from old.starts_at then
    raise exception 'credit start is immutable' using errcode = '22023';
  end if;
  if old.write_contract_required and not new.write_contract_required then
    raise exception 'credit write guard is immutable' using errcode = '22023';
  end if;
  if old.earning_mode <> 'inactive' and new.earning_mode = 'inactive' then
    raise exception 'credit earning cannot return to inactive' using errcode = '22023';
  end if;
  if new.version < old.version then
    raise exception 'credit policy version cannot decrease' using errcode = '22023';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger guard_credit_policy_update before update on public.credit_policy
  for each row execute function public.guard_credit_policy_update();

-- After activation this rejects the old multi-request grading path. Reader
-- opens may still insert a started row; all other writes need a new RPC.
create function public.guard_credit_record_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- FK cascade after profile deletion must be able to erase account data.
  if tg_op = 'DELETE' and not exists (
    select 1 from public.profiles where id = old.user_id
  ) then
    return old;
  end if;
  if (select write_contract_required from public.credit_policy where id = 1)
    and (current_user <> 'service_role'
      or current_setting('app.credit_writer', true) is distinct from 'v1') then
    if tg_table_name = 'user_domain_levels' or tg_op <> 'INSERT' then
      raise exception 'credit write contract required' using errcode = '55000';
    elsif new.status <> 'started' then
      raise exception 'credit write contract required' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_credit_progress_write before insert or update or delete on public.user_article_progress
  for each row execute function public.guard_credit_record_write();
create trigger guard_credit_level_write before insert or update or delete on public.user_domain_levels
  for each row execute function public.guard_credit_record_write();

create function public.get_credit_result(p_user_id uuid, p_article_id bigint)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_balance bigint;
  v_base integer := 0;
  v_bonus integer := 0;
  v_welcome integer := 0;
  v_version integer;
  v_exists boolean;
begin
  select coalesce(sum(amount), 0) into v_balance from public.credit_events where user_id = p_user_id;
  select amount, policy_version into v_base, v_version from public.credit_events
    where user_id = p_user_id and reason = 'article_read' and source_id = 'article:' || p_article_id::text;
  v_exists := found;
  select coalesce(amount, 0) into v_bonus from public.credit_events
    where user_id = p_user_id and reason = 'quiz_bonus' and source_id = 'article:' || p_article_id::text;
  select coalesce(amount, 0) into v_welcome from public.credit_events
    where user_id = p_user_id and reason = 'welcome' and source_id = 'account'
      and metadata->>'articleId' = p_article_id::text;
  if v_version is null then select version into v_version from public.credit_policy where id = 1; end if;
  return jsonb_build_object(
    'status', case when v_exists then 'already_granted' else 'not_eligible' end,
    'newlyGranted', 0, 'articleReward', jsonb_build_object(
      'base', coalesce(v_base, 0), 'bonus', coalesce(v_bonus, 0),
      'total', coalesce(v_base, 0) + coalesce(v_bonus, 0)),
    'welcomeReward', coalesce(v_welcome, 0), 'balance', v_balance,
    'policyVersion', v_version
  );
end;
$$;

create function public.grade_quiz_with_credits(p_user_id uuid, p_variant_id bigint, p_answers jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_policy public.credit_policy%rowtype;
  v_variant public.article_variants%rowtype;
  v_article public.articles%rowtype;
  v_progress public.user_article_progress%rowtype;
  v_level public.user_domain_levels%rowtype;
  v_question public.quiz_questions%rowtype;
  v_domain public.domains%rowtype;
  v_now timestamptz;
  v_review jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_correct integer := 0;
  v_keys integer;
  v_answer_text text;
  v_answer integer;
  v_score real;
  v_scores real[];
  v_rolling real;
  v_prev integer;
  v_next integer;
  v_dir text := '유지';
  v_is_review boolean;
  v_bonus integer;
  v_welcome integer := 0;
  v_newly integer := 0;
  v_credits jsonb;
begin
  if p_variant_id is null or p_variant_id <= 0 or jsonb_typeof(p_answers) <> 'object' then
    return jsonb_build_object('error', 'invalid body');
  end if;
  perform id from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error', 'unauthenticated'); end if;
  select * into strict v_policy from public.credit_policy where id = 1 for share;

  select * into v_variant from public.article_variants where id = p_variant_id for share;
  if not found then return jsonb_build_object('error', 'not found'); end if;
  select * into v_article from public.articles where id = v_variant.article_id for share;
  if not found then return jsonb_build_object('error', 'not found'); end if;
  perform source from public.content_source_rights where source = v_article.source for share;
  if not public.content_article_allows(v_article.id, 'publish') then
    return jsonb_build_object('error', 'not found');
  end if;
  select * into v_domain from public.domains where id = v_article.domain_id;
  if not found then return jsonb_build_object('error', 'not found'); end if;

  for v_question in select * from public.quiz_questions where variant_id = p_variant_id order by id for share loop
    v_total := v_total + 1;
    v_answer_text := p_answers->>v_question.id::text;
    if v_answer_text is null or v_answer_text !~ '^[0-9]{1,2}$'
       or jsonb_typeof(p_answers->v_question.id::text) <> 'number' then
      return jsonb_build_object('error', 'incomplete');
    end if;
    v_answer := v_answer_text::integer;
    if v_answer >= jsonb_array_length(v_question.options) then
      return jsonb_build_object('error', 'incomplete');
    end if;
    if v_answer = v_question.correct_index then v_correct := v_correct + 1; end if;
    v_review := v_review || jsonb_build_array(jsonb_build_object(
      'questionId', v_question.id, 'prompt', v_question.prompt,
      'options', v_question.options, 'picked', v_answer,
      'correct_index', v_question.correct_index,
      'correct', v_answer = v_question.correct_index,
      'explanation', v_question.explanation));
  end loop;
  if v_total = 0 then return jsonb_build_object('error', 'no questions'); end if;
  select count(*) into v_keys from jsonb_object_keys(p_answers);
  if v_keys <> v_total then return jsonb_build_object('error', 'invalid body'); end if;
  v_score := v_correct::real / v_total::real;

  select * into v_progress from public.user_article_progress
    where user_id = p_user_id and article_id = v_article.id for update;
  if not found then return jsonb_build_object('error', 'article not opened'); end if;
  v_is_review := v_progress.status in ('completed', 'saved');
  if v_progress.status not in ('started', 'completed', 'saved') then
    return jsonb_build_object('error', 'invalid progress');
  end if;

  if not v_is_review then
    if v_policy.earning_mode = 'paused' then
      return jsonb_build_object('error', 'credits temporarily unavailable');
    end if;
    v_now := clock_timestamp();
    perform set_config('app.credit_writer', 'v1', true);
    if v_article.content_kind <> 'original' then
      select * into v_level from public.user_domain_levels
        where user_id = p_user_id and domain_id = v_article.domain_id for update;
      if found then
        v_prev := greatest(1, least(3, v_level.level));
        v_scores := coalesce(v_level.recent_scores, '{}'::real[]);
      else
        v_prev := greatest(1, least(3, v_variant.level));
        v_scores := '{}'::real[];
      end if;
      v_scores := v_scores || v_score;
      if cardinality(v_scores) > 3 then
        v_scores := v_scores[cardinality(v_scores)-2:cardinality(v_scores)];
      end if;
      select avg(value)::real into v_rolling from unnest(v_scores) as value;
      v_next := v_prev;
      if v_rolling >= 0.75 and v_prev < 3 then
        v_next := v_prev + 1;
        v_dir := '상승';
      elsif v_rolling <= 0.4 and v_prev > 1 then
        v_next := v_prev - 1;
        v_dir := '하강';
      end if;
      insert into public.user_domain_levels
        (user_id, domain_id, level, rolling_accuracy, quizzes_taken, recent_scores, updated_at)
        values (p_user_id, v_article.domain_id, v_next, v_rolling,
          coalesce(v_level.quizzes_taken, 0) + 1, v_scores, v_now)
        on conflict (user_id, domain_id) do update set
          level = excluded.level, rolling_accuracy = excluded.rolling_accuracy,
          quizzes_taken = excluded.quizzes_taken, recent_scores = excluded.recent_scores,
          updated_at = excluded.updated_at;
    end if;
    update public.user_article_progress set status = 'completed', variant_id = p_variant_id,
      quiz_score = v_score, quiz_answers = p_answers, completed_at = v_now
      where id = v_progress.id and status = 'started';
    if not found then raise exception 'progress changed during grading' using errcode = '40001'; end if;

    if v_policy.earning_mode = 'active' and v_now >= v_policy.starts_at then
      v_bonus := round(v_correct::numeric * v_policy.quiz_bonus_max / v_total)::integer;
      insert into public.credit_events (user_id, amount, reason, source_id, policy_version, metadata)
        values (p_user_id, v_policy.article_reward, 'article_read',
          'article:' || v_article.id, v_policy.version,
          jsonb_build_object('articleId', v_article.id, 'variantId', p_variant_id,
            'correct', v_correct, 'total', v_total));
      insert into public.credit_events (user_id, amount, reason, source_id, policy_version, metadata)
        values (p_user_id, v_bonus, 'quiz_bonus', 'article:' || v_article.id, v_policy.version,
          jsonb_build_object('articleId', v_article.id, 'variantId', p_variant_id,
            'correct', v_correct, 'total', v_total));
      if not exists (select 1 from public.credit_events
        where user_id = p_user_id and reason = 'welcome' and source_id = 'account') then
        v_welcome := v_policy.welcome_reward;
        insert into public.credit_events (user_id, amount, reason, source_id, policy_version, metadata)
          values (p_user_id, v_welcome, 'welcome', 'account', v_policy.version,
            jsonb_build_object('articleId', v_article.id));
      end if;
      v_newly := v_policy.article_reward + v_bonus + v_welcome;
    end if;
  end if;

  v_credits := public.get_credit_result(p_user_id, v_article.id);
  if not v_is_review then
    v_credits := v_credits || jsonb_build_object(
      'status', case when v_newly > 0 then 'granted' else 'disabled' end,
      'newlyGranted', v_newly);
  end if;
  return jsonb_build_object(
    'score', v_score, 'correct', v_correct, 'total', v_total, 'review', v_review,
    'prevLevel', case when v_is_review then null else v_prev end,
    'newLevel', case when v_is_review then null else v_next end,
    'dir', case when v_is_review then '유지' else v_dir end,
    'rollingAccuracy', case when v_is_review then null else v_rolling end,
    'domain', v_domain.slug, 'domainLabel', v_domain.name_ko,
    'articleId', v_article.id, 'variantId', p_variant_id,
    'isOriginal', v_article.content_kind = 'original', 'isReview', v_is_review,
    'canSave', v_progress.status = 'completed' or (not v_is_review),
    'sourceUrl', v_article.source_url, 'credits', v_credits
  );
end;
$$;

create function public.save_article_progress(p_user_id uuid, p_article_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_article public.articles%rowtype;
  v_progress public.user_article_progress%rowtype;
begin
  perform id from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error', 'unauthenticated'); end if;
  perform id from public.credit_policy where id = 1 for share;
  select * into v_article from public.articles where id = p_article_id for share;
  if not found then return jsonb_build_object('error', 'not found'); end if;
  perform source from public.content_source_rights where source = v_article.source for share;
  if not public.content_article_allows(p_article_id, 'publish') then
    return jsonb_build_object('error', 'not found');
  end if;
  select * into v_progress from public.user_article_progress
    where user_id = p_user_id and article_id = p_article_id for update;
  if not found then return jsonb_build_object('error', 'not found'); end if;
  if v_progress.status = 'saved' then
    return jsonb_build_object('ok', true, 'saved', true, 'scoopId', v_progress.id);
  end if;
  if v_progress.status <> 'completed' then
    return jsonb_build_object('error', 'not completed');
  end if;
  perform set_config('app.credit_writer', 'v1', true);
  update public.user_article_progress set status = 'saved', saved_at = clock_timestamp()
    where id = v_progress.id and status = 'completed';
  return jsonb_build_object('ok', true, 'saved', true, 'scoopId', v_progress.id);
end;
$$;

create function public.save_onboarding_preferences(p_user_id uuid, p_selections jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_item jsonb;
  v_domain_id integer;
  v_rare integer;
  v_seen integer[] := '{}'::integer[];
  v_added integer := 0;
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
       or coalesce(v_item->>'rareChecked', '') !~ '^[0-9]$' then
      return jsonb_build_object('error', 'invalid body');
    end if;
    v_domain_id := (v_item->>'domainId')::integer;
    v_rare := (v_item->>'rareChecked')::integer;
    if v_rare > 4 or v_domain_id = any(v_seen)
       or not exists (select 1 from public.domains where id = v_domain_id and active) then
      return jsonb_build_object('error', 'invalid body');
    end if;
    v_seen := v_seen || v_domain_id;
  end loop;
  perform set_config('app.credit_writer', 'v1', true);
  for v_item in select value from jsonb_array_elements(p_selections) as value loop
    v_domain_id := (v_item->>'domainId')::integer;
    v_rare := (v_item->>'rareChecked')::integer;
    insert into public.user_domain_levels (user_id, domain_id, level)
      values (p_user_id, v_domain_id, case when v_rare >= 3 then 3 when v_rare >= 1 then 2 else 1 end)
      on conflict (user_id, domain_id) do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'added', v_added);
end;
$$;

revoke all on function public.guard_credit_policy_update(), public.guard_credit_record_write(),
  public.get_credit_result(uuid, bigint), public.grade_quiz_with_credits(uuid, bigint, jsonb),
  public.save_article_progress(uuid, bigint), public.save_onboarding_preferences(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.get_credit_result(uuid, bigint),
  public.grade_quiz_with_credits(uuid, bigint, jsonb),
  public.save_article_progress(uuid, bigint), public.save_onboarding_preferences(uuid, jsonb)
  to service_role;

notify pgrst, 'reload schema';
commit;
