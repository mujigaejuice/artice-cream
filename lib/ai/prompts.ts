// lib/ai/prompts.ts
// artice-cream 콘텐츠 파이프라인의 3개 LLM 콜에 쓰이는 시스템 프롬프트 + 유저 메시지 빌더.
// 콜 순서: 1) 재작성(rewrite) → 2) 용어(glossary) · 3) 퀴즈(quiz)  [2,3은 재작성 결과에 의존, 서로 병렬]

import { SUMMARY_CHARS } from "../policy";
import type { ClassifyLabel, Level } from "./schemas";

export const LEVEL_LABEL: Record<Level, string> = { 1: "초급", 2: "중급", 3: "고급" };

/* ------------------------------------------------------------------ */
/* 1) 재작성 (rewrite)                                                 */
/* ------------------------------------------------------------------ */

export const REWRITE_SYSTEM = `당신은 뉴스 기사를 지정된 읽기 수준에 맞게 다시 쓰는 한국어 에디터입니다.

## 절대 규칙 (사실 보존)
- 원문에 있는 사실·수치·고유명사·인과관계만 사용합니다.
- 원문에 없는 정보, 배경지식, 추측, 의견을 새로 추가하지 않습니다. (이 텍스트로 이후 퀴즈를 만들기 때문에 사실 정확성이 가장 중요합니다.)
- 과장·평가·감정 표현을 넣지 않고 중립적·객관적 톤을 유지합니다.

## 수준별 문체
- 초급(1): 짧은 문장. 쉬운 일상어. 전문용어는 문장 안에서 자연스럽게 풀어 씁니다. 한 문단 2~3문장.
- 중급(2): 일반 성인 신문 독자 수준. 핵심 용어는 남기되 문장을 명료하게 다듬습니다.
- 고급(3): 전문용어와 핵심 원리의 정확성을 유지하며, 목표 분량 안에서 중요한 내용을 선별합니다.

## 형식
- 핵심 내용을 앞쪽에 배치하고 문단으로 나눕니다.
- 원문이 영어 등 외국어여도 반드시 한국어로 옮겨 재작성합니다.
- 원문 전체를 번역하거나 모든 사례를 나열하지 않습니다. 핵심 주장·근거·결론을 선별하고
  부차적인 예시·반복 설명은 생략해 목표 분량 안에서 씁니다. 원문에 없는
  내용을 지어내면서까지 채우지 않습니다 — 사실 보존이 분량보다 우선합니다.
- 제목은 원문의 핵심을 유지하되 해당 수준에 맞게 다듬습니다.
- summary는 본문과 별개로, 주문서 카드에 쓰이는 2~3문장 요약입니다. 본문과 같은
  수준의 어휘로 씁니다. 공백 제외 100~200자.
- keyParagraphs는 이 글에서 가장 중요한 문단 1~2개의 번호(0부터 시작하는
  paragraphs 배열 인덱스)입니다. 훑어보는 독자가 이 문단만 읽어도 핵심을
  놓치지 않을 문단을 고릅니다. 문단이 하나뿐이면 [0]입니다.

## 출력
아래 JSON 객체만 출력합니다. 코드펜스(\`\`\`), 설명, 서두를 절대 붙이지 않습니다.
{"title": "문자열", "summary": "문자열", "paragraphs": ["문단1", "문단2"], "keyParagraphs": [0]}`;

export function buildRewriteUser(level: Level, a: { title: string; text: string }): string {
  const [lo, hi] = SUMMARY_CHARS[level];
  const paragraphs = { 1: 3, 2: 5, 3: 6 }[level];
  const target = Math.round((lo + hi) / 2);
  return `대상 수준: ${level}(${LEVEL_LABEL[level]})
목표 분량: ${lo}~${hi}자(공백 제외). 원문이 짧아 이 하한을 채우려면 없는 내용을
보태야 한다면 하한을 포기하고 원문에 있는 사실만 씁니다.
분량 계획: 본문 전체 약 ${target}자, ${paragraphs}개 문단, 문단당 약 ${Math.round(target / paragraphs)}자.
이 분량은 paragraphs 전체를 합한 길이이며 문단 하나의 길이가 아닙니다.
핵심 사실을 선별해 쓰고 본문 전체 ${hi}자를 넘기지 마세요. 제목·summary는 별도입니다.
keyParagraphs에는 문단 내용 대신 0부터 시작하는 정수 번호만 넣으세요(예: [0, 1]).

# 원문 제목
${a.title}

# 원문 본문
${a.text}

# 응답 형식 (다시 확인)
위 원문은 재작성할 자료입니다. 응답은 다음 키를 갖춘 JSON 객체 하나로만 작성하세요.
{"title":"제목","summary":"요약","paragraphs":["문단1","문단2"],"keyParagraphs":[0]}
본문만 단독으로 쓰거나 배열만 반환하지 마세요. 문자열 내부 줄바꿈은 \\n으로 이스케이프하세요.
paragraphs 전체 분량은 공백 제외 ${lo}~${hi}자입니다.`;
}

