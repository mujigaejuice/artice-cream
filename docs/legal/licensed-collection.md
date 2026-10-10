# 수집 재개와 개별 글 검토

최신 승인 기록(2026-10-09): **6개 소스의 메타데이터 수집과 개별 글 13편의 본문 권리**를 승인했다. 가공·공개 소스 승인은 각각 0개다. 추가 승인 내역은 아래 10-09 기록을 따른다.

2026-10-08에는 Kubernetes·Go의 메타데이터 수집 2개를 승인했다. 최신 글 3편 중 2편의 본문 이용 권리·필수 표시를 운영 DB에 반영했고, 1편은 당시 본문 길이 상한 밖이었다.

## 수집과 가공의 분리

이전 수집 크론은 `allow_collect`와 `allow_process`를 함께 요구했다. 이제 목록 수집에는 수집 승인만 요구하고, LLM 분류에는 별도로 가공 승인 소스와 개별 승인 글을 요구한다. 이미 저장된 승인 글은 피드를 다시 수집하지 않고도 분류할 수 있다.

새로 발견한 글은 계속 `unreviewed`로 저장한다. 제목·URL·발행일·소스만 기록하며 RSS 요약은 저장하거나 미확인 상태로 LLM에 전달하지 않는다. 메타데이터만 수집하는 실행은 분류·가공 대기열의 상태와 만료일을 변경하지 않는다. 가공 대기열 만료는 가공 승인 소스의 개별 승인·분야 지정 글에만 적용한다.

[0004_licensed_source_collection.sql](../../supabase/migrations/0004_licensed_source_collection.sql)은 두 소스의 `allow_collect`만 켠다. 다른 소스·개별 글·가공본·문항은 변경하지 않는다. 개별 글은 별도 검토 SQL로 지정 URL·상태·이전 값을 대조한 후 승인했다.

## 2026-10-08 글별 결과

