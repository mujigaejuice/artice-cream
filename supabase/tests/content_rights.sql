-- Isolated transactional fixtures: nothing becomes visible outside this transaction.
begin;
create temp table rights_check_ids (source text, article_id bigint, variant_id bigint, user_id uuid, term text);
grant select on rights_check_ids to anon, authenticated;
do $$
declare
  src text := 'rights-check-' || gen_random_uuid()::text;
  uid uuid := gen_random_uuid();
  aid bigint;
  vid bigint;
  did int;
begin
  select id into did from public.domains limit 1;
  if did is null then raise exception 'seeded domain required'; end if;
  insert into public.content_source_rights(source) values (src);
  insert into public.articles(source, source_url, domain_id, title, status)
    values (src, 'https://fixture.invalid/' || src, did, 'Fixture original', 'ready') returning id into aid;
  insert into public.article_variants(article_id, level, title, content_html, glossary)
    values (aid, 2, 'Fixture adapted', '<p>Fixture only</p>', '{}') returning id into vid;
  insert into public.quiz_questions(variant_id, position, prompt, options, correct_index)
    values (vid, 0, 'Fixture question', '["a","b","c","d"]', 0);
  insert into auth.users(id, email, raw_app_meta_data)
    values (uid, src || '@example.com', '{"rights_test":true}');
  insert into public.user_article_progress(user_id, article_id, variant_id, status)
    values (uid, aid, vid, 'saved');
  insert into public.domain_terms(domain_id, term, tier, origin_article_ids)
    values (did, src, 'easy', array[aid]);
  insert into rights_check_ids values (src, aid, vid, uid, src);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  if public.content_article_allows(aid, 'publish') then raise exception 'unreviewed article allowed'; end if;
  if public.content_source_allows(src, 'collect') then raise exception 'unreviewed source allowed'; end if;
end;
$$;

set local role authenticated;
do $$
begin
  if exists(select 1 from public.articles where id = (select article_id from rights_check_ids)) or
    exists(select 1 from public.article_variants where id = (select variant_id from rights_check_ids)) or
    exists(select 1 from public.user_article_progress where article_id = (select article_id from rights_check_ids)) or
    exists(select 1 from public.domain_terms where term = (select term from rights_check_ids)) then
    raise exception 'unreviewed content leaked through RLS';
  end if;
  if has_column_privilege(current_user, 'public.articles', 'original_text', 'SELECT') or
    has_column_privilege(current_user, 'public.articles', 'rights_review_note', 'SELECT') or
    has_table_privilege(current_user, 'public.content_source_rights', 'UPDATE') then
    raise exception 'private text, notes or registry write privileges leaked';
  end if;
end;
$$;
reset role;

update public.content_source_rights set rights_status = 'permitted',
  evidence_url = 'https://fixture.invalid/permission', reviewed_at = now() - interval '1 minute',
  allow_collect = true, allow_process = true, allow_publish = true
where source = (select source from rights_check_ids);
update public.articles set rights_status = 'permitted', rights_evidence_url = 'https://fixture.invalid/permission',
  rights_reviewed_at = now() - interval '1 minute', rights_attribution = jsonb_build_object(
    'author', 'Test Author', 'originalTitle', 'Fixture original', 'licenseLabel', 'Test license',
    'licenseUrl', 'https://fixture.invalid/license', 'changes', 'Adapted for testing', 'notices', '')
where id = (select article_id from rights_check_ids);

set local role authenticated;
do $$
begin
  if not exists(select 1 from public.articles where id = (select article_id from rights_check_ids)) or
    not exists(select 1 from public.article_variants where id = (select variant_id from rights_check_ids)) or
    not exists(select 1 from public.user_article_progress where article_id = (select article_id from rights_check_ids)) or
    not exists(select 1 from public.domain_terms where term = (select term from rights_check_ids)) then
    raise exception 'approved content is not readable';
  end if;
  if exists(select 1 from public.quiz_questions where variant_id = (select variant_id from rights_check_ids)) then
    raise exception 'quiz answers leaked through direct DB';
  end if;
end;
$$;
reset role;

-- Source withdrawal hides existing saved content and materialized glossary immediately.
update public.content_source_rights set rights_status = 'blocked'
where source = (select source from rights_check_ids);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.articles where id = (select article_id from rights_check_ids)) or
    exists(select 1 from public.article_variants where id = (select variant_id from rights_check_ids)) or
    exists(select 1 from public.user_article_progress where article_id = (select article_id from rights_check_ids)) or
    exists(select 1 from public.domain_terms where term = (select term from rights_check_ids)) then
    raise exception 'withdrawn source leaked through RLS';
  end if;
end;
$$;
reset role;

update public.content_source_rights set rights_status = 'permitted'
where source = (select source from rights_check_ids);
update public.articles set rights_expires_at = now() - interval '1 minute'
where id = (select article_id from rights_check_ids);
do $$
begin
  if public.content_article_allows((select article_id from rights_check_ids), 'publish') then
    raise exception 'expired article allowed';
  end if;
end;
$$;
set local role authenticated;
do $$
begin
  if exists(select 1 from public.article_variants where id = (select variant_id from rights_check_ids)) then
    raise exception 'expired article leaked';
  end if;
end;
$$;
reset role;

set local role anon;
do $$
begin
  if exists(select 1 from public.article_variants where id = (select variant_id from rights_check_ids)) or
    exists(select 1 from public.domain_terms where term = (select term from rights_check_ids)) then
    raise exception 'anonymous content leak';
  end if;
end;
$$;
reset role;
rollback;
select 'rights SQL checks passed; all fixtures rolled back' as result;
