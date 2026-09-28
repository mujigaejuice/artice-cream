/**
 * 미리보기용 목데이터 (app/preview/*).
 *
 * Supabase 없이 화면만 확인하려고 둔 것이다. 미리보기 라우트는 프로덕션에서
 * notFound()로 막히므로 이 데이터가 사용자에게 닿지 않는다.
 */

import type { Scoop, TodayPick } from "./feed";
import type { DomainRow } from "./supabase/types";

export const mockDomains: DomainRow[] = [
  { id: 1, slug: "cloud", name_ko: "클라우드", name_en: "Cloud", rss_topic: null, active: true },
  { id: 2, slug: "llm", name_ko: "LLM", name_en: "LLM", rss_topic: null, active: true },
  { id: 3, slug: "security", name_ko: "보안", name_en: "Security", rss_topic: null, active: true },
];

const TITLES: Record<string, string[]> = {
  cloud: [
    "서버리스 콜드스타트를 줄이는 법",
    "멀티클라우드 설계, 정말 필요할까",
    "관리형 DB 가격이 다시 오른 이유",
  ],
  llm: ["에이전트가 툴을 고르는 법", "컨텍스트 엔지니어링이란 무엇인가"],
  security: ["공급망 공격은 왜 막기 어려운가", "패치 하나로 막힌 치명적 취약점"],
};

/** 날짜를 거슬러 올라가며 스쿱을 만든다 — 오래된 것이 앞(= 콘 아래). */
export const mockScoops: Scoop[] = [
  ["cloud", 0, "2026-09-05", 1],
  ["llm", 0, "2026-09-06", 0.75],
  ["security", 0, "2026-09-08", 1],
  ["cloud", 1, "2026-09-09", 0.5],
  ["llm", 1, "2026-09-11", 1],
  ["security", 1, "2026-09-12", 0.75],
  ["cloud", 2, "2026-09-14", 1],
].map(([domain, idx, date, score], i) => ({
  id: i + 1,
  variantId: 100 + i,
  articleId: 200 + i,
  domain: domain as string,
  domainLabel: mockDomains.find((d) => d.slug === domain)!.name_ko,
  date: date as string,
  title: TITLES[domain as string][idx as number],
  summaryFirstLine: `${TITLES[domain as string][idx as number]}에 대한 두어 줄 요약입니다.`,
  score: score as number,
}));

export const mockPicks: TodayPick[] = [
  {
    variantId: 201,
    articleId: 301,
    domain: mockDomains[0],
    level: 2,
    title: "서버리스 콜드스타트를 줄이는 법",
    summary: "요청이 뜸한 함수가 왜 느리게 깨어나는지, 그리고 그걸 줄이는 몇 가지 실전 기법을 정리했다.",
    readingMinutes: 4,
    sourceName: "thenewstack.io",
    imageUrl: null,
    publishedAt: "2026-09-19T00:00:00Z",
    completedNotSaved: false,
  },
  {
    variantId: 202,
    articleId: 302,
    domain: mockDomains[1],
    level: 1,
    title: "에이전트가 툴을 고르는 법",
    summary: "여러 도구 중 하나를 고르는 판단을 모델에게 맡길 때, 무엇이 그 판단을 흔드는지 살펴본다.",
    readingMinutes: 3,
    sourceName: "aitimes.com",
    imageUrl: null,
    publishedAt: "2026-09-19T00:00:00Z",
    completedNotSaved: true,
  },
  {
    variantId: 203,
    articleId: 303,
    domain: mockDomains[2],
    level: 3,
    title: "공급망 공격은 왜 막기 어려운가",
    summary: "신뢰하는 패키지 하나가 뚫리면 그걸 쓰는 모두가 뚫린다 — 구조적으로 막기 어려운 이유.",
    readingMinutes: 6,
    sourceName: "thehackernews.com",
    imageUrl: null,
    publishedAt: "2022-03-01T00:00:00Z",
    completedNotSaved: false,
  },
];

/** 리더 미리보기 — pipeline.markTerms가 만드는 것과 같은 모양의 HTML. */
export const mockArticle = {
  variantId: 201,
  articleId: 301,
  level: 2,
  title: "서버리스 콜드스타트를 줄이는 법",
  readingMinutes: 4,
  domainSlug: "cloud",
  domainLabel: "클라우드",
  sourceName: "thenewstack.io",
  sourceUrl: "https://example.com/article",
  glossary: {
    w1: { term: "콜드스타트", definition: "함수가 한동안 쉬다가 처음 실행될 때 겪는 초기화 지연." },
    w2: { term: "서버리스", definition: "서버를 직접 운영하지 않고, 실행한 만큼만 값을 치르는 방식." },
  },
  contentHtml: [
    '<p>이번 주 <mark data-w="w2">서버리스</mark> 플랫폼들이 잇따라 <mark data-w="w1">콜드스타트</mark> 지연을 줄이는 기능을 내놨다. 요청이 뜸한 함수일수록 이 지연이 크게 느껴진다.</p>',
    '<p>콜드스타트가 길어지면 첫 요청을 보낸 사용자가 그 지연을 그대로 느낀다. 대출을 갚는 사람에게 매달 나가는 돈이 늘어나는 것처럼, 쓸수록 체감이 커진다.</p>',
    '<p>반대로 상시 대기(warm pool)를 쓰면 지연은 줄지만 그만큼 값이 더 든다. 같은 변화가 누구에게는 비용이고 누구에게는 응답 속도인 이유다.</p>',
  ].join("\n"),
};
