# artice cream

개발·AI 글을 내 읽기 수준에 맞게 다시 써 주는 읽기 앱입니다. 다 읽으면 퀴즈로 이해도를 확인하고,
한 편을 끝낼 때마다 콘에 아이스크림 스쿱이 하나씩 쌓입니다.

## 주요 기능

- **여덟 분야의 글**: 클라우드, 인프라, 데이터, CS 기초, 딥러닝, LLM, AI 보안, 보안. 권리를 확인한 발행처의 글을
  모아 분야별로 나누고, 초급·중급·고급 세 수준으로 다시 씁니다. 수준마다 용어 풀이와 4문항 퀴즈가 붙습니다.
- **Original 기초 콘텐츠**: 분야별 기초 개념을 AI의 도움으로 집필하고 공식 참고자료로 사실을 점검한 글과 퀴즈. 모든 수준에서 같은 본문을 읽고,
  콘에 올린 뒤에도 퀴즈를 반복해서 풀 수 있습니다. 본문과 공식 참고자료는 `content/originals/`에 있습니다.
- **수준 조정**: 온보딩에서 분야별 레벨 퀴즈로 시작 수준을 정하고, 이후 퀴즈 결과에 따라 수준이 오르내립니다.
  설정에서 온보딩을 다시 하면 이미 고른 분야의 퀴즈도 다시 풀 수 있습니다.
- **콘**: 읽은 글이 분야별 색의 스쿱이 되어 한 달짜리 콘에 쌓입니다.
- **크레딧과 꾸미기**: 퀴즈를 처음 완료하면 크레딧이 쌓이고, 콘 배경·토핑·질감·색 팔레트와 배경음악을 살 수 있습니다.
  연속 학습 보상은 기본으로 꺼져 있고 DB 설정(`credit_policy.streak_enabled`)으로 켭니다.
- **단어장·북마크**: 퀴즈까지 마친 글의 용어를 단어장에 모으고, 글을 북마크해 다시 볼 수 있습니다.
- **열람 횟수**: 새 글은 하루 무료 1편이고, 광고를 보면 더 읽을 수 있습니다. 이미 연 글은 횟수를 쓰지 않고 이어 읽습니다.
- **로그인**: 이메일 인증번호 또는 Google 계정. 만 14세 이상 확인 후 가입합니다.

## 기술 스택

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- Supabase: Postgres, 인증(이메일 인증번호·Google), RLS
- LLM: Anthropic SDK 또는 OpenAI 호환 게이트웨이
- Capacitor 8: Android 앱 (정적 번들 + 원격 API)
- Vercel: API와 수집·가공 cron (함수 리전 `icn1`)

## 디렉터리 구조

```
app/                 화면과 API 라우트 (*.api.ts)
  (tabs)/            오늘 · 내 콘 · 단어장 · 나 탭
  api/cron/          수집(ingest)·분야별 가공·정리(cleanup) cron
components/          화면 컴포넌트
content/originals/   Original 기초 콘텐츠의 브리프와 본문(JSON)
lib/ai/              LLM 파이프라인: 분류, 재작성, 용어, 퀴즈
lib/news/            피드·문서 수집, 본문 추출, 권리 자동 검토
lib/supabase/        클라이언트와 타입
supabase/            마이그레이션, RLS 정책, 시드, 메일 양식
android/             Capacitor Android 프로젝트
scripts/             빌드·검사·운영 도구 (check-*.ts가 테스트)
tests/classify/      분류기 정답 세트와 채점기
```

## 시작하기

```bash
npm install
cp .env.example .env.local   # 값을 채운다
npm run dev
```

### 환경 변수

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 프로젝트 주소와 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 키. 클라이언트에 노출하지 않는다 |
| `BASE_URL`, `MODEL_ID`, `API_KEY` | OpenAI 호환 게이트웨이. 셋이 모두 있으면 이쪽을 쓴다 |
| `ANTHROPIC_API_KEY` | 게이트웨이를 쓰지 않을 때 Anthropic 직접 호출 |
| `LLM_MODEL` | 모델 이름 강제 지정 (선택) |
| `CRON_SECRET` | cron 호출 인증. 프로덕션에서는 필수 |
| `AD_REWARD_SECRET` | 광고 보상 검증 서명 키 |
| `INGEST_ARTICLES_PER_DOMAIN` | 분야별 한 번 가공에서 성공시킬 최대 편수 (기본 4) |
| `INGEST_DAILY_BUDGET_USD` | 하루 LLM 예산. 8분야 × 4회로 나눈다 |

