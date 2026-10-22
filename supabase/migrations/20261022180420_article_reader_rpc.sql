-- Additive: apply before deploying the reader API. The existing quota RPC stays
-- compatible with older deployments. No cache of authorization or user state.
begin;

create function public.open_article_reader(p_user_id uuid, p_variant_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_variant public.article_variants%rowtype;
  v_article public.articles%rowtype;
  v_progress public.user_article_progress%rowtype;
  v_domain jsonb;
  v_gate jsonb;
begin
  -- Lock order starts with the same user lock as opens/rewards. Publication and
  -- content edits cannot change the checked rows before this transaction ends.
  perform id from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile not found' using errcode = '23503'; end if;

  select * into v_variant from public.article_variants where id = p_variant_id for share;
  if not found then return jsonb_build_object('error', 'not found'); end if;
  select * into v_article from public.articles where id = v_variant.article_id for share;
  if not found then return jsonb_build_object('error', 'not found'); end if;
  perform source from public.content_source_rights where source = v_article.source for share;
  if not public.content_article_allows(v_article.id, 'publish') then
    return jsonb_build_object('error', 'not found');
  end if;

  -- Reuse the tested, atomic debit/reopen path. Failures roll back all writes.
  v_gate := public.open_article_with_quota(p_user_id, v_article.id, v_variant.id);
  if not (v_gate->>'opened')::boolean then return v_gate; end if;

  select * into strict v_progress from public.user_article_progress
    where user_id = p_user_id and article_id = v_article.id;
  select jsonb_build_object('slug', slug, 'name_ko', name_ko) into v_domain
    from public.domains where id = v_article.domain_id;

  -- Explicit projection excludes original_text, review notes, model and answers.
  return jsonb_build_object(
    'opened', true,
    'variant', jsonb_build_object(
      'id', v_variant.id, 'level', v_variant.level, 'title', v_variant.title,
      'content_html', v_variant.content_html, 'glossary', v_variant.glossary,
      'reading_minutes', v_variant.reading_minutes,
      'articles', jsonb_build_object(
        'id', v_article.id, 'source_url', v_article.source_url,
        'content_kind', v_article.content_kind, 'reference_links', v_article.reference_links,
        'rights_attribution', v_article.rights_attribution, 'domains', v_domain
      )
    ),
    'progress', jsonb_build_object('status', v_progress.status, 'quiz_score', v_progress.quiz_score)
  );
end;
$$;

-- p_user_id is supplied only by the server after getUser verifies the token.
-- SECURITY INVOKER and service-role-only EXECUTE prevent direct client calls.
revoke all on function public.open_article_reader(uuid, bigint) from public, anon, authenticated;
grant execute on function public.open_article_reader(uuid, bigint) to service_role;
notify pgrst, 'reload schema';
commit;