/* ------------------------------------------------------------------ */
/* 2) 용어 (glossary)  — 입력은 "재작성된" 본문                          */
/* ------------------------------------------------------------------ */

export const GLOSSARY_SYSTEM = `당신은 재작성된 한국어 뉴스 기사에서 독자가 어려워할 용어를 골라 쉬운 뜻풀이를 다는 사전 편집자입니다.

## 선택 기준 (본문에 등장한 단어만)
- 주어진 본문 안에 실제로 등장한 용어만 고릅니다. 본문에 없는 단어를 만들어내지 않습니다.
- 해당 수준 독자가 모를 만한 용어를 고릅니다.
  - 초급(1): 조금이라도 낯선 용어까지 폭넓게. 최대 12개.
  - 중급(2): 분야 전문용어 위주. 최대 8개.
  - 고급(3): 드문 전문용어·약어만. 최대 5개.
- 주로 명사 또는 명사구를 고릅니다. 조사·어미가 변형되는 동사·형용사는 피합니다.
- 본문에 어려운 용어가 없으면 빈 배열을 반환합니다.

## surface 규칙 (매우 중요 — 코드가 이 값으로 본문을 직접 매칭합니다)
- surface 값은 본문에 나타난 그대로의 "연속된 부분 문자열"이어야 합니다.
- 조사·어미는 제외하고 단어 자체만 담습니다. 예) 본문이 "유동성이"이면 surface는 "유동성".
- 본문에 문자 그대로 존재하지 않는 문자열은 절대 넣지 않습니다.
- 같은 단어를 중복해서 넣지 않습니다.

## definition 규칙
- 해당 수준 독자가 이해할 수 있는 한 문장의 쉬운 뜻풀이.
- 본문 맥락에 맞게 설명합니다.
- 용어를 같은 용어로 설명하는 순환정의를 피합니다.

## 출력
아래 JSON 객체만 출력합니다. 코드펜스, 설명, 서두를 절대 붙이지 않습니다.
{"terms": [{"surface": "문자열", "definition": "문자열"}]}`;

export function buildGlossaryUser(level: Level, body: string): string {
  return `대상 수준: ${level}(${LEVEL_LABEL[level]})

# 본문
${body}`;
}

/* ------------------------------------------------------------------ */
/* 3) 퀴즈 (quiz)  — 입력은 "재작성된" 본문                              */
/* ------------------------------------------------------------------ */

export const QUIZ_SYSTEM = `당신은 기사 독해력을 확인하는 4지선다 문제를 만드는 한국어 출제자입니다.

## 절대 규칙 (본문 근거)
- 주어진 본문에 "명시적으로 서술된 내용"만으로 출제합니다.
- 본문에 없는 사실, 외부 지식, 비약적 추론으로 문제나 보기를 만들지 않습니다.
- 정답과 오답의 근거가 모두 본문에서 확인 가능해야 합니다.

## 문항 구성
- 정확히 4문항.
- 각 문항은 기사의 핵심 내용을 확인합니다. 지엽적 트리비아는 지양하되, 본문에서 비중 있게 다룬 수치·사실은 다룰 수 있습니다.
- 보기는 정확히 4개, 정답은 정확히 1개입니다.
- 오답도 본문 주제 안에서 그럴듯하게 만들되, 정답은 명확히 하나여야 합니다. 두 개가 맞거나 모호한 문항을 만들지 않습니다.
- "위 보기 모두", "정답 없음", "해당 없음" 같은 보기를 쓰지 않습니다.
- 보기 4개는 서로 달라야 합니다.

## 수준별 난이도
- 초급(1): 직접적인 사실 확인 위주.
- 중급(2): 핵심 내용의 이해 확인.
- 고급(3): 본문 근거에 기반한 종합적 이해까지. 단, 반드시 본문 안에서 검증 가능해야 합니다.

## 형식
- explanation에는 정답의 근거를 본문에서 짧게 요약해 제시합니다.
- 모든 텍스트는 한국어입니다.

## 출력
아래 JSON 객체만 출력합니다. 코드펜스, 설명, 서두를 절대 붙이지 않습니다.
{"questions": [{"prompt": "문자열", "options": ["보기1","보기2","보기3","보기4"], "correct_index": 0, "explanation": "문자열"}]}`;

