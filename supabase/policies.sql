-- RLS 정책 (spec §8 "RLS (Supabase 보안 자세)").
-- Apply migrations/0001 through 0004 FIRST.
-- 0002 installs restrictive rights policies; these permissive policies cannot bypass them.
--
--   * 사용자 스코프 테이블: 본인 행만.
--   * 콘텐츠 테이블: 인증 사용자 읽기 전용, 쓰기는 파이프라인(service role)만.
--   * quiz_questions: 클라이언트 읽기 정책을 아예 만들지 않는다 — correct_index가
--     새기 때문. 문항은 서버가 읽어 정답을 떼고 내려주고, 채점은 /api/quiz/grade.
--   * domains: 전체 읽기 허용.
--
-- daily_quota / user_article_progress에 클라이언트 쓰기 정책이 없는 것도 의도다.
-- 사용자가 자기 쿼터 행을 쓸 수 있으면 쿼터가 없는 것과 같고, 진도 행을 쓸 수
-- 있으면 공짜 스쿱이다. service role은 RLS를 우회하므로 별도 정책이 필요 없다.

alter table profiles              enable row level security;
alter table domains               enable row level security;
alter table domain_terms          enable row level security;
alter table user_domain_levels    enable row level security;
alter table articles              enable row level security;
alter table article_variants      enable row level security;
alter table quiz_questions        enable row level security;
alter table user_article_progress enable row level security;
alter table daily_quota           enable row level security;
alter table ad_views              enable row level security;

/* ---------------------------------------------------------- 콘텐츠 ---- */

create policy "domains readable by all"
  on domains for select
  using (true);

create policy "domain terms readable by all"
  on domain_terms for select
  using (true);

create policy "articles readable by authenticated"
  on articles for select
  to authenticated
  using (true);

create policy "variants readable by authenticated"
  on article_variants for select
  to authenticated
  using (true);

-- quiz_questions: 정책 없음 (의도적).

/* ------------------------------------------------------------ 사용자 ---- */

create policy "own profile readable"
  on profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "own profile updatable"
  on profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "own levels readable"
  on user_domain_levels for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 온보딩에서 자가 선택한 초기 수준만 클라이언트가 쓴다(spec §4.2).
-- 이후 조정은 전부 채점 라우트가 service role로 수행한다.
create policy "own levels insertable"
  on user_domain_levels for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "own levels updatable"
  on user_domain_levels for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own progress readable"
  on user_article_progress for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "own quota readable"
  on daily_quota for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "own ad views readable"
  on ad_views for select
  to authenticated
  using (user_id = (select auth.uid()));
