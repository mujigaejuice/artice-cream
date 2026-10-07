-- Rights gate. Apply to the existing database without replaying 0001.
-- Existing content remains stored for review, but starts unreviewed and invisible.
begin;

create table public.content_source_rights (
  source text primary key,
  rights_status text not null default 'unreviewed'
    check (rights_status in ('unreviewed', 'permitted', 'restricted', 'blocked')),
  evidence_url text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  allow_collect boolean not null default false,
  allow_process boolean not null default false,
  allow_publish boolean not null default false,
  review_note text not null default '',
  check (rights_status <> 'permitted' or
    (evidence_url is not null and evidence_url ~ '^https?://' and reviewed_at is not null))
);
alter table public.content_source_rights enable row level security;
revoke all on public.content_source_rights from anon, authenticated;
grant select (source, rights_status, evidence_url, reviewed_at, expires_at,
  allow_collect, allow_process, allow_publish) on public.content_source_rights to anon, authenticated;
grant all on public.content_source_rights to service_role;
create policy "source rights public facts" on public.content_source_rights for select using (true);

insert into public.content_source_rights (source) values
  ('aws-news'), ('gcp-blog'), ('cloudflare'), ('kubernetes'), ('cncf'),
  ('thenewstack'), ('infoq'), ('meta-eng'), ('toss'), ('lycorp-ko'),
  ('google-research'), ('deepmind'), ('huggingface'), ('pytorch'), ('nvidia-dev'),
  ('mit-news-ai'), ('msr'), ('simonwillison'), ('interconnects'), ('aitimes'),
  ('embracethered'), ('owasp-genai'), ('trailofbits'), ('google-security'),
  ('thehackernews'), ('bleepingcomputer'), ('securityweek'), ('dailysecu'),
  ('unit42'), ('oldnewthing'), ('lemire'), ('murat'), ('eli-bendersky'),
  ('brooker'), ('julia-evans'), ('databricks'), ('towardsdatascience'),
  ('duckdb'), ('spotify-eng'), ('devsisters');

-- Public-license candidates remain restricted until the article scope, notices,
-- third-party material and actual external processing conditions are reviewed.
update public.content_source_rights set rights_status = 'restricted',
  evidence_url = case source
    when 'aws-news' then 'https://aws.amazon.com/terms/'
    when 'cloudflare' then 'https://www.cloudflare.com/website-terms/'
    when 'databricks' then 'https://www.databricks.com/legal/terms-of-use'
    when 'infoq' then 'https://www.infoq.com/terms-and-conditions/'
    when 'kubernetes' then 'https://github.com/kubernetes/website/blob/main/LICENSE'
    when 'lemire' then 'https://lemire.me/blog/terms-of-use/'
    when 'cncf' then 'https://github.com/cncf/foundation/blob/main/policies-guidance/blog-guidelines.md'
    when 'owasp-genai' then 'https://genai.owasp.org/contributing/'
  end,
  reviewed_at = '2026-10-08T00:00:00+09:00',
  review_note = case source
    when 'aws-news' then 'Separate permission for automated collection, adaptation and publication is unconfirmed.'
    when 'cloudflare' then 'Separate blog permission/exception for this use is unconfirmed.'
    when 'databricks' then 'Separate permission for collection, translation and redistribution is unconfirmed.'
    when 'infoq' then 'Summary plus link allowed; current long adapted reading text is not approved.'
    when 'kubernetes' then 'CC BY 4.0 candidate; review repository inclusion, author, notices, third-party exceptions and provider handling.'
    when 'lemire' then 'CC BY 3.0 permits commercial adaptation/translation of author text, excludes comments; review attribution, third-party exceptions and provider handling.'
    when 'cncf' then 'Blog guidelines reference CC Attribution; verify license version and individual post exceptions.'
    when 'owasp-genai' then 'Project materials may use CC BY-SA 4.0; verify each blog asset and ShareAlike handling.'
  end
where source in ('aws-news', 'cloudflare', 'databricks', 'infoq', 'kubernetes', 'lemire', 'cncf', 'owasp-genai');

-- Also register removed or legacy sources; they do not inherit any permission.
insert into public.content_source_rights (source)
select distinct source from public.articles where source is not null
on conflict (source) do nothing;