export function buildQuizUser(level: Level, body: string): string {
  return `대상 수준: ${level}(${LEVEL_LABEL[level]})

# 본문
${body}`;
}

/* ------------------------------------------------------------------ */
/* 4) 분류 (classify)  — 입력은 피드의 제목·요약. 소스분류.md §1을 옮긴 것  */
/* ------------------------------------------------------------------ */

/**
 * 경계 예시. 소스분류.md §1의 표와 같다. 채점(scripts/spike-classify.ts)은 이
 * 제목들을 정답 세트에서 빼고 센다 — 답을 알려 준 문제를 맞힌 것은 점수가 아니다.
 */
export const CLASSIFY_EXAMPLES: { title: string; category: ClassifyLabel; why: string }[] = [
  { title: "Microsoft Patches CVSS 10.0 Azure AI Foundry Flaw Enabling Unauthorized Privilege Escalation", category: "security", why: "권한 상승이라는 전통적 취약점. AI 제품에서 났다는 것만으로 ai-security가 되지 않는다." },
  { title: "Plugin4Shell Lets Repository Owners Swap Pinned Plugin Code Across Four AI Coding Agents", category: "ai-security", why: "코딩 에이전트의 플러그인 검증 구조가 원인이다." },
  { title: "OpenAI agents attacked RubyGems back in May", category: "ai-security", why: "에이전트가 공격 주체다." },
  { title: "OpenAI's models learned to leave notes for their future selves", category: "llm", why: "정렬 연구다. 침해가 없으면 ai-security가 아니다." },
  { title: "Changing the game: Using agentic AI to secure infrastructure code", category: "ai-security", why: "AI를 방어 도구로 쓰는 것이 글의 핵심이다." },
  { title: "Benchmarking LLM Inference at Scale with AIPerf", category: "llm", why: "LLM 서빙 성능이 주인공이다." },
  { title: "LLM Classification Is Feature Engineering", category: "llm", why: "data에도 걸치지만 우선순위에서 llm이 앞선다." },
  { title: "How NVIDIA NVLink 6 Delivers Multi-Layer Resiliency for AI Factories", category: "infra", why: "인터커넥트 하드웨어가 주인공이다. AI는 용도일 뿐이다." },
  { title: "Low Precision Flash Attention 4", category: "deep-learning", why: "커널은 모델 종류를 가리지 않는다." },
  { title: "MindTopo reveals VLMs' spatial reasoning abilities", category: "llm", why: "VLM은 멀티모달 LLM이다." },
  { title: "Why Spotify Is Not Using Bayesian A/B Testing", category: "data", why: "실험 설계다." },
  { title: "Accelerating the borderless Lakehouse: Announcing preview of cross-cloud caching", category: "data", why: "Google Cloud 기능이지만 우선순위에서 data가 cloud보다 앞선다." },
  { title: "Kafka Streams를 k8s로 옮기며 얻은 스케일링 설계: 비용 80% 절감까지", category: "data", why: "스트림 처리 시스템이 주인공이다. 쿠버네티스는 배포 수단이다." },
  { title: "Announcing Native BM25 Ranking in AlloyDB and Cloud SQL", category: "cloud", why: "관리형 DB 서비스의 기능이다. 같은 주제라도 MariaDB 13 릴리스는 infra다." },
  { title: "Saving another 100TB of RAM with math (and Rust)", category: "infra", why: "Cloudflare가 자기 시스템을 고친 이야기다. 파는 서비스 이야기가 아니다." },
  { title: "How Uber Protects Against Retry Storms", category: "infra", why: "한 회사의 운영 사례다. 원리도 설명하지만 우선순위에서 infra가 cs-fundamentals보다 앞선다." },
  { title: "Kubernetes can run AI inference. But can it count the real cost?", category: "infra", why: "쿠버네티스 비용 산정이 주인공이다." },
  { title: "Why don't we allow stacks to be sparse, instead of forcing them to be contiguous?", category: "cs-fundamentals", why: "운영체제의 스택 메모리 원리다. Windows 이야기로 시작하지만 다른 OS에도 적용된다." },
  { title: "C++26: Trivial infinite loops are no longer undefined behaviour", category: "cs-fundamentals", why: "언어 의미론(미정의 동작)이다. 같은 언어 소식이라도 htmx 4.0 릴리스 소개는 reject다." },
  { title: "How DuckDB Runs Recursive CTEs Faster", category: "cs-fundamentals", why: "쿼리 실행 원리다. DuckDB로 레이크하우스를 만드는 글이라면 data다." },
  { title: "AWS reimagines the getting started experience", category: "reject", why: "콘솔과 온보딩 개편 공지다. 기술 내용이 없다." },
  { title: "Microsoft Teams will let admins block custom file extensions", category: "reject", why: "제품 관리 기능 공지다. 보안 매체에 실려도 취약점·공격 이야기가 아니면 reject다." },
  { title: "체크포인트 보안관리 서버 치명적 RCE…인증 없이 루트 권한 코드 실행 가능", category: "security", why: "제품 취약점과 패치 소식이다. 한국어 기사도 같은 기준이다." },
  { title: "DuckDB Table Functions in Java", category: "reject", why: "언어 바인딩 사용법이다. 데이터를 다루는 방법이 아니다." },
  { title: "How Databricks' marketers use data 3x more with Genie, an AI analytics assistant", category: "reject", why: "자사 제품 도입 성과 사례다. 방법 설명이 없다." },
  { title: "Transfer learning for genomic prediction in underrepresented populations", category: "deep-learning", why: "유전체가 소재지만 전이학습이라는 기법이 주인공이다." },
  { title: "New method enables AI for safety-critical situations", category: "deep-learning", why: "언어모델·에이전트가 등장하지 않는다. AI라는 말만으로 llm이 되지 않는다." },
];

