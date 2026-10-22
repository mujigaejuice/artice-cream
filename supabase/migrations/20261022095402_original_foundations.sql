-- Additive: deploy before API code. Existing external rights checks remain intact.
begin;
alter table public.articles
  alter column source_url drop not null,
  add column content_kind text not null default 'external' check (content_kind in ('external','original')),
  add column original_key text unique,
  add column foundation_order smallint,
  add column editorial_status text not null default 'draft' check (editorial_status in ('draft','approved','withdrawn')),
  add column reference_links jsonb not null default '[]'::jsonb check (jsonb_typeof(reference_links) = 'array'),
  add constraint articles_origin_identity check (
    (content_kind = 'external' and source_url is not null and original_key is null and foundation_order is null)
    or (content_kind = 'original' and source is not null and source = 'artice-original' and source_url is null
      and original_key is not null and original_key ~ '^[a-z0-9-]+$'
      and foundation_order is not null and foundation_order between 1 and 100 and domain_id is not null)
  );
create index articles_original_domain_order on public.articles(domain_id, foundation_order) where content_kind = 'original';
grant select (content_kind, original_key, foundation_order, editorial_status, reference_links) on public.articles to authenticated;

create or replace function public.content_article_allows(article_key bigint, action_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.articles a where a.id = article_key
      and a.rights_status = 'permitted' and a.rights_evidence_url ~ '^https?://'
      and a.rights_reviewed_at <= now()
      and (a.rights_expires_at is null or a.rights_expires_at > now())
      and public.content_source_allows(a.source, action_name)
      and (
        (a.content_kind = 'original' and action_name = 'publish' and a.source = 'artice-original'
          and a.editorial_status = 'approved' and a.original_key is not null
          and jsonb_array_length(a.reference_links) > 0)
        or (a.content_kind = 'external'
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
          and jsonb_typeof(a.rights_attribution->'notices') = 'string')
      )
      and case action_name when 'process' then a.status = 'pending'
        when 'publish' then a.status = 'ready' else false end
  );
$$;
revoke all on function public.content_article_allows(bigint,text) from public;
grant execute on function public.content_article_allows(bigint,text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
