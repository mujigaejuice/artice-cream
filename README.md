# artice cream

출시 전 저작권·개인정보 준비 자료는 로컬 `docs/legal/`에서 관리하며 Git 저장소에는 포함하지 않는다.
소스별 권리 검토와 개인정보처리방침은 초안 단계이며, 공개 서비스의 확정 방침이나 이용허락을 뜻하지 않는다.

2026-10-22 외부 문서 확보: Google ML/Cloud·OWASP GenAI/Cheat Sheets·PostgreSQL·D2L의
12개 URL을 확인해 운영 후보로 등록했다. 선정 본문 9개와 보류 3개이며 신규 문서 소스 후보는 3곳이다.
원문·정책 해시, 절 범위, 버전·갱신일, 출처 초안을 기록했고 발행일은 임의로 만들지 않았다.
확보 시에는 모두 `pending`·`restricted`로 등록했다. 이후 문서 cron 경로를 구현했다:
수집 cron이 명시한 URL 목록의 중복·선정 절·현재 라이선스·검토 본문 해시를 확인하고,
분야별 가공 cron은 승인된 본문 스냅샷으로 기존 3수준·퀴즈를 생성한다. 목록 밖 URL과 보류 3개는 제외한다.
문서 소스는 RSS로 수집하지 않는다. 뉴스의 10일 pending 만료 대신 7일마다 재검토하고
검토 권한은 30일 후 만료된다. 변경·검토 실패 시에는 가공·열람을 멈추고 재검토를 기다린다.
수집/가공 권한과 공개 권한은 별도이며, 신규 OWASP/PostgreSQL 공개는 최종 검수 후 활성화한다.
정확한 URL은 `lib/news/document-candidates.ts`, 상세 결과는 로컬
`docs/legal/document-acquisition-20261022.md`, 증거는 `spike-out/document-sources/`에 있다.
`node --import=tsx scripts/audit-document-sources.ts`는 공식 문서와 정책을 조회해 증거만 저장한다.
`node --import=tsx scripts/prepare-document-candidates.ts <증거 폴더>`는 저장된 HTML에서 선정 본문을 재현한다.
`node --import=tsx scripts/check-document-sources.ts`로 절 경계·언어·코드/표 보존·URL 중복 규칙을 검사한다.
`npm run test:documents`는 수집부터 가공까지 모의 cron으로 검사한다. `node --import=tsx scripts/verify-document-cron.ts --live`는 공식 원문 9개를 읽기만 하며 현재 해시·라이선스를 확인한다.
운영 연결 점검은 인증된 `POST /api/cron/ingest?documentsOnly=1`을 사용한다. 문서 검토만 수행하며 RSS·유료 LLM 호출은 없다. 이전 배포는 POST를 거부하므로 실수로 전체 수집을 실행하지 않는다.

계정 삭제는 **나 → 계정 및 데이터 삭제**에서 진행한다. 앱 없이도 `/account/delete/`에서
안내를 읽고 가입한 이메일로 본인 확인을 할 수 있다. 최근 인증과 최종 확인 후 계정·학습·이용 기록을 삭제한다.
`npm run test:account-delete`로 권한·인증·실패 처리를 검사한다(외부 요청 없음).
`npm run test:account-delete-ui`로 삭제 화면의 취소·계정 전환·본인 확인·최종 삭제를 모의 환경에서 검사한다.
계정 삭제의 운영 배포·API 검증은 완료했으며, 실기기 이메일 인증 왕복과 로그/백업 처리 정리는 남아 있다.

콘텐츠는 소스와 개별 글의 권리 승인 후에만 처리·공개한다. Kubernetes·Go·DuckDB·Rust·web.dev·Chrome의 목록 수집 6개를 승인했다.
2026-10-13 운영 DB에 분야별 기사 7편을 추가하여 기존 Go 기사와 함께 8개 분야에 1편씩 공개했다.
공개 글은 모두 수동 가공·검수했으며, 초급·중급·고급 본문 총 24개와 수준별 4문항 퀴즈 총 96개를 제공한다.
온보딩 용어도 공개된 8편의 용어 풀이에서 다시 집계했다.
운영 API로 8개 분야의 세 수준 추천·읽기·퀴즈 조회와 출처 표시, 채점·콘 저장·중복 저장 방지·기사 단위 쿼터를 검증했다.
기존 학습 기록 25건(저장 완료 19건 포함)의 값이 그대로 유지됨을 비교했고, 임시 검증 계정 8개와 해당 기록은 모두 삭제했다.

