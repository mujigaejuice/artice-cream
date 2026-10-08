# 수집 재개와 개별 글 검토

2026-10-08, Kubernetes·Go의 **메타데이터 수집 2개**를 승인했다. 가공·공개 소스 승인은 각각 0개다. 최신 글 3편을 검토해 2편의 본문 이용 권리·필수 표시를 운영 DB에 반영했고, 1편은 현재 본문 길이 상한 밖이다.

## 수집과 가공의 분리

이전 수집 크론은 `allow_collect`와 `allow_process`를 함께 요구했다. 이제 목록 수집에는 수집 승인만 요구하고, LLM 분류에는 별도로 가공 승인 소스와 개별 승인 글을 요구한다. 이미 저장된 승인 글은 피드를 다시 수집하지 않고도 분류할 수 있다.

새로 발견한 글은 계속 `unreviewed`로 저장한다. 제목·URL·발행일·소스만 기록하며 RSS 요약은 저장하거나 미확인 상태로 LLM에 전달하지 않는다. 메타데이터만 수집하는 실행은 분류·가공 대기열의 상태와 만료일을 변경하지 않는다. 가공 대기열 만료는 가공 승인 소스의 개별 승인·분야 지정 글에만 적용한다.

[0004_licensed_source_collection.sql](../../supabase/migrations/0004_licensed_source_collection.sql)은 두 소스의 `allow_collect`만 켠다. 다른 소스·개별 글·가공본·문항은 변경하지 않는다. 개별 글은 별도 검토 SQL로 지정 URL·상태·이전 값을 대조한 후 승인했다.

## 글별 결과

| 글 | 저자·본문 권리 근거 | 검토 결과 |
|---|---|---|
| Kubernetes: [Scaling Kubernetes Workloads with Node Swap](https://kubernetes.io/blog/2026/10/05/scaling-kubernetes-workloads-with-node-swap/) | Ocean Xie, Yuan Wang. 실제 footer의 CC BY 4.0과 [website LICENSE](https://github.com/kubernetes/website/blob/main/LICENSE) | 기사 1605, 본문 권리 `permitted`, `pending` 유지. 코드·미디어 제외 후 8,610자. 그림 1개 제외. 별도 라이선스 고지·인용 블록 없음 |
| Go: [Arch-specific SIMD in Go](https://go.dev/blog/archsimd) | Junyang Shao, David Chase. 실제 글 footer가 연결하는 [go.dev/copyright](https://go.dev/copyright)의 본문 CC BY 4.0 | 기사 1825, 본문 권리 `permitted`, `pending` 유지. 코드 제외 후 10,713자. 코드의 BSD와 본문 라이선스 구분, 별도 고지·인용 블록 없음 |
| Kubernetes: [The Shift to cgroup v2 in Kubernetes](https://kubernetes.io/blog/2026/10/06/kubernetes-cgroups-v2-shift/) | Paco Xu (DaoCloud). CC BY 4.0 표시 확인 | 본문 추출 13,133자로 현재 블로그 입력 상한 12,000자 초과. 개별 승인에서 제외, 메타데이터는 미확인 상태로 보존. 앞부분만 잘라 재작성하지 않음 |

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
