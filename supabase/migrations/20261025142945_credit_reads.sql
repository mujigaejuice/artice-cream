-- Read-only credit projections for the account and result UI.
begin;

create function public.get_credit_snapshot(p_user_id uuid)
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
  )
  from public.credit_policy p
  where p.id = 1 and exists (select 1 from public.profiles where id = p_user_id);
$$;

create function public.get_credit_history(
  p_user_id uuid, p_before_at timestamptz default null,
  p_before_id bigint default null, p_limit integer default 21)
returns table(event_id text, amount integer, reason text, created_at timestamptz,
  article_id text, article_title text)
language sql stable security invoker set search_path = '' as $$
  with page as (
    select e.id, e.amount, e.reason, e.created_at, e.metadata
    from public.credit_events e
    where e.user_id = p_user_id
      and (p_before_at is null or (p_before_id is not null
        and (e.created_at, e.id) < (p_before_at, p_before_id)))
    order by e.created_at desc, e.id desc
    limit least(greatest(p_limit, 1), 51)
  )
  select page.id::text, page.amount, page.reason, page.created_at,
    page.metadata->>'articleId',
    case when page.reason in ('article_read', 'quiz_bonus') and
      v.id is not null and public.content_article_allows(v.article_id, 'publish')
      then v.title else null end
  from page
  left join public.article_variants v on v.id::text = page.metadata->>'variantId'
  order by page.created_at desc, page.id desc;
$$;

revoke all on function public.get_credit_snapshot(uuid),
  public.get_credit_history(uuid, timestamptz, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.get_credit_snapshot(uuid),
  public.get_credit_history(uuid, timestamptz, bigint, integer)
  to service_role;

notify pgrst, 'reload schema';
commit;
