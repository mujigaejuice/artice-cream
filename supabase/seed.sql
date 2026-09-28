-- 도메인 시드 (소스분류.md §1의 여덟 분류). 플레이버 색은 lib/color.ts가
-- slug로 매핑하므로 여기에 색 컬럼은 없다. 슬러그는 DOMAIN_FLAVORS의 키와
-- 반드시 일치해야 한다. rss_topic은 소스 주도 수집으로 바뀌며 더 쓰지 않는다.

insert into domains (slug, name_ko, name_en, rss_topic, active) values
  ('cloud',            '클라우드', 'Cloud',         null, true),
  ('infra',            '인프라',   'Infrastructure', null, true),
  ('data',             '데이터',   'Data',          null, true),
  ('cs-fundamentals',  'CS 기초',  'CS Fundamentals', null, true),
  ('deep-learning',    '딥러닝',   'Deep Learning', null, true),
  ('llm',              'LLM',      'LLM',           null, true),
  ('ai-security',      'AI 보안',  'AI Security',   null, true),
  ('security',         '보안',     'Security',      null, true)
on conflict (slug) do update
  set name_ko   = excluded.name_ko,
      name_en   = excluded.name_en,
      rss_topic = excluded.rss_topic,
      active    = excluded.active;
