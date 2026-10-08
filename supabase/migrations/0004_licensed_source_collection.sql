-- Collection is independent of external-model processing and publication.
-- Only metadata collection for the two reviewed CC BY 4.0 sites is enabled.
-- Individual article approval is still required before processing; no article is changed here.
begin;
update public.content_source_rights set
  rights_status = 'permitted', allow_collect = true,
  evidence_url = case source
    when 'kubernetes' then 'https://github.com/kubernetes/website/blob/main/LICENSE'
    when 'go-blog' then 'https://go.dev/copyright'
  end,
  reviewed_at = now(),
  review_note = case source
    when 'kubernetes' then 'CC BY 4.0 website/blog scope and current article footer verified. Metadata collection approved. Per-article author, source, exceptions and changes must be reviewed before processing. No code/media reuse. Pickle provider identified; key purpose/settings confirmation pending. Processing/publication remain disabled.'
    when 'go-blog' then 'go.dev/copyright explicitly licenses website text CC BY 4.0 except as noted; code BSD separately. Metadata collection approved. Per-article authors, Google/Go credits, source, exceptions and changes must be reviewed. Pickle provider identified; key purpose/settings confirmation pending. Processing/publication remain disabled.'
  end
where source in ('kubernetes', 'go-blog') and rights_status = 'restricted'
  and not allow_collect and not allow_process and not allow_publish;

do $$ begin
  if (select count(*) from public.content_source_rights where source in ('kubernetes', 'go-blog')
    and rights_status = 'permitted' and allow_collect and not allow_process and not allow_publish) <> 2 then
    raise exception 'Collection decisions changed; re-review before applying 0004';
  end if;
end $$;
commit;