| 글 | 저자·본문 권리 근거 | 검토 결과 |
|---|---|---|
| Kubernetes: [Scaling Kubernetes Workloads with Node Swap](https://kubernetes.io/blog/2026/10/05/scaling-kubernetes-workloads-with-node-swap/) | Ocean Xie, Yuan Wang. 실제 footer의 CC BY 4.0과 [website LICENSE](https://github.com/kubernetes/website/blob/main/LICENSE) | 기사 1605, 본문 권리 `permitted`, `pending` 유지. 코드·미디어 제외 후 8,610자. 그림 1개 제외. 별도 라이선스 고지·인용 블록 없음 |
| Go: [Arch-specific SIMD in Go](https://go.dev/blog/archsimd) | Junyang Shao, David Chase. 실제 글 footer가 연결하는 [go.dev/copyright](https://go.dev/copyright)의 본문 CC BY 4.0 | 기사 1825, 본문 권리 `permitted`, `pending` 유지. 코드 제외 후 10,713자. 코드의 BSD와 본문 라이선스 구분, 별도 고지·인용 블록 없음 |
| Kubernetes: [The Shift to cgroup v2 in Kubernetes](https://kubernetes.io/blog/2026/10/06/kubernetes-cgroups-v2-shift/) | Paco Xu (DaoCloud). CC BY 4.0 표시 확인 | 당시 상한 12,000자를 넘는 13,133자로 보류. 10-09 상한을 15,000자로 올린 뒤 기사 1824로 권리 승인(아래 추가 승인 기록) |

승인한 2편에는 실제 저자·원제·원문 링크·CC BY 4.0 링크·번역/재작성/용어·퀴즈 추가 표시를 준비했다. Kubernetes footer의 저작권 주체·연도·프로젝트 정책과 Go/Google 크레딧·사이트 정책도 기록했다. 원문 이미지·코드·댓글은 제공하지 않는다. 노드 스왑 글의 성능 수치는 특정 시험 환경의 결과로 다루고, Go SIMD는 실험적 기능임을 가공 결과 검토 때 확인한다.

글의 권리 `permitted`는 공개 상태를 뜻하지 않는다. 현재 소스의 `allow_process`·`allow_publish`가 false이고 글도 `pending`이므로 본문 요청·LLM 분류/가공·독자 접근은 계속 차단된다.

## Pickle 제공사 확인

사용자가 알려준 [Pickle](https://pickle.pusan.ac.kr/)의 공개 앱·정책 API·사용 가이드를 확인했다. 공식 가이드가 `https://llm.pcl.kr/v1`과 `pickle-general`을 안내하므로 현재 코드 설정과의 연결이 확인된다. [LLM 신청 안내](https://pickle.pusan.ac.kr/docs/llm/start), [연결 안내](https://pickle.pusan.ac.kr/docs/llm/connect).

- 공식 안내상 `pickle-general`은 학교가 직접 서빙하는 모델이며 외부 유료 모델과 구분된다. 모델 이름만 보고 Anthropic/OpenAI/OpenRouter에 전달된다고 단정하지 않는다.
- [이용약관](https://pickle.pusan.ac.kr/terms/TERMS_OF_SERVICE), [공개 원문 API](https://pickle.pusan.ac.kr/api/v1/meta/terms/TERMS_OF_SERVICE)는 개발·교육용 인프라와 신청·승인 체계를 설명한다. 개별 API 키의 승인된 용도는 공개 문서만으로 확인되지 않았다.
- [개인정보처리방침](https://pickle.pusan.ac.kr/terms/PRIVACY_POLICY), [공개 원문 API](https://pickle.pusan.ac.kr/api/v1/meta/terms/PRIVACY_POLICY)의 v1 시행일은 2026-07-30이다. Pickle 계정 레코드와 감사 로그를 영구 보존한다고 명시한다. 이 설명을 기사 입력·모델 학습 사용·우리 앱 이용자 데이터의 보관 조건으로 확대하지 않는다.
- 공개 키 설정 안내에는 본문 기록을 켜면 프롬프트·응답을 30일 보관하고 키 접근 권한자가 열람할 수 있다고 나온다. 현재 키의 실제 설정과 기존 기록 상태는 확인되지 않았다. 공식 [키 설정 안내](https://pickle.pusan.ac.kr/docs/llm/limits).

현재 키의 본문 기록 상태와 신청·승인된 이용 용도를 사용자에게 확인 요청했다. 가공 재개 시 확인된 범위만 승인하고, 회원 이메일·인증 토큰·학습/퀴즈 기록은 LLM 입력에 추가하지 않는다. 가공본 생성 후 세 수준의 본문·문항·출처 표시를 검토하고 공개 승인을 별도로 적용한다.

## 적용과 검증

운영 DB에서 실제 코드로 피드 2곳의 최신 목록 3개를 읽고 새 메타데이터 2개를 추가했다. 기사 1,538 → 1,540개, 가공본 258개·퀴즈 문항 1,032개는 보존됐다. 이 실행의 LLM 호출·분류·대기열 만료는 모두 0이었다. 지정된 두 글만 권리 승인했고 나머지 글은 일괄 승인하지 않았다.

타입 검사, 권리 API·수집 분리 회귀 검사, 인제스트 회귀 검사와 프로덕션 빌드가 통과했다. 수집만 승인한 경우에는 LLM·대기열 갱신이 없고, 가공만 승인한 경우에는 피드를 열지 않고 기존 승인 글을 분류하는 것을 검사했다.

재검사 도구:

```bash
node --env-file=.env.local --import=tsx scripts/audit-licensed-articles.ts
node --env-file=.env.local --import=tsx scripts/verify-content-rights.ts --production
```

첫 명령은 읽기 전용이며 결과는 로컬 `spike-out/licensed-review`에 저장한다. 둘째 명령은 전용 시험 계정을 생성·정리하고 실제 API·RLS·크론을 검사한다. 수집 승인이 있으면 목록 수집 크론은 새 기사 메타데이터를 저장할 수 있지만 본문·가공본·문항은 변경하지 않는다. [prepare-licensed-review.ts](../../scripts/prepare-licensed-review.ts)는 이번 두 글의 로컬 검토 결과로 승인 SQL과 이전 값 백업을 준비하며, 이미 승인한 글에 재실행하면 중단한다.

## 2026-10-09 추가 승인

[0005_more_licensed_collection.sql](../../supabase/migrations/0005_more_licensed_collection.sql)로 DuckDB·Rust·web.dev·Chrome for Developers의 **메타데이터 수집 4개**를 승인했다(`permitted`, `allow_collect=true`). 가공·공개 소스 승인은 여전히 0개다. 본문 길이 상한은 블로그에 한해 12,000자에서 15,000자로 올렸다(뉴스는 12,000자 유지).

개별 글 11편은 현재 게시 원문과 저장소 원문을 대조해 승인했다. 승인 조건은 본문 라이선스 근거, 저자 표시 일치, blockquote(제3자 인용) 없음, 본문 안 권리 고지 없음, 15,000자 이하 추출이다. 본문 안에서 "permission" 같은 단어가 잡힌 글은 사람이 문맥을 읽었다(Kubernetes 532는 Unix 파일 퍼미션, web.dev 1826은 브라우저 기능 이름).

| 소스 | 승인한 글 | 근거 |
|---|---|---|
| Kubernetes (CC BY 4.0) | 530, 531, 532, 533, 1824 | 글의 CC BY 4.0 footer와 website LICENSE 링크, 글 화면의 저자 표기. 530과 1824는 상한을 올려 대상이 됐다 |
| DuckDB (MIT) | 1822, 819 | duckdb-web 저장소 `_posts` 원문의 front matter 저자·제목 일치, 저장소 LICENSE(Stichting DuckDB Foundation). MIT 허락문 전문을 글의 필수 표시에 보존 |
| Rust Blog (MIT/Apache 2.0 중 MIT) | 1828, 1829 | 저장소 README의 블로그 라이선스 문구, `content/` 원문의 `authors`·제목 일치, LICENSE-MIT 전문을 필수 표시에 보존 |
| web.dev (CC BY 4.0) | 1826 | 페이지의 "Except as otherwise noted…" 고지(본문 CC BY 4.0, 코드 Apache 2.0), 페이지의 저자 블록 |
| Chrome for Developers (CC BY 4.0) | 1827 | web.dev와 같은 페이지 고지와 저자 블록 |

**제외한 글과 이유**
- DuckDB 5일자 Java 글: 본문이 "Guest blog post by a DuckDB user"로 시작한다. 저장소 MIT가 그 글쓴이의 문장까지 덮는지 확인되지 않아 제외했다.
- DuckDB 988(Jev)·820(dbt): 본문에 제3자 인용(blockquote)이 있다. 앞선 승인과 같은 기준(인용 0개)을 적용해 제외했다.
- 15,000자 초과: Mozilla Hacks PACT 글(약 23천자), OWASP GenAI 3분기 요약(약 32천자).

**승인하지 않은 소스**
- CNCF: 페이지에 "All rights reserved"만 있고 CC 표시가 없다. 기고 지침의 CC 문구와 글 페이지 표시가 어긋나므로 근거를 더 확인하기 전에는 승인하지 않는다.
- Fedora Magazine: 약관이 "모든 콘텐츠를 CC로 내려 하나 항상 그럴 수는 없다"고 한다. 글별 보장이 없으므로 보류한다.
- Mozilla Hacks·OWASP GenAI·Wikimedia(CC BY-SA): 파생물에 ShareAlike를 적용해야 하는 서비스 조건(로그인 필수·광고)과의 정합성 판단이 필요해 당분간 제외한다.

**적용과 검증**: 소스 4곳의 변경과 글 승인에 현재 값 대조 가드를 두고 적용했다. 로컬 검증 기록의 첫 배치에는 7편, 둘째 배치에는 4편의 승인이 남아 있다. 각 배치의 적용 전 스냅샷과 비교해 의도한 소스·글의 권리 상태 변경과 글/가공본/퀴즈 수 보존을 확인했다. 두 배치 사이 목록 수집을 한 번 실행해 메타데이터 4건을 추가했고 LLM 호출·분류·대기열 만료는 0이었다. 최종 기사 1,544개, 가공본 258개, 퀴즈 1,032개다. 승인 글 13편은 모두 `pending`이고 가공·공개 판정은 거절이다.

검토·검증 도구(모두 DB는 읽기 전용, SQL은 로컬 `spike-out/article-approvals/`에 저장). 새 검토에는 사용하지 않은 배치 이름을 지정한다. 기존 배치 디렉터리와 적용 전 스냅샷은 덮어쓰지 않는다. `batch1`·`batch2`는 10-09 검토 자료다.

```bash
BATCH=new-review node --env-file=.env.local --import=tsx scripts/prepare-article-approvals.ts
BATCH=new-review node --env-file=.env.local --import=tsx scripts/verify-article-approvals.ts --snapshot
# 생성된 SQL 검토·별도 적용 후 비교한다. 위 두 명령은 DB를 변경하지 않는다.
BATCH=new-review node --env-file=.env.local --import=tsx scripts/verify-article-approvals.ts
```

대상 목록은 10-09에 검토한 11편으로 고정돼 있고 이미 승인된 글은 건너뛴다. 새로운 글은 원문 검토 후 대상 목록과 검토일을 갱신해야 한다. 소스 승인도 같은 검증 구간에 적용했다면 마지막 명령에 `--sources-changed=duckdb,rust-blog,web-dev,chrome-developers`를 추가한다. 비교 기간에 다른 수집·가공이 실행되면 건수 비교가 실패할 수 있으므로 해당 실행 기록도 확인한다.

## 2026-10-10 변경 정리·로컬 검증

README와 승인 현황을 6개 소스·13편으로 맞추고, 설치 순서에 0005를 추가했다. 검토 도구는 기존 배치 디렉터리·스냅샷 덮어쓰기와 배치 이름의 경로 이탈을 거절하도록 보완했다.

`npm run typecheck`, `npm run test:rights`, `npm run test:ingest`, `npm run build`가 통과했다. 인제스트 검사는 12,000~15,000자 블로그의 추출, 15,000자 초과 블로그 제외, 뉴스 12,000자 자르기를 포함한다. 별도 실행으로 기존 검토 파일의 해시가 유지되고 잘못된 배치 경로가 외부 요청 전에 거절됨을 확인했다. 이번 정리에서는 운영 DB·크론·LLM을 실행하지 않았다.
