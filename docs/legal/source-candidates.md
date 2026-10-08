# 공개 라이선스 소스 후보 검토

확인일: 2026-10-08. 기존 40개를 유지하고 새 후보 7개를 등록해 목록을 47개로 늘렸다. **정확한 라이선스와 본문 적용 근거를 확보한 조건부 후보는 10개**다. CNCF·InfoQ·PyTorch는 이 수에 포함하지 않는다.

후속 변경: [수집 재개·개별 글 검토](licensed-collection.md)로 Kubernetes·Go의 목록 수집 2개와 개별 글의 본문 권리 2편을 승인했다. 아래 0003 적용 당시의 승인 0개 기록은 초기 스냅샷이다. 현재 가공·공개 소스 승인은 계속 0개다.

아래는 상업적 번역·재작성에 사용할 수 있는 공개 허락 근거와 그 조건이다. 후보 등록이 모든 글의 승인이나 외부 AI 제공사 처리 조건 확인을 대신하지 않는다. [권리 게이트](content-rights-gate.md)의 소스·개별 글 승인 절차를 유지한다.

## 적용 범위와 필수 표시

| 소스 | 본문 허락 근거 | 적용 범위·주의할 예외 | 필수 표시·배포 조건 |
|---|---|---|---|
| Kubernetes (기존) | [website LICENSE: CC BY 4.0](https://github.com/kubernetes/website/blob/main/LICENSE) | 최신 글의 footer와 해당 저장소의 영어 블로그 파일 대응 확인. 외부 인용·이미지·코드는 별도 | 저자·원제·원문 링크·CC BY 4.0 링크·변경 표시·제공된 고지 보존 |
| OWASP GenAI (기존) | [사이트 고지: CC BY-SA 4.0](https://genai.owasp.org/contributing/) | 실제 기사 footer에도 별도 표시 없는 사이트 콘텐츠의 허락이 있음. 프로젝트 코드 라이선스와 구분 | 공동 기여자·출처·라이선스·변경·저작권·면책 고지. 원문의 표현을 활용한 번역·재작성과 파생 자료는 BY-SA 4.0 |
| DuckDB (기존) | [duckdb-web LICENSE: MIT](https://github.com/duckdb/duckdb-web/blob/main/LICENSE) | DB 소프트웨어 라이선스가 아니라 **웹사이트 저장소**의 `_posts`와 실제 글을 대조. 최신 글 대응 확인 | 저자·출처·변경 표시와 Stichting DuckDB Foundation 저작권·MIT 허락문·면책문 **전문** 보존. 라이선스 링크만으로 대체하지 않음 |
| Mozilla Hacks (신규) | [실제 글 footer: CC BY-SA 3.0 또는 이후 버전](https://hacks.mozilla.org/2026/08/intent-to-ship-jpeg-xl/) | 글별 별도 표시·외부 자료 제외. 제공자가 이후 버전을 허용하므로 가공본은 BY-SA 4.0 선택 가능 | 원문 3.0 이상 조건과 원문 저자·링크·변경 고지 보존, 가공본 BY-SA 4.0 표시 |
| web.dev (신규) | [Google 사이트 정책](https://developers.google.com/terms/site-policies), [실제 글의 CC BY 4.0 고지](https://web.dev/blog/web-platform-05-2026?hl=en) | **그 고지가 있는 페이지** 본문에 적용. 코드 Apache 2.0·로고·외부 매체 등은 별도 | 실제 저자·Google 제공 원문·원문 링크·CC BY 4.0·번역/수정 사실·정책 링크 표시 |
| Chrome for Developers (신규) | [Google 사이트 정책](https://developers.google.com/terms/site-policies), [실제 글의 CC BY 4.0 고지](https://developer.chrome.com/blog/agent-ready-toolkit?hl=en) | 해당 글의 고지와 예외 확인. Cloud·Research·DeepMind 등 다른 Google 블로그에 확대하지 않음 | web.dev와 같은 저자·Google·원문·라이선스·변경 표시 |
| Rust Blog (신규) | [README의 블로그 MIT/Apache 2.0 명시](https://github.com/rust-lang/blog.rust-lang.org/blob/main/README.md), [LICENSE-MIT](https://github.com/rust-lang/blog.rust-lang.org/blob/main/LICENSE-MIT) | 본문 저장소 최신 글 대응 확인. 두 라이선스 중 MIT 선택. 글별 인용·코드·매체의 예외 검토 | 실제 저자·출처·변경 표시와 제공된 저작권·MIT 허락문·면책문 전문 보존 |
| Go Blog (신규) | [go.dev/copyright: 본문 CC BY 4.0](https://go.dev/copyright) | 실제 글 footer가 이 고지로 연결됨. 코드의 BSD와 본문 CC를 구분 | 모든 저자·Go/Google 크레딧·원문·CC BY 4.0·번역/변경 사실·기존 고지 |
| Fedora Magazine (신규) | [약관 6·7항: CC BY-SA 4.0](https://fedoramagazine.org/terms-and-conditions/) | Red Hat 원저작물·기여자 허락 범위. footer는 모든 글이 CC라는 보장을 하지 않음. 공동 저자와 글별 예외 검토 필수 | `By [author’s screen name] from Fedora Magazine`과 원문 영구 링크, 공동 저자·변경·라이선스 고지. 가공본 BY-SA 4.0 |
| Wikimedia Diff Technology (신규) | [편집 지침의 본문 CC BY-SA 4.0 명시](https://diff.wikimedia.org/editorial-guidelines/) | 실제 글 footer 확인. Technology 피드로 한정. Commons 이미지·외부 링크는 개별 라이선스 | 저자·원문·CC BY-SA 4.0·변경·기존 고지. 가공본 BY-SA 4.0 |

공통으로 한국어 번역, 요약, 난이도별 재작성, 용어 풀이·퀴즈 추가 사실을 표시한다. 원문의 인용·기여자·기존 변경 고지와 면책문을 보존하고 저자의 보증이나 후원으로 표현하지 않는다. 이번 후보 검토는 **본문 텍스트**를 대상으로 하며 발행처 이미지·코드·댓글의 일괄 사용을 허락하지 않는다.

BY-SA 조건은 해당 가공 콘텐츠와 원문 표현을 활용한 파생 학습 자료에 적용한다. 앱 코드 전체의 라이선스를 바꾸는 요구는 아니다. 해당 콘텐츠의 재이용 권한을 막는 추가 계약 조건이나 DRM을 붙이지 않아야 한다. 상업 이용 자체는 금지되지 않는다. [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## 실제 글과 저장소 대응

저장소 라이선스만 발견하고 사이트 전체를 승인하지 않았다. 다음 표본은 원문 제목과 본문·저자 대응을 확인했다. 이후 글도 개별 대응을 확인한다.

| 소스 | 실제 글 표본 | 동일 글의 저장소 원문 |
|---|---|---|
| Kubernetes | [cgroup v2 전환, 2026-10-06](https://kubernetes.io/blog/2026/10/06/kubernetes-cgroups-v2-shift/) | [영어 블로그 원문](https://github.com/kubernetes/website/blob/main/content/en/blog/_posts/2026/kubernetes-cgroups-v2-shift.md) |
| DuckDB | [A DuckDB Database with No Data in It, 2026-10-07](https://duckdb.org/2026/10/07/view-only-mode) | [_posts 원문](https://github.com/duckdb/duckdb-web/blob/main/_posts/2026-10-07-view-only-mode.md) |
| Rust | [Demoting i686 Windows targets to std-only, 2026-10-02](https://blog.rust-lang.org/2026/10/02/demoting-i686-windows-targets-to-std-only/) | [content 원문](https://github.com/rust-lang/blog.rust-lang.org/blob/main/content/demoting-i686-windows-targets-to-std-only.md) |

## 피드와 공급량 검증

앱의 RSS/Atom 파서로 10개 피드 모두 HTTP 200과 실제 기사 목록을 확인했다. 날짜는 2026-10-08 검사 시점의 **피드에 실린 발행일**이며 사이트 전체 발행량이나 매일 들어올 글 수를 뜻하지 않는다.

| 소스 | 등록 피드 | 피드 항목 수 | 최근 14일 | 피드 최신 발행일·활용 |
|---|---|---:|---:|---|
| Kubernetes | [RSS](https://kubernetes.io/feed.xml) | 50 | 2 | 10-06, 최근 글 |
| OWASP GenAI | [RSS](https://genai.owasp.org/feed/) | 10 | 0 | 09-01, 45일 보조 창 안 |
| DuckDB | [RSS](https://duckdb.org/feed.xml) | 10 | 6 | 10-07, 최근 글 |
| Mozilla Hacks | [RSS](https://hacks.mozilla.org/feed/) | 20 | 0 | 08-24, 피드의 과거 글 후보 |
| web.dev | [RSS](https://web.dev/feed.xml) | 10 | 0 | 05-29, 피드의 과거 글 후보 |
| Chrome for Developers | [공식 RSS](https://developer.chrome.com/static/blog/feed.xml) | 10 | 0 | 06-22, 피드의 과거 글 후보 |
| Rust Blog | [RSS](https://blog.rust-lang.org/feed.xml) | 10 | 2 | 10-02, 최근 글 |
| Go Blog | [Atom](https://go.dev/blog/feed.atom) | 10 | 1 | 10-02, 최근 글 |
| Fedora Magazine | [RSS](https://fedoramagazine.org/feed/) | 10 | 2 | 10-07, 최근 글·개별 예외 확인 |
| Wikimedia Diff Technology | [RSS](https://diff.wikimedia.org/category/technology/feed/) | 10 | 6 | 10-06, 최근 글·언어/기술 주제 확인 |

Chrome의 `/feeds/blog.xml`은 404였다. 공식 블로그가 안내하는 `/static/blog/feed.xml`로 수정해 검사를 통과했다. Mozilla·web.dev·Chrome의 현재 피드는 최근 45일 창 밖이어서 `archive`를 등록했다. 이는 **피드에 남아 있는 10~20개 과거 항목**을 후보로 받는 설정이며 전체 과거 글을 크롤링하는 설정이 아니다. 본문 수집·분류·가공은 권리 승인 후에만 실행된다.

## 보류한 근거와 다음 승인

- CNCF 기고 지침은 CC Attribution을 요구하지만 정확한 버전과 현재 글별 적용을 더 확인해야 한다.
- PyTorch의 이전 사이트 저장소 BSD 라이선스를 현재 WordPress 신규 글에 자동 적용하지 않는다.
- Hugging Face 공개 블로그 저장소의 존재나 모델 라이선스를 본문 재배포 허락으로 간주하지 않는다.
- Eli Bendersky의 public domain 표시는 코드 범위이며 장문 본문에 확대하지 않는다.
- Lemire 기존 6편은 출처·내용 보완 이후에도 기존 CC BY 3.0 위반의 재공개 근거와 게스트 저자 범위 확인이 남아 있다.

처음 재개할 후보는 표시 조건이 비교적 단순하고 최근 공급이 확인된 **Kubernetes·Go**다. DuckDB·Rust는 MIT 전문 고지 보존을 확인한 뒤, BY-SA 후보는 가공본·퀴즈의 라이선스 표시와 재이용 조건까지 확인해 승인한다. 실제 외부 AI 제공사의 처리·보관·하위 제공 범위 확인이 공통으로 남아 있다.

후보의 구조화된 조건은 [source-candidates.ts](../../lib/news/source-candidates.ts), DB 등록은 [0003_source_candidates.sql](../../supabase/migrations/0003_source_candidates.sql)에 있다. 신규 7개와 기존 DuckDB를 `restricted`로 기록하며 수집·가공·공개 플래그는 켜지 않는다. 기존 승인·차단 결정과 모든 기사·가공본·퀴즈는 변경하지 않는다.

읽기 전용 재검사:

```bash
node --import=tsx scripts/audit-source-candidates.ts
```

결과는 Git에서 제외한 `spike-out/source-candidates/*.json`에 피드 수·발행일·표본 링크·라이선스 고지 발췌·응답 해시로 저장한다. 이 스크립트는 DB를 쓰거나 LLM을 호출하지 않고 승인도 부여하지 않는다. HTTP 응답과 제목 확인만으로 법적 승인이나 전문 내용 검토가 자동 완료되는 것은 아니다.

운영 DB에 0003을 적용하고 전후 값을 대조했다. 총 48개(현재 등록 47 + 과거 `woowahan`), `restricted` 16개·`unreviewed` 32개, 운영 승인 0개·개별 글 승인 0개다. 검토 대상 외 소스 행과 기존 허용 플래그는 그대로이며 기사 1,538개·가공본 258개·퀴즈 문항 1,032개가 보존됐다. 타입 검사·권리 차단 테스트·인제스트 회귀 테스트·프로덕션 빌드를 통과했다. 저장소와 실제 본문의 텍스트 구절 대응도 Kubernetes 26개·DuckDB 36개·Rust 5개를 확인했다.
