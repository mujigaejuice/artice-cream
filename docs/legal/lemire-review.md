# Lemire 기존 6편 검토와 공개 보류

검토일: 2026-10-08. 대상은 운영 DB의 ready 6편, 난이도별 가공본 18개, 퀴즈 72문항이다.
공개 라이선스를 확인한 것과 재공개 승인은 다르다. 현재 소스의 수집·가공·공개 플래그는 모두 false이며, 6편도 `restricted`로 유지한다.

## 재공개를 보류하는 근거

[블로그 이용 조건](https://lemire.me/blog/terms-of-use/)은 댓글을 제외한 콘텐츠에 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)을 연결한다. 상업적 번역·변형은 조건부로 허용된다.
기존 리더는 원문 링크와 일반적인 가공 안내를 표시했지만 저자·원제·라이선스 표시를 완비하지 않았다.
[CC 공식 FAQ](https://creativecommons.org/faq/#how-can-i-lose-my-rights-under-a-creative-commons-license-if-that-happens-how-do-i-get-them-back)는 조건 위반 시 종료와 복구를 설명하며, 3.0 이하에는 자동 복구가 없다고 명시한다.
따라서 출처 정보를 추가한 것만으로 재공개 가능하다고 판단하지 않는다. 권리자의 명시적 복구/별도 허락 또는 기존 사용에 대한 별도 적법한 근거가 확인될 때까지 공개를 보류한다. 이 기록은 법원의 침해 확정 판정이 아니다.

글 754의 원문 footer byline, `article:author` 메타데이터, 인용문 저자는 모두 **Antonio Badia**다. 블로그의 일반 정책만으로 이 글의 권리자가 Daniel Lemire라고 단정하지 않는다. 게스트 글 적용 범위와 실제 권리자의 허락도 확인한다.

## 개별 글 기록

| Article ID | 원문 | 확인된 저자 | 남은 사항 |
|---|---|---|---|
| 749 | [UTF-16 string in C#](https://lemire.me/blog/2026/09/26/how-fast-can-you-fix-a-utf-16-string-in-c/) | Daniel Lemire | 명시적 재공개 근거 |
| 751 | [Strings per second](https://lemire.me/blog/2026/09/25/how-many-strings-can-you-create-per-second/) | Daniel Lemire | 명시적 재공개 근거 |
| 754 | [Taken branches per cycle](https://lemire.me/blog/2026/09/21/more-than-a-taken-branch-per-cycle/) | Antonio Badia | 재공개 근거·게스트 글 라이선스 범위 |
| 1111 | [UTF-8 to UTF-16 with replacement](https://lemire.me/blog/2026/09/30/transcoding-utf-8-to-utf-16-with-replacement-at-gigabytes-per-second/) | Daniel Lemire | 명시적 재공개 근거; Benjamin Bucher 구현 기여 표시 보존 |
| 1247 | [Compressed JSON](https://lemire.me/blog/2026/10/01/parsing-compressed-json-at-40-gb-s/) | Daniel Lemire | 명시적 재공개 근거 |
| 1500 | [Orbital data center](https://lemire.me/blog/2026/10/04/googles-first-orbital-data-center-is-in-orbit/) | Daniel Lemire | 명시적 재공개 근거; 저자 의견과 확인된 사실을 구별하는 최종 검수 |

6편에 원저자·원제·원문 근거·CC BY 3.0 링크·한국어 번역/요약/난이도별 재작성/용어·퀴즈 추가 표시를 보완했다.
이미지·코드·댓글의 재사용은 승인하지 않는다. 기존 18개 가공 HTML에는 이미지·영상·코드 블록이 없는 것을 검사했다.
새로운 외부 모델 호출은 하지 않았다. 향후 가공 재개 전에는 실제 게이트웨이 운영사와 하위 처리의 계약·보관·학습 사용 조건을 확인해야 한다.

## 가공본과 퀴즈 수정

원문과 기존 가공 내용을 대조해 가공본 8개와 퀴즈 10개를 수정했다. 문항 개수와 기존 개인 점수는 그대로 보존했으며, 과거 결과를 재채점하지 않았다.

- UTF-16: 기존 검색 방식의 이모지 처리 저하와 SIMD 결과를 구별하고, 검증·문자열 반환·출력 버퍼 수정의 동작을 혼동한 문항을 정리한다.
- 문자열 생성: Python만 1천만 개를 측정한 조건을 복원한다. 보기 모두가 맞았던 문항 552에 단일 오답을 만든다.
- 분기: 두 taken branch를 not-taken으로 잘못 옮긴 본문·문항·해설과 Zen 명칭을 고친다. 문항 688의 보기 모두가 맞는 문제와 편집되지 않은 생성 메모를 제거한다.
- UTF-8 변환: 새 기능의 브라우저 배포를 단정한 요약을 고치고 문항 300의 복수 오답 가능성을 없앤다.
- JSON: gzip 대비 16배는 zstd, lz4는 약 13.6배라는 차이를 본문·퀴즈에 반영한다. 문항 379의 복수 정답 가능성과 문장 오타도 고친다.
- 우주 데이터센터: [Google의 10월 1일 공식 발표](https://blog.google/innovation-and-ai/models-and-research/google-research/project-suncatcher-prototype/)로 시험 위성의 발사를 교차 확인했다. 원문의 허가·상시 태양광·지연 시간에 대한 의견을 일반적 사실로 확대하지 않도록 공개 전 추가 검수한다.

## 적용과 증빙

12:59(KST) 운영 DB 트랜잭션 적용 완료. 적용 후 6편 출처, 18개 가공본, 72개 문항을 예상 값과 모두 대조했다. 6편의 `content_article_allows(id, 'publish')`는 모두 false이며 소스의 3개 행위 플래그도 false다. 타입 검사 통과.

`npm run test:rights`와 기존 미확인 글의 운영 검사를 통과했다. 16:43(KST)에는 `scripts/verify-content-rights.ts --production --article-id=749`로 이번에 검토한 `restricted` 글을 직접 지정해 읽기·퀴즈·채점·저장 404, 직접 DB 조회 차단, no-store, 쿼터 미소비, 개인 저장 기록 내부 보존, 9개 크론 rights 중단을 확인했다. 중단된 첫 추가 검사의 전용 계정은 별도로 식별해 삭제·검증했고, 재검사의 전용 계정도 종료 시 정리했다. 결과는 로컬 `spike-out/content-rights-production-749.json`이다.

`scripts/audit-lemire-rights.ts`는 원문 본문과 post footer의 저자를 읽고 댓글·스크립트를 제외한 로컬 검토 스냅샷을 만든다.
`scripts/prepare-lemire-remediation.ts`는 특정 6편만 대상으로 SQL 수정안을 만든다. 기존 값 일치, 대상 URL·상태, 소스 플래그, 가공본·문항 식별자를 확인하고 한 트랜잭션으로 처리한다. 공개 승인 로직은 포함하지 않는다.
`scripts/verify-lemire-remediation.ts --production --backup`은 적용 전 대상 DB 값을 로컬에 보관하며, `--production`은 적용 후 출처·18개 가공본·72개 문항 전체와 제한 상태를 대조한다.

증빙은 Git에서 제외된 `spike-out/lemire-review/`에만 보관한다. SQL, 원문, 해설 원본, 내부 검토 메모를 공개 저장소에 첨부하지 않는다.
허락 요청 문안은 [재공개 허락 요청 초안](lemire-permission-request.draft.md)에 준비했다. 발송하지 않았다. 회신 원문과 연락처는 비공개로 보관하고 승인 범위만 기록한다.

재개 순서: 명시적 허락 증빙 → 754 권리자 범위 확인 → 남은 내용 검수 → 허용된 글과 행위만 승인 → 운영 읽기·퀴즈·저장 검증. 이후 신규 가공은 제공사 조건 확인 뒤 별도로 승인한다.