| 분야 | 공개 주제 | 원문 |
| --- | --- | --- |
| 클라우드 | Cloud Run의 실행 방식 | [Google Cloud](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run) |
| 인프라 | cgroup v2 전환 | [Kubernetes](https://kubernetes.io/blog/2026/10/06/kubernetes-cgroups-v2-shift/) |
| 데이터 | 뷰로 구성한 DuckDB 카탈로그 | [DuckDB](https://duckdb.org/2026/10/07/view-only-mode.html) |
| CS 기초 | Go의 SIMD 지원 | [Go Blog](https://go.dev/blog/archsimd) |
| 딥러닝 | 신경망 활성화 함수 | [Google ML Crash Course](https://developers.google.com/machine-learning/crash-course/neural-networks/activation-functions) |
| LLM | 프롬프트 구성과 개선 | [web.dev](https://web.dev/learn/ai/prompt-engineering) |
| AI 보안 | Model Armor의 검사와 차단 | [Google Cloud](https://docs.cloud.google.com/model-armor/overview) |
| 보안 | 컨테이너 볼륨 권한과 실행 제한 | [Kubernetes](https://kubernetes.io/blog/2026/09/16/kubernetes-v1-37-hardening-container-storage/) |

해당 글의 소스 공개만 활성화했으며 자동 가공 승인은 여전히 0개다. Pickle 이용 조건 확인은 미완료다.
개별 글의 권리 승인과 공개 상태를 함께 검사하므로, 승인되지 않은 기존 가공본은 계속 숨긴다.
새로 등록한 Google Cloud 문서·ML 강좌 소스 2개는 이번에 검수한 글만 수동 공개하며 자동 수집·가공은 허용하지 않는다.
각 글에 출처·저자·라이선스·변경 고지를 보존했다. 원래 발행일이 없는 문서는 갱신일을 발행일로 대체하지 않는다.
콘에는 비공개 기사의 저장된 학습 기록도 표시한다. 분야·완료일·퀴즈 점수를 유지하고,
제목·요약·재열람 링크 대신 ‘현재 열람 불가’를 표시한다. 월 선택으로 지난달 콘도 확인할 수 있다.
콘 API는 인증된 본인의 저장 기록만 서버에서 조회하며, 본문·퀴즈 공개 제한은 그대로 적용한다.
`npm run test:scoops`로 사용자 격리, 비공개 정보 제거, 월 경계·전환과 오류 처리를 검사한다.
`npm run test:rights`로 미확인 콘텐츠의 접근·쓰기·외부 요청 차단을 검사한다.
등록 피드는 기존 40곳과 신규 후보 7곳으로 47곳이다. 수동 문서 소스 2개를 포함한 운영 권리 등록부는 49곳이다.
본문 라이선스 근거가 확인된 조건부 피드 후보는 10곳이다.
후보 등록만으로 수집·공개를 재개하지 않는다.
개별 글 17편의 권리 승인을 완료했으며, 그중 위 8편을 공개했다. 글별 권리 승인 후에도 소스의 가공·공개 승인이 필요하다.

2026-10-14 수집 허용 소스의 공식 아카이브에서 확인한 과거 후보 498편 중 발행일 기준 최신 40편만 등록 대상으로 추렸다.
선정 범위는 2026-08-17~2026-09-24이며, Kubernetes 14편·Rust 10편·DuckDB 8편·Go 5편·web.dev 2편·Chrome Developers 1편이다.
**선정한 40편을 운영 DB에 `pending`·`unreviewed` 상태로 등록했다**. 전체 발견 목록 498편은 참고용으로 보존하고, 등록 목록과 SQL에는 선정한 40편만 포함한다.
기존 URL의 `.html`·끝 슬래시·언어/추적 쿼리 차이까지 비교해 중복을 제외하고, 발행일이 확인되는 글만 선택했다.
사이트맵 갱신일은 발행일로 사용하지 않았다. 후보 목록과 등록 SQL은 로컬 `spike-out/backfill-20261014/`에 있다.
등록 SQL은 현재 수집 권한을 다시 검사하고 기존 글을 덮어쓰지 않으며, 새 글을 `pending`·`unreviewed`로만 추가한다.
등록 후 검증에서 기존 기사 1,560편·학습 기록 25건·공개 기사 8편과 소스 권한 설정이 그대로 유지됨을 확인했다.
후보 등록은 분야 분류·본문 가공·공개 승인과 별개이며, 새 가공본 생성이나 LLM 호출은 없었다. 검증 결과는 같은 폴더의 `verification.json`에 기록했다.

오늘 나온 개발·AI 글을 내 읽기 수준에 맞게 다시 써 주는 읽기 앱. 다 읽으면
퀴즈로 이해도를 확인하고, 한 편을 끝낼 때마다 콘에 아이스크림 스쿱이 하나씩 쌓인다.

## 무엇을 하나

- 등록된 발행처 피드 47곳 중 권리 승인된 곳의 글을 모아 여덟 분류로 나눈다. 분류는 클라우드, 인프라,
  데이터, CS 기초, 딥러닝, LLM, AI 보안, 보안이다.
- 글 한 편을 세 가지 수준으로 다시 쓴다. 수준마다 용어 풀이와 4문항 퀴즈가 붙고,
  용어와 퀴즈는 원문이 아니라 다시 쓴 본문에서 나온다.
- 퀴즈 결과에 따라 다음 글의 수준이 오르내린다.
- 읽은 글은 분류별 색의 스쿱이 되어 한 달짜리 콘에 올라간다.
- 이메일 인증번호나 구글 계정으로 로그인한 뒤 관심 분야를 고른다.
- 하단의 나 탭에서 로그인한 계정을 확인하고 로그아웃해 다른 계정으로 바꿀 수 있다.

## 기술 스택

- Next.js 16, React 19, Tailwind CSS 4
- Supabase: Postgres, 인증(이메일 인증번호·구글), RLS
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

Supabase 프로젝트를 만들고 SQL 에디터에서 아래 파일을 순서대로 실행한다.

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_content_rights.sql`
3. `supabase/migrations/0003_source_candidates.sql`
4. `supabase/migrations/0004_licensed_source_collection.sql`
5. `supabase/migrations/0005_more_licensed_collection.sql`
6. `supabase/policies.sql`
7. `supabase/seed.sql`

기존 DB에는 아직 적용하지 않은 변경만 실행한다. 0002의 기본값은 모든 기존 글의 공개를 제한한다.

Authentication 설정에서 이메일과 Google 로그인을 켜고, 익명 로그인은 끈다.
온보딩은 공개 튜토리얼(읽기 → 용어·퀴즈 → 콘) 다음에 정식 계정 로그인을 받는다.
세션이 없으면 소개를 위해 API 응답을 기다리지 않는다. 설명용 예시는 학습 기록을 만들지 않는다.
앱 시작 주소(`/`)도 비로그인·이전 익명 세션이면 기사 API 없이 소개로 이동한다.
홈의 재조회가 겹쳐도 늦게 도착한 이전 응답이 최신 화면이나 이동 경로를 바꾸지 않는다.
스와이프, 이전·다음 버튼, 키보드 방향키로 이동하며 기존 사용자는 바로 로그인할 수 있다.
가입·로그인 화면에서 만 14세 이상임을 직접 확인한 뒤 이메일 또는 Google로 계속한다.
생년월일은 수집하지 않으며, 이 확인은 신분증·본인인증을 통한 연령 검증과는 다르다.
`npm run test:sign-in-age`로 튜토리얼 이동·예시, 확인 전 로그인 차단과 이메일 흐름을 모의 검사한다.
로그인 메일 발송 뒤 주소 수정·재발송을 할 수 있으며, 중복 클릭은 한 번만 처리한다.
발송 제한과 연결 오류에는 재시도 안내를 표시한다.
`npm run test:entry`로 첫 진입·기존 세션·오류 재시도·화면 복귀 시 응답 순서를 검사한다.

`/privacy/`와 `/account/delete/`는 로그인 없이 읽을 수 있다.
개인정보 페이지는 현재 **공개 전 검토용 초안**으로 표시하고 검색 색인을 차단한다.
실제 제공사 로그·백업, 인증 메일 업체·국외 이전 상세, 책임자·시행일을 확정한 뒤
본문과 초안 표시·robots 설정을 함께 갱신해야 심사 제출용 방침으로 사용할 수 있다.

Authentication → URL Configuration에는 다음 주소를 등록한다.

- Site URL: `https://artice-cream.vercel.app`
- Redirect URLs: `http://localhost:3000/auth/callback`,
  `https://artice-cream.vercel.app/auth/callback`, `artice-cream://auth/callback`

Google OAuth의 Authorized redirect URI는 앱 주소가 아니라
`https://<project-ref>.supabase.co/auth/v1/callback`이다.
이메일 로그인과 계정 삭제 본인 확인은 메일의 인증번호를 요청한 화면에 입력한다.
`verifyOtp({ email, token, type: "email" })`가 그 브라우저·앱에 세션을 만들므로
메일은 다른 브라우저나 기기에서 읽어도 된다. Google 로그인에는 기존 PKCE 콜백을 사용한다.

**이메일 인증번호 전환 시 Supabase 설정도 필요하다.** Authentication → Email Templates의
Magic Link와 Confirm signup 양식을 `supabase/templates/email-code.html`로 설정하고
제목은 `artice cream 인증번호`로 지정한다. 기존 계정과 신규 가입 모두 `{{ .Token }}`이
메일에 표시되어야 한다. 번호 입력은 프로젝트에서 설정한 6~10자리 숫자를 받는다.
발송 제한과 만료 시간은 Supabase 설정을 따른다.

운영 전환은 기존 링크에 인증번호를 추가한 임시 메일 양식 → 웹 배포·앱 업데이트 →
신규/기존 계정 및 삭제 본인 확인 검증 → 번호 전용 양식 적용 순으로 진행한다.
이전 앱 버전의 링크 로그인이 필요하면 해당 버전이 교체될 때까지 링크를 함께 유지한다.
코드 배포만으로 운영 메일 양식이 바뀌지는 않는다.

LLM은 `.env.local`에 `BASE_URL`, `MODEL_ID`, `API_KEY`가 모두 있으면 OpenAI 호환
게이트웨이로, 없으면 `ANTHROPIC_API_KEY`로 Anthropic을 직접 부른다.

```bash
npm run dev
```

현재 공개한 기사 8편은 선택한 관심 분야와 읽기 수준에 맞춰 홈에 표시된다. 이미 저장한 글은 다시 추천하지 않으므로,
분야별 1편을 모두 저장한 뒤에는 추가 공개 전까지 새 글 목록이 비어 있을 수 있다.
수집만 허용한 소스는 기사 목록을 모은다. 가공이 허용된 소스의 글은 수집 cron이
원문의 라이선스 표시·저자·글별 예외를 자동 검사해 승인하고, 같은 실행에서 분류한다.
이후 분야별 cron이 본문·용어·퀴즈를 생성한다. 글마다 수동으로 동의할 필요가 없다.
자동 검토 대상은 Kubernetes·Go·DuckDB·Rust·web.dev·Chrome for Developers·Google Cloud 문서·Google ML 문서다.
기존 미검토 pending도 회당 최대 32편씩 처리한다. 조건 불충족·통신 실패는 사유를 남기고
12시간 이후 다시 검사하며, 다른 글은 계속 진행한다. 차단·제한된 글은 자동 승인하지 않는다.
공개 여부는 소스의 `allow_publish` 설정을 따른다. 자동 검토는 소스 허용 설정을 변경하지 않는다.
수집 응답/로그의 `autoReview`에서 검토·승인·보류·시간 부족과 사유별 건수를 확인할 수 있다.
분류 요청은 배치당 최대 60초이며 함수의 남은 시간도 함께 적용한다. 분류·권한 조회·저장
실패나 분류 시간 부족은 HTTP 503과 `ok: false`로 반환한다. `runId`,
`classificationCandidates`, `classifyFailed`, `failures`로 승인 이후 중단 지점을 확인한다.
분류 실패 시 나머지 배치는 호출하지 않으며, 미분류 글은 다음 실행에 다시 시도한다.

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
npm run test:ingest    # 4편 상한, 병렬 처리, 타임아웃, 저장 검증 (모의 LLM·DB)
npm run test:auto-review # 소스별 자동 승인, 철회·재시도·기존 대기열 분류 검증 (모의 HTTP)
npm run test:quota     # 읽기·광고 보상 API의 오류 및 재시도 검증 (모의 HTTP)
npm run test:quota-db  # 임시 Docker PostgreSQL에서 동시 요청·롤백·권한 검증
npm run test:classify  # 분류기 정답률 (LLM 호출, 유료)
npm run build:app      # 앱용 정적 번들 (out/)
npm run app:run        # 번들 → cap sync → 안드로이드 빌드·설치·실행
```

## 배포

읽기 횟수·광고 보상 API를 배포하기 전에 `supabase/migrations/0006_atomic_quota.sql`을 적용한다.
무료 1회와 광고 보상 최대 3회는 DB의 KST 날짜를 기준으로 계산한다. 같은 사용자의 열람과 보상은
DB 잠금으로 순서대로 처리하며, 열람 기록·횟수 차감과 광고 기록·보상 지급은 각각 함께 커밋한다.
같은 글의 재열람·수준 변경은 추가 차감하지 않으며, 유효한 보상 nonce를 재전송하면 중복 지급 없이
현재 잔여 횟수를 반환한다. DB 오류는 503으로 응답하고 열람을 허용하지 않는다.
`test:quota-db`는 별도 임시 컨테이너만 사용하고 종료 시 제거하며 운영 DB에는 연결하지 않는다.

2026-10-17 운영 DB에 `0006_atomic_quota.sql`을 적용했다. `supabase/tests/atomic_quota.sql`로
실제 서비스 역할의 열람 차감·재열람·보상 재시도·일일 상한과 함수 접근 권한을 검증했고,
검증용 계정과 이용 기록은 전부 롤백했다. 적용 전후 기존 프로필·학습·일일 횟수·광고 기록 건수가 일치했다.
아래 읽기 전용 검증은 운영 REST 경로의 함수 등록·응답 형식·비로그인 호출 차단을 확인한다.
존재하지 않는 임의 사용자 ID를 사용하므로 계정이나 이용 기록을 생성하지 않는다.

```bash
node --env-file=.env.local --import=tsx scripts/verify-quota-rpc.ts --production
```

Vercel에 올리면 `vercel.json`의 cron 10개가 매일 돈다. 한국 시간 오전 3시에 수집하고,
오전 5시부터 8시 반까지 30분 간격으로 분류 하나씩 가공한다. 프로덕션에서는
`CRON_SECRET`이 있어야 cron 호출이 통과한다.

오전 4시 15분에는 `/api/cron/cleanup`이 30일이 지난 일일 이용량(`daily_quota`)과 추가 열람 기록(`ad_views`)을 삭제한다.
날짜만 있는 이용량은 KST 기준 30일 전 날짜보다 오래된 행, 시각이 있는 추가 열람은 실행 시각 기준 30일보다 오래된 행을 지운다.
계정·읽기·저장·콘 기록은 탈퇴 전까지 유지하며 이 정리 대상에 포함하지 않는다. `CRON_SECRET`은 로컬 실행에도 필수다.
새 DB 마이그레이션 없이 배포 후 실행되며, `npm run test:retention`은 모의 DB로 범위·인증·경계·재시도를 검사한다.

Android 로그인 정보와 WebView 데이터는 클라우드 백업·기기 간 이전에서 제외한다.
새 기기에서는 다시 로그인하면 서버에 저장된 기록을 불러온다. 제공사 측 로그·DB 백업 보관기간은 운영 플랜과 설정을 별도로 확인한다.

`INGEST_ARTICLES_PER_DOMAIN`은 분류별 한 실행의 성공 상한이다. 가공은 기사 최대 2편,
각 기사의 세 수준을 병렬 생성하며 발행처당 성공은 한 편으로 제한한다.
LLM 요청은 실행 인스턴스당 최대 6개다(여러 인스턴스를 아우르는 전역 제한은 아니다).
새 기사 시작에는 110초가 남아 있어야 한다. 본문 요청은 20초, 기사 전체 작업은
최대 240초이며 실행의 남은 시간에서 15초를 뺀 값보다 길게 실행하지 않는다.
함수 상한 300초 중 30초 안전 여유도 별도로 유지한다.
값을 4로 올려도 후보 부족·시간 제한·가공 실패가 있으면 4편보다 적게 끝날 수 있다.
가공 중 게이트웨이의 429·502·503·504는 같은 기사 시간 제한 안에서 한 번만 재시도한다.

실행 로그의 `[ingest:process:start]`에서 `articleCap`을 확인하면 환경변수 변경이
실행에 반영됐는지 알 수 있다. `articleConcurrency`, `llmConcurrency`,
`articleStartSeconds`, `articleTimeoutSeconds`도 함께 기록한다.
`[ingest:process]`에는 `processed`, `stoppedBy`,
전체 `queueDepth`, 조회한 `scanned`, 실패 내역과 사용량을 남긴다.
`usage.retries`로 일시 오류 재시도 횟수를 확인할 수 있다. 개별 기사는
`[ingest:article:start]`, `[ingest:article:ready]`, `[ingest:article:failed]`로 추적한다.
`[llm:trace]`는 `runId`·`articleId`·`level`·`stage`별 호출을 기록한다.
`queueMs`는 동시 요청 슬롯 대기, `requestMs`는 API 응답 시간이다. `pass: length`는
분량 재요청, `repair: true`는 JSON 보정이며 `finishReason`과 `outputTokens`도 남긴다.
프롬프트·본문·인증 정보는 이 로그에 넣지 않는다. 잘못된 `keyParagraphs`는 중요 문단
표시만 생략하며, 이 선택적 표시 때문에 본문을 재생성하지 않는다.
문자열 내부의 이스케이프되지 않은 줄바꿈은 내용을 유지한 채 JSON 형식으로 정규화한다.
분량 보정 응답이 형식 검증에 실패하면 이미 검증된 초안을 유지한다. 최초 본문과 퀴즈의
검증 실패, API 오류, 실행 시간 초과는 그대로 실패로 처리한다.

읽기 전용 진단은 다음 순서로 실행한다. 결과는 Git에서 제외한 `spike-out/`에 저장된다.

```bash
node --env-file=.env.local --import=tsx scripts/audit-ingest.ts # DB 상태·날짜별 가공 수
node --import=tsx scripts/probe-ingest.ts                     # 원문 표본 재검사
node --import=tsx scripts/audit-source-candidates.ts           # 후보 피드·권리 근거·표본 검사, DB/LLM 호출 없음
node --env-file=.env.local --import=tsx scripts/benchmark-ingest.ts --two
node --env-file=.env.local --import=tsx scripts/benchmark-ingest.ts --article=1400
node --env-file=.env.local --import=tsx scripts/benchmark-ingest.ts --four
```

벤치마크는 실제 LLM을 호출하며 DB에는 저장하지 않는다. 기본 1편, `--two`는 2편,
`--four`는 4편 상한이며 `--article=<ID>`는 감사 보고서의 특정 기사 한 편이다.
단계별 계측은 `.jsonl`에도 즉시 기록하고 완료된 가공본은 `.variants.json`에 저장한다.

배포 후 운영 검증은 `node --env-file=.env.local --import=tsx scripts/verify-ingest-production.ts --run-cloud`로
실행한다. 이 명령은 **운영 cloud 가공을 한 번 실행해 DB에 저장**하며, 적용된 상한·새 ready 기사·
세 수준의 가공본·퀴즈 각 4개를 확인한다. 오류가 나도 자동으로 재실행하지 않는다.