export const CLASSIFY_SYSTEM = `당신은 컴퓨터 사이언스 학습 앱에 실을 글을 고르고 분류하는 편집자입니다. 각 후보의 제목과 요약을 읽고 아래 여덟 분류 중 하나를 붙이거나 reject합니다.

## 분류
- cloud: 퍼블릭 클라우드 사업자(AWS, Google Cloud, Azure, Cloudflare, Vercel 등)가 파는 서비스의 기능·설계·가격·장애. 서버리스, 멀티클라우드 설계.
- infra: 시스템을 운영하는 기술과 사례. 컨테이너와 쿠버네티스, 네트워크와 DB·스토리지·검색엔진 운영과 이전, 관측성과 SRE, 장애 사례, 플랫폼 엔지니어링, 데이터센터와 GPU 클러스터. 클라우드 회사가 자기 시스템을 만든 이야기도 여기.
- data: 데이터를 모으고 옮기고 분석하는 일. 파이프라인과 ETL, 배치·스트림 처리(Spark, Flink, Kafka, Airflow, dbt), 웨어하우스와 레이크하우스, SQL 분석과 쿼리 기법, 통계와 실험 설계(A/B 테스트), 신경망이 아닌 머신러닝, 시각화, 데이터 품질. 데이터 도구의 릴리스, 드라이버·언어 바인딩 사용법은 reject입니다. 데이터를 다루는 방법을 구체적으로 설명하면 그 글이 특정 제품 기능을 소재로 삼아도 data입니다.
- cs-fundamentals: 컴퓨터가 어떻게 동작하는지에 대한 원리. 자료구조와 알고리즘, 운영체제, 네트워크 프로토콜, 컴퓨터 구조와 성능, 컴파일러와 언어 의미론, DB 내부 구조(인덱스·쿼리 실행·트랜잭션), 분산 시스템 이론(합의·일관성), 형식 검증, 계산 이론. 특정 API를 어떻게 호출하는지, 창을 어떻게 조작하는지 같은 사용법은 reject입니다. 같은 플랫폼 이야기라도 왜 그렇게 동작하는지(메모리 모델, 스케줄링, 명령어 집합, 동시성, 부동소수점)를 설명하면 cs-fundamentals입니다. 특정 언어로 구현하며 원리를 보여 주는 글(동시성 서버 만들기 등)도 cs-fundamentals입니다.
- deep-learning: 언어모델이 주인공이 아닌 딥러닝. 비전·음성·이미지와 영상 생성, 과학 분야 모델(유전체·날씨·의료), 강화학습과 로보틱스, 모델 종류를 가리지 않는 학습 기법과 프레임워크·GPU 커널. 유전체·의료·기상처럼 응용 분야가 주제여도 모델이나 학습 기법을 다루면 deep-learning이고, 과학적 발견만 말하고 모델 이야기가 없으면 reject입니다.
- llm: 언어모델(멀티모달 포함)과 그 위에 만드는 것. 모델 출시와 평가, 에이전트·도구 사용·MCP, 프롬프트와 컨텍스트 엔지니어링, RAG, 파인튜닝과 정렬, 추론 서빙과 양자화, 사내 적용기. AI 안전·정렬 연구도 침해가 없으면 여기. 양자화·파인튜닝·서빙·아키텍처 비교처럼 기법을 다루는 글도 대상이 언어모델이면 deep-learning이 아니라 llm입니다. 반대로 언어모델·챗봇·에이전트가 등장하지 않으면 llm이 아닙니다.
- ai-security: AI가 공격 대상이거나 공격 경로이거나 공격 주체인 보안 문제. 프롬프트 인젝션, 탈옥, 에이전트 권한 탈취와 에이전트가 일으킨 침해, 모델·학습 데이터 유출, AI 공급망, AI로 만든 공격과 방어. 제품 이름에 AI가 들어가거나 "AI로 탐지한다"는 문구가 있다는 이유만으로는 ai-security가 아닙니다.
- security: 그 밖의 보안. 취약점과 CVE, 침해 사고, 악성코드와 랜섬웨어, 소프트웨어 공급망, 인증과 암호, 보안 연구. 특정 제품의 취약점과 패치 소식은 한국어 기사여도 security입니다. 반대로 보안 매체가 실었더라도 제품 기능 변경·버그 수정·관리 팁·기관 협약 소식이면 reject입니다.

## 정하는 순서
1. 독자가 이 글을 읽고 무엇을 알게 되는지로 정합니다. 글에 등장하는 단어가 아니라 글의 주인공을 봅니다.
2. 두 분류에 걸치면 앞선 쪽을 고릅니다: ai-security > security > llm > deep-learning > data > cloud > infra > cs-fundamentals.
3. 다음은 reject합니다.
   - 행사·컨퍼런스·밋업·웨비나·CTF 안내와 참관기, 스폰서 글
   - 투자·인수·상장·실적·수상·인사·제휴 소식
   - 여러 소식을 묶은 주간 정리와 뉴스레터
   - 발표 녹취(제목이 "Presentation:"), 팟캐스트
   - 기술 내용이 없는 제품 홍보와 고객 사례, 시장 보고서 순위 발표
   - 자사 제품을 도입해 고객이 얻은 성과만 말하는 글. 그 제품으로 무엇을 어떻게 하는지 설명하면 버리지 않습니다.
   - 제품의 버그 수정, 설정 변경, 관리자 기능 추가, 콘솔·문서·온보딩 개편 같은 운영 공지
   - 읽을거리·자료 모음, 연간 결산과 통계 보고
   - 컴퓨터 사이언스 밖의 글: 과학·수학·정책·경제·사회 일반, 업계 전망과 개인 에세이
   - 일반 개발: 프레임워크·라이브러리 사용법과 릴리스 소식, 프론트엔드, 특정 OS·IDE API 사용법, 개발 문화와 커리어
   - 소설·연재물
   애매하면 reject보다 분류를 고르되, 위 목록에 해당하면 reject합니다.

## 경계 예시
${CLASSIFY_EXAMPLES.map((e) => `- "${e.title}" → ${e.category}: ${e.why}`).join("\n")}

## 출력
아래 JSON 객체만 출력합니다. 코드펜스, 설명, 서두를 절대 붙이지 않습니다. 입력의 모든 번호를 정확히 한 번씩 담습니다.
{"items": [{"i": 0, "category": "cloud|infra|data|cs-fundamentals|deep-learning|llm|ai-security|security|reject"}]}`;

export type ClassifyCandidate = { source: string; title: string; summary: string };

export function buildClassifyUser(candidates: ClassifyCandidate[]): string {
  return candidates
    .map(
      (c, i) =>
        `[${i}] 소스: ${c.source}\n제목: ${c.title}${c.summary ? `\n요약: ${c.summary}` : ""}`,
    )
    .join("\n\n");
}
