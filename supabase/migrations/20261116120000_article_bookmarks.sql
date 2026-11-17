-- 북마크 (확장.md §4). 아티클 단위로, 이미 연 글에만 붙는다.
--
-- 확장.md는 `bookmarked bool`이라고 적었지만 시각을 남긴다. 목록을 북마크한
-- 순서대로 보여줘야 하고, null이 곧 "북마크 안 함"이라 bool이 따로 필요 없다.
--
-- 진행 행에 붙이는 이유: 진행 행은 처음 열 때(쿼터 차감과 같은 트랜잭션)만
-- 생기고, 이 마이그레이션은 행을 만드는 경로를 추가하지 않는다. 그러니 북마크는
-- 쿼터를 쓰지도, 우회하지도 못한다 — 북마크한 글을 다시 여는 것은 원래도
-- 무료인 재열람이다(정책.md §7). 계정 삭제는 profiles → user_article_progress
-- cascade로 북마크까지 지운다.
--
-- 쓰기는 이 RPC 하나뿐이다. 클라이언트 쓰기 정책은 여전히 없고(policies.sql),
-- guard_credit_record_write가 service_role + app.credit_writer 없이는 진행 행
-- UPDATE를 막으므로 bookmarked_at만 바꾸는 계약된 경로를 따로 둔다.
begin;

alter table public.user_article_progress add column bookmarked_at timestamptz;

-- 목록 조회 전용. 북마크한 행만 담는다.
create index user_article_progress_bookmarks_idx on public.user_article_progress
  (user_id, bookmarked_at desc, id desc) where bookmarked_at is not null;

create function public.set_article_bookmark(p_user_id uuid, p_article_id bigint, p_bookmarked boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_progress_id bigint;
  v_bookmarked_at timestamptz;
begin
  if p_user_id is null or p_article_id is null or p_bookmarked is null then
    return jsonb_build_object('error', 'invalid body');
  end if;
  -- 진행 행이 없으면(한 번도 안 연 글) 만들지 않는다. 행 생성은 쿼터 경로만 한다.
  select id into v_progress_id from public.user_article_progress
    where user_id = p_user_id and article_id = p_article_id for update;
  if not found then return jsonb_build_object('error', 'not found'); end if;
  -- 내려간 글은 새로 북마크하지 못한다. 해제는 언제나 허용한다.
  if p_bookmarked and not public.content_article_allows(p_article_id, 'publish') then
    return jsonb_build_object('error', 'not found');
  end if;

  perform set_config('app.credit_writer', 'v1', true);
  -- bookmarked_at 외의 컬럼은 건드리지 않는다. 이미 북마크했으면 처음 시각을 유지한다.
  update public.user_article_progress
    set bookmarked_at = case when p_bookmarked then coalesce(bookmarked_at, clock_timestamp()) end
    where id = v_progress_id
    returning bookmarked_at into v_bookmarked_at;
  return jsonb_build_object('ok', true, 'articleId', p_article_id,
    'bookmarked', v_bookmarked_at is not null, 'bookmarkedAt', v_bookmarked_at);
end;
$$;

-- p_user_id is supplied only by the server after getUser verifies the token.
revoke all on function public.set_article_bookmark(uuid, bigint, boolean) from public, anon, authenticated;
grant execute on function public.set_article_bookmark(uuid, bigint, boolean) to service_role;

-- 리더가 북마크 상태를 같은 왕복에서 받도록 progress 투영에 한 필드를 더한다.
-- 나머지는 20261022180420_article_reader_rpc.sql과 같다.
create or replace function public.open_article_reader(p_user_id uuid, p_variant_id bigint)
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
    'progress', jsonb_build_object('status', v_progress.status, 'quiz_score', v_progress.quiz_score,
      'bookmarked', v_progress.bookmarked_at is not null)
  );
end;
$$;

revoke all on function public.open_article_reader(uuid, bigint) from public, anon, authenticated;
grant execute on function public.open_article_reader(uuid, bigint) to service_role;
notify pgrst, 'reload schema';
commit;
