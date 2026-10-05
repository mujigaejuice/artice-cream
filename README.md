# artice cream

오늘 나온 개발·AI 글을 내 읽기 수준에 맞게 다시 써 주는 읽기 앱. 다 읽으면
퀴즈로 이해도를 확인하고, 한 편을 끝낼 때마다 콘에 아이스크림 스쿱이 하나씩 쌓인다.

## 무엇을 하나

- 발행처 피드 40곳에서 새 글을 모아 여덟 분류로 나눈다. 분류는 클라우드, 인프라,
  데이터, CS 기초, 딥러닝, LLM, AI 보안, 보안이다.
- 글 한 편을 세 가지 수준으로 다시 쓴다. 수준마다 용어 풀이와 4문항 퀴즈가 붙고,
  용어와 퀴즈는 원문이 아니라 다시 쓴 본문에서 나온다.
- 퀴즈 결과에 따라 다음 글의 수준이 오르내린다.
- 읽은 글은 분류별 색의 스쿱이 되어 한 달짜리 콘에 올라간다.
- 이메일 로그인 링크나 구글 계정으로 로그인한 뒤 관심 분야를 고른다.
- 하단의 나 탭에서 로그인한 계정을 확인하고 로그아웃해 다른 계정으로 바꿀 수 있다.

## 기술 스택

- Next.js 16, React 19, Tailwind CSS 4
- Supabase: Postgres, 인증(매직 링크·구글), RLS
- LLM: Anthropic SDK, 또는 OpenAI 호환 게이트웨이
- Capacitor 8: 안드로이드 앱
- Vercel: API와 매일 도는 인제스트 cron

## 구조

```
app/              화면과 API 라우트 (app/api/cron/ingest 가 인제스트)
components/       화면 컴포넌트
lib/ai/           LLM 파이프라인: 분류, 재작성, 용어, 퀴즈
lib/news/         피드 수집과 본문 추출
lib/supabase/     클라이언트와 타입
supabase/         스키마, RLS 정책, 분류 시드
android/          Capacitor 안드로이드 프로젝트
scripts/          앱 빌드, 로직 점검, 스파이크 스크립트
tests/classify/   분류기 정답 세트와 채점기
```

## 시작하기

```bash
npm install
cp .env.example .env.local   # 값을 채운다
```

Supabase 프로젝트를 만들고 SQL 에디터에서 아래 세 파일을 순서대로 실행한다.

1. `supabase/migrations/0001_init.sql`
2. `supabase/policies.sql`
3. `supabase/seed.sql`

Authentication 설정에서 이메일과 Google 로그인을 켜고, 익명 로그인은 끈다.
온보딩은 정식 계정 로그인부터 시작한다.

Authentication → URL Configuration에는 다음 주소를 등록한다.

- Site URL: `https://artice-cream.vercel.app`
- Redirect URLs: `http://localhost:3000/auth/callback`,
  `https://artice-cream.vercel.app/auth/callback`, `artice-cream://auth/callback`

Google OAuth의 Authorized redirect URI는 앱 주소가 아니라
`https://<project-ref>.supabase.co/auth/v1/callback`이다.
이메일 링크는 로그인을 요청한 브라우저에서 열고, 앱에서 요청했다면 같은 기기의
앱으로 돌아와야 한다. PKCE 검증에 요청 당시 저장한 값이 필요하다.

LLM은 `.env.local`에 `BASE_URL`, `MODEL_ID`, `API_KEY`가 모두 있으면 OpenAI 호환
게이트웨이로, 없으면 `ANTHROPIC_API_KEY`로 Anthropic을 직접 부른다.

```bash
npm run dev
```

처음에는 아티클이 없어서 홈이 비어 있다. 인제스트를 한 번 돌리면 채워진다.
수집을 먼저 돌리고, 그다음 분류별로 가공한다.

```bash
AUTH="Authorization: Bearer $CRON_SECRET"
curl -H "$AUTH" http://localhost:3000/api/cron/ingest

for c in cloud infra data cs-fundamentals deep-learning llm ai-security security; do
  curl -H "$AUTH" "http://localhost:3000/api/cron/ingest/$c"
done
```

`CRON_SECRET`이 비어 있으면 로컬에서는 인증을 건너뛴다. PowerShell에서는 `curl`
대신 `curl.exe`를 쓴다.

## 스크립트

```bash
npm run dev            # 개발 서버
npm run build          # 프로덕션 빌드
npm run typecheck      # 타입 검사
npm run test:logic     # 수준 조정, 스쿱 색, 용어 표시 같은 순수 로직 점검
npm run test:auth      # 웹·앱 저장소의 로그아웃 검증 (외부 요청 없음)
npm run test:classify  # 분류기 정답률 (LLM 호출, 유료)
npm run build:app      # 앱용 정적 번들 (out/)
npm run app:run        # 번들 → cap sync → 안드로이드 빌드·설치·실행
```

## 배포

Vercel에 올리면 `vercel.json`의 cron 9개가 매일 돈다. 한국 시간 오전 3시에 수집하고,
오전 5시부터 8시 반까지 30분 간격으로 분류 하나씩 가공한다. 프로덕션에서는
`CRON_SECRET`이 있어야 cron 호출이 통과한다.
