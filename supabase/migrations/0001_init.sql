-- artice-cream 초기 스키마 — spec §8 DDL 기준.
--
-- spec에서 벗어난 곳은 세 군데뿐이고, 모두 아래에 이유를 적었다:
--   * article_variants.title
--   * user_domain_levels.recent_scores
--   * ad_views.nonce / provider 기본값
--
-- 스쿱 색은 저장하지 않는다. scoopShade(도메인 슬러그, 완료 날짜)가 순수 함수라
-- 서버·클라이언트가 같은 값을 계산한다 (lib/color.ts).

-- 프로필 (auth.users.id 와 1:1)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text,                          -- 후속: 로컬 자정 리셋용
  created_at timestamptz default now()
);

-- 도메인 (경제/정치/IT …) — enum 대신 테이블로 유연하게
-- 플레이버 색은 컬럼이 아니라 lib/color.ts가 slug로 매핑한다.
create table domains (
  id serial primary key,
  slug text unique not null,              -- 'economy' | 'politics' | 'it'
  name_ko text not null,
  name_en text,
  rss_topic text,                         -- 구글뉴스 topic 매핑
  active boolean default true
);

-- 사용자 × 도메인 수준
create table user_domain_levels (
  user_id uuid references profiles(id) on delete cascade,
  domain_id int references domains(id),
  level smallint not null default 2,      -- 1 초급 / 2 중급 / 3 고급
  rolling_accuracy real default 0,
  quizzes_taken int default 0,
  -- spec에 없는 추가 컬럼. §4.3의 "최근 3회 평균"은 창(window)이 있어야 계산되는데
  -- rolling_accuracy 하나로는 직전 점수들을 복원할 수 없다. lib/level.ts가 쓴다.
  recent_scores real[] not null default '{}',
  updated_at timestamptz default now(),
  primary key (user_id, domain_id)
);

-- 원본 아티클 (수집·추출 결과)
create table articles (
  id bigserial primary key,
  domain_id int references domains(id),   -- 분류에서 버린(rejected) 후보는 null
  source text,                            -- lib/news/feeds.ts의 Source.id
  source_url text unique not null,
  title text,
  author text,
  image_url text,
  original_text text,
  published_at timestamptz,
  fetched_at timestamptz default now(),
  status text default 'ready'             -- ready | extract_failed | paywalled | rejected
);
create index on articles (domain_id, published_at desc);

-- original_text는 파이프라인(service role)만 쓴다. service role은 RLS도 컬럼
-- 권한도 우회하므로 수집 배치는 영향받지 않는다. 정책.md §8 — 원문 전문은 앱
-- 안에서 절대 보여주지 않는다(링크만). RLS는 행 단위라 이 컬럼은 따로 막아야 한다.
revoke select (original_text) on articles from authenticated, anon;

-- 수준별 가공본 (LLM 산출물, 캐시 대상)
create table article_variants (
  id bigserial primary key,
  article_id bigint references articles(id) on delete cascade,
  level smallint not null,
  -- spec §8 DDL에는 없지만 재작성 콜이 수준별 제목을 실제로 생성하고
  -- (prompts.ts: "제목은 …해당 수준에 맞게 다듬습니다") 리더가 이 제목을 쓴다.
  title text not null,
  -- 정책.md §13 — 주문서 카드에 쓰는 2~3문장 요약. 옛 행(마이그레이션 전)은 null.
  summary text,
  content_html text not null,             -- <mark>로 하이라이트된 본문
  glossary jsonb not null,                -- { "w3": {term, definition}, ... }
  reading_minutes int,
  model text,
  created_at timestamptz default now(),
  unique (article_id, level)
);
create index on article_variants (level);

-- 퀴즈 문항 (variant에 종속 — 수준별로 다를 수 있음)
create table quiz_questions (
  id bigserial primary key,
  variant_id bigint references article_variants(id) on delete cascade,
  position smallint not null,
  prompt text not null,
  options jsonb not null,                 -- ["...", "...", "...", "..."]
  correct_index smallint not null,
  explanation text,
  unique (variant_id, position)
);

-- 사용자 진행/완료 (스쿱은 여기서 파생)
create table user_article_progress (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  article_id bigint references articles(id),
  variant_id bigint references article_variants(id),
  -- 정책.md §2 — started(쿼터 소모) → completed(채점 끝) → saved(콘에 올림).
  -- 저장하지 않고 나가면 completed로 남고, 그 아티클은 홈 주문서에 남는다(§13).
  status text not null default 'started',
  quiz_score real,
  quiz_answers jsonb,
  started_at timestamptz default now(),
  completed_at timestamptz,
  saved_at timestamptz,
  -- 같은 아티클을 여러 번 읽어도 스쿱은 하나. variant가 아니라 아티클 단위인
  -- 이유는, 수준이 바뀌면 같은 기사의 다른 variant를 열 수 있기 때문이다. variant_id는
  -- 남겨 둔다 — 스쿱을 "그때 읽은 그 수준"으로 되돌려야 한다(정책.md §2).
  unique (user_id, article_id)
);
create index on user_article_progress (user_id, status);

-- 정책.md §15 — 온보딩 용어 체크용 분야별 용어 목록. lib/terms.ts의 자동 집계가
-- 이 표를 덮어쓴다. 아직 집계가 없는 분야는 손으로 넣은 초기 목록을 쓴다.
create table domain_terms (
  domain_id int references domains(id) on delete cascade,
  term text not null,
  tier text not null,                     -- easy | rare
  primary key (domain_id, term)
);

-- 일일 쿼터
create table daily_quota (
  user_id uuid references profiles(id) on delete cascade,
  quota_date date not null,
  free_used boolean default false,
  ad_unlocks int default 0,               -- 상한 체크
  primary key (user_id, quota_date)
);

-- 리워드 광고 로그 (SSV 검증·어뷰징 방지)
create table ad_views (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  provider text,
  reward_verified boolean default false,
  unlocked_variant_id bigint references article_variants(id),
  -- spec에 없는 추가 컬럼. 서명 nonce를 단일 사용으로 강제하는 건 결국 이
  -- unique 제약이다 (재사용 공격 차단). 실제 SSV로 바꿔도 그대로 쓴다.
  nonce text unique,
  created_at timestamptz default now()
);

-- 신규 가입 시 프로필 생성
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
