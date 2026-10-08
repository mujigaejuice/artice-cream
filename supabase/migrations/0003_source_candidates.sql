-- Reviewed public-license candidates. This registers evidence, NOT operating permission.
-- Apply after 0002. Existing articles, variants, quizzes and approved/blocked sources are untouched.
begin;

insert into public.content_source_rights as current_rights
  (source, rights_status, evidence_url, reviewed_at, allow_collect, allow_process, allow_publish, review_note)
values
  ('duckdb', 'restricted', 'https://github.com/duckdb/duckdb-web/blob/main/LICENSE',
    '2026-10-08T17:30:00+09:00', false, false, false,
    'Website repository (not database software) MIT candidate. Latest post matched _posts/2026-10-07-view-only-mode.md. Preserve copyright plus full MIT permission/disclaimer; review each article, third-party exceptions and actual provider handling before approval.'),
  ('mozilla-hacks', 'restricted', 'https://hacks.mozilla.org/',
    '2026-10-08T17:30:00+09:00', false, false, false,
    'Actual article footer states CC BY-SA 3.0 or later; use BY-SA 4.0 for adaptations with original license/version notice, author, permalink and changes. Exclude third-party material. Low-frequency feed: archive candidate. Article/provider review pending.'),
  ('web-dev', 'restricted', 'https://developers.google.com/terms/site-policies',
    '2026-10-08T17:30:00+09:00', false, false, false,
    'CC BY 4.0 candidate only for actual pages displaying that notice. Preserve author, Google credit, original permalink, license and modification notice. Code Apache 2.0, marks and third-party media are separate. Feed currently stale; archive candidate. Article/provider review pending.'),
  ('chrome-developers', 'restricted', 'https://developers.google.com/terms/site-policies',
    '2026-10-08T17:30:00+09:00', false, false, false,
    'Actual sample footer CC BY 4.0. Official feed /static/blog/feed.xml verified. Google attribution and modification notice required; code/media/marks excluded pending separate review. Do not extend to other Google blogs. Feed currently stale; article/provider review pending.'),
  ('rust-blog', 'restricted', 'https://github.com/rust-lang/blog.rust-lang.org/blob/main/README.md',
    '2026-10-08T17:30:00+09:00', false, false, false,
    'README explicitly licenses blog under MIT/Apache 2.0; choose MIT. Latest post matched content/demoting-i686-windows-targets-to-std-only.md. Preserve supplied copyright plus full MIT permission/disclaimer; review article authors, exceptions and provider handling before approval.'),
  ('go-blog', 'restricted', 'https://go.dev/copyright',
    '2026-10-08T17:30:00+09:00', false, false, false,
    'Website copyright page explicitly licenses content CC BY 4.0 except as noted; code separately BSD. Actual post links to that page. Preserve all authors, Go/Google credit, original permalink, license, changes and supplied notices. Article/provider review pending.'),
  ('fedora-magazine', 'restricted', 'https://fedoramagazine.org/terms-and-conditions/',
    '2026-10-08T17:30:00+09:00', false, false, false,
    'Terms sections 6/7 grant CC BY-SA 4.0 within Red Hat original/contributor scope; footer warns not all works covered. Review each article/coauthor and exceptions. Credit author screen name from Fedora Magazine plus permalink; mark adaptations BY-SA 4.0. Article/provider review pending.'),
  ('wikimedia-tech', 'restricted', 'https://diff.wikimedia.org/editorial-guidelines/',
    '2026-10-08T17:30:00+09:00', false, false, false,
    'Diff text explicitly CC BY-SA 4.0 unless otherwise noted; technology category feed only. Preserve author, permalink, license and changes; adaptations remain BY-SA 4.0. Commons media and external materials separately licensed; language/topic and article/provider review pending.')
on conflict (source) do update set
  rights_status = excluded.rights_status,
  evidence_url = excluded.evidence_url,
  reviewed_at = excluded.reviewed_at,
  review_note = excluded.review_note
where current_rights.rights_status = 'unreviewed'
  and not current_rights.allow_collect and not current_rights.allow_process and not current_rights.allow_publish;

-- Refine evidence for existing candidates without changing any action flags or overriding decisions.
update public.content_source_rights set
  reviewed_at = '2026-10-08T17:30:00+09:00',
  review_note = case source
    when 'kubernetes' then 'CC BY 4.0 website/blog candidate. Actual post footer and matching English repository source verified. Preserve author(s), permalink, license, changes and supplied notices; check each article/third-party exceptions and provider handling before approval.'
    when 'owasp-genai' then 'Actual article footer grants site content CC BY-SA 4.0 unless specified otherwise. Preserve contributor(s), permalink, license, changes, copyright and disclaimers; adaptations remain BY-SA 4.0. Code license is separate. Article/provider review pending.'
  end
where source in ('kubernetes', 'owasp-genai') and rights_status = 'restricted'
  and not allow_collect and not allow_process and not allow_publish;

commit;