### Supabase 준비

1. 새 프로젝트의 SQL 에디터에서 `supabase/migrations/0001_init.sql` → `supabase/policies.sql` →
   나머지 `supabase/migrations/*.sql`(파일 이름 순) → `supabase/seed.sql` 순서로 실행한다.
   이미 운영 중인 DB에는 적용하지 않은 마이그레이션만 하나씩 적용한다. 전체 `db push`는 쓰지 않는다.
2. Authentication에서 이메일과 Google 로그인을 켜고, 익명 로그인은 끈다.
3. URL Configuration
   - Site URL: 배포 주소 (예: `https://artice-cream.vercel.app`)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `<배포 주소>/auth/callback`, `artice-cream://auth/callback`
4. Google OAuth의 Authorized redirect URI는 앱 주소가 아니라 `https://<project-ref>.supabase.co/auth/v1/callback`이다.
5. Email Templates의 Magic Link와 Confirm signup 양식을 `supabase/templates/email-code.html`로 바꾼다.
   메일에 `{{ .Token }}` 인증번호가 보여야 한다. 운영 발송 전에는 SMTP를 따로 설정한다.

## 콘텐츠 수집과 가공

수집 cron이 권리 승인된 발행처의 피드·아카이브에서 새 글을 모으고, 라이선스·저자·글별 예외를 자동 검토한 뒤
분야를 분류합니다. 분야별 가공 cron이 세 수준의 본문·용어·퀴즈를 만듭니다.
소스와 개별 글의 권리 승인 없이는 가공·공개하지 않습니다.

로컬에서 직접 돌리려면:

```bash
AUTH="Authorization: Bearer $CRON_SECRET"
curl -H "$AUTH" http://localhost:3000/api/cron/ingest

for c in cloud infra data cs-fundamentals deep-learning llm ai-security security; do
  curl -H "$AUTH" "http://localhost:3000/api/cron/ingest/$c"
done
```

`CRON_SECRET`이 비어 있으면 로컬에서는 인증을 건너뜁니다(정리 cron 제외). PowerShell에서는 `curl.exe`를 씁니다.
최근 실행 결과는 `npm run report:ingest`로 볼 수 있습니다.

Original 기초 콘텐츠는 cron이 아니라 스크립트로 등록합니다.

```bash
node --import=tsx scripts/publish-originals.ts                                   # 검증만
node --env-file=.env.local --import=tsx scripts/publish-originals.ts --stage     # 비공개 등록
node --env-file=.env.local --import=tsx scripts/publish-originals.ts --publish   # 공개
```

이미 등록된 글의 본문이나 학습 기록은 덮어쓰지 않습니다.

## 스크립트

```bash
npm run dev            # 개발 서버
npm run build          # 프로덕션 빌드
npm run typecheck      # 타입 검사
npm run test:ci        # 전체 검사 (모의 HTTP·DB와 jsdom, 실제 서비스 연결 없음)
npm run test:db        # 임시 Docker PostgreSQL에서 마이그레이션 체인과 RPC 검사 (Docker 필요)
npm run test:classify  # 분류기 정답률 (실제 LLM 호출, 유료)
npm run build:app      # Android용 정적 번들 (out/)
npm run app:run        # 번들 → cap sync → Android 빌드·설치·실행
npm run app:release    # 서명된 릴리스 빌드 (APP_API_BASE와 업로드 키 환경변수 필요)
```

영역별 검사는 `npm run test:<영역>`으로 따로 돌릴 수 있습니다 (예: `test:onboarding`, `test:credits`, `test:reader`).

## 배포

- Vercel에 올리면 `vercel.json`의 cron이 매일 돕니다. 한국 시간 03·09·15·21시에 수집하고, 각 수집 2시간 뒤부터
  30분 간격으로 8분야를 가공합니다. 새벽에는 30일 지난 일일 이용량·광고 기록을 정리합니다.
- DB 함수에 의존하는 API를 배포할 때는 해당 마이그레이션을 **코드보다 먼저** 운영 DB에 적용합니다.
- Android 로그인 정보와 WebView 데이터는 클라우드 백업에서 제외합니다. 새 기기에서는 다시 로그인하면 기록을 불러옵니다.

## 개인정보와 계정 삭제

`/privacy/`와 `/account/delete/`는 로그인 없이 볼 수 있습니다. 계정 삭제는 앱의 **나 → 계정 및 데이터 삭제**에서
본인 확인 후 진행하며, 계정·학습·이용 기록을 삭제합니다.