alter table public.articles
  add column rights_status text not null default 'unreviewed'
    check (rights_status in ('unreviewed', 'permitted', 'restricted', 'blocked')),
  add column rights_evidence_url text,
  add column rights_reviewed_at timestamptz,
  add column rights_expires_at timestamptz,
  add column rights_attribution jsonb,
  add column rights_review_note text not null default '';

create index articles_rights_queue on public.articles (domain_id, status, rights_status);

-- Preserve original_text's column restriction and keep internal review notes private.
revoke select on public.articles from anon, authenticated;
grant select (id, domain_id, source, source_url, title, author, image_url,
  published_at, fetched_at, status, rights_status, rights_evidence_url,
  rights_reviewed_at, rights_expires_at, rights_attribution)
on public.articles to authenticated;

create function public.content_source_allows(source_id text, action_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.content_source_rights r where r.source = source_id
      and r.rights_status = 'permitted' and r.evidence_url ~ '^https?://'
      and r.reviewed_at <= now() and (r.expires_at is null or r.expires_at > now())
      and case action_name when 'collect' then r.allow_collect
        when 'process' then r.allow_process when 'publish' then r.allow_publish else false end
  );
$$;

create function public.content_article_allows(article_key bigint, action_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.articles a where a.id = article_key
      and a.rights_status = 'permitted' and a.rights_evidence_url ~ '^https?://'
      and a.rights_reviewed_at <= now()
      and (a.rights_expires_at is null or a.rights_expires_at > now())
      and public.content_source_allows(a.source, action_name)
      and jsonb_typeof(a.rights_attribution) = 'object'
      and jsonb_typeof(a.rights_attribution->'author') = 'string'
      and length(btrim(a.rights_attribution->>'author')) > 0
      and jsonb_typeof(a.rights_attribution->'originalTitle') = 'string'
      and length(btrim(a.rights_attribution->>'originalTitle')) > 0
      and jsonb_typeof(a.rights_attribution->'licenseLabel') = 'string'
      and length(btrim(a.rights_attribution->>'licenseLabel')) > 0
      and jsonb_typeof(a.rights_attribution->'licenseUrl') = 'string'
      and a.rights_attribution->>'licenseUrl' ~ '^https?://'
      and jsonb_typeof(a.rights_attribution->'changes') = 'string'
      and length(btrim(a.rights_attribution->>'changes')) > 0
      and jsonb_typeof(a.rights_attribution->'notices') = 'string'
      and case action_name when 'process' then a.status = 'pending'
        when 'publish' then a.status = 'ready' else false end
  );
$$;
revoke all on function public.content_source_allows(text, text) from public;
revoke all on function public.content_article_allows(bigint, text) from public;
grant execute on function public.content_source_allows(text, text) to anon, authenticated, service_role;
grant execute on function public.content_article_allows(bigint, text) to anon, authenticated, service_role;

-- Restrictive policies also close a permissive policy added elsewhere by mistake.
create policy "articles rights gate" on public.articles as restrictive for select
  to anon, authenticated using (public.content_article_allows(id, 'publish'));
create policy "variants rights gate" on public.article_variants as restrictive for select
  to anon, authenticated using (public.content_article_allows(article_id, 'publish'));
create policy "questions rights gate" on public.quiz_questions as restrictive for select
  to anon, authenticated using (exists (
    select 1 from public.article_variants v where v.id = variant_id
      and public.content_article_allows(v.article_id, 'publish')
  ));
create policy "progress rights gate" on public.user_article_progress as restrictive for select
  to anon, authenticated using (public.content_article_allows(article_id, 'publish'));

-- Materialized glossary lists also need provenance; old lists have none and stay hidden.
alter table public.domain_terms add column origin_article_ids bigint[] not null default '{}';
create function public.content_terms_allowed(article_keys bigint[])
returns boolean language sql stable security definer set search_path = '' as $$
  select cardinality(article_keys) > 0 and not exists (
    select 1 from unnest(article_keys) article_key
    where not public.content_article_allows(article_key, 'publish')
  );
$$;
revoke all on function public.content_terms_allowed(bigint[]) from public;
grant execute on function public.content_terms_allowed(bigint[]) to anon, authenticated, service_role;
create policy "terms rights gate" on public.domain_terms as restrictive for select
  to anon, authenticated using (public.content_terms_allowed(origin_article_ids));

notify pgrst, 'reload schema';
commit;
