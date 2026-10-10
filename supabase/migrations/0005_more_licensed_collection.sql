-- Collection is independent of external-model processing and publication.
-- Metadata collection only, for four sites whose text licence was verified on 2026-10-09:
--   duckdb          MIT (duckdb-web repository LICENSE, Stichting DuckDB Foundation)
--   rust-blog       MIT/Apache 2.0 (blog repository README + LICENSE-MIT)
--   web-dev         CC BY 4.0 page notice (code Apache 2.0)
--   chrome-developers CC BY 4.0 page notice (code Apache 2.0)
-- Individual article approval is still required before processing; no article is changed here.
-- allow_process and allow_publish stay false for every source.
begin;
update public.content_source_rights set
  rights_status = 'permitted', allow_collect = true,
  evidence_url = case source
    when 'duckdb' then 'https://github.com/duckdb/duckdb-web/blob/main/LICENSE'
    when 'rust-blog' then 'https://github.com/rust-lang/blog.rust-lang.org/blob/main/README.md'
    when 'web-dev' then 'https://developers.google.com/terms/site-policies'
    when 'chrome-developers' then 'https://developers.google.com/terms/site-policies'
  end,
  reviewed_at = now(),
  review_note = case source
    when 'duckdb' then 'duckdb-web repository LICENSE is MIT (Copyright Stichting DuckDB Foundation); latest posts matched to _posts files with front-matter authors. Metadata collection approved. Guest-author posts ("Guest blog post by a DuckDB user") and posts with blockquoted third-party material are excluded from article approval. Full MIT notice must be kept with each approved article. Processing/publication remain disabled; LLM provider decision pending.'
    when 'rust-blog' then 'Blog README states the blog is licensed MIT/Apache 2.0; MIT selected, LICENSE-MIT text kept. Latest posts matched to repository files. Metadata collection approved. Per-article authors, exceptions and changes must be reviewed before processing. Processing/publication remain disabled; LLM provider decision pending.'
    when 'web-dev' then 'Each page carries "Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License". Metadata collection approved (archive picks are old posts). Per-page notice, authors, third-party media and exceptions must be reviewed per article. Processing/publication remain disabled; LLM provider decision pending.'
    when 'chrome-developers' then 'Each page carries the same CC BY 4.0 / Apache 2.0 notice as web.dev. Metadata collection approved (archive picks are old posts). Per-page notice, authors, third-party media and exceptions must be reviewed per article; other Google blogs are not covered. Processing/publication remain disabled; LLM provider decision pending.'
  end
where source in ('duckdb', 'rust-blog', 'web-dev', 'chrome-developers') and rights_status = 'restricted'
  and not allow_collect and not allow_process and not allow_publish;

do $$ begin
  if (select count(*) from public.content_source_rights where source in ('duckdb', 'rust-blog', 'web-dev', 'chrome-developers')
    and rights_status = 'permitted' and allow_collect and not allow_process and not allow_publish) <> 4 then
    raise exception 'Collection decisions changed; re-review before applying 0005';
  end if;
  if (select count(*) from public.content_source_rights where allow_process or allow_publish) <> 0 then
    raise exception 'Unexpected process/publish approval present; stop and re-review';
  end if;
end $$;
commit;
