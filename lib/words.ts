import type { SupabaseClient } from "@supabase/supabase-js";

import { ARTICLE_RIGHTS_COLUMNS, articleAllows, getSourceRights, type ArticleRights, type SourceRights } from "./content-rights";
import { dayKey } from "./day";

/**
 * 단어장 (확장.md §1-1, §3-1).
 *
 * 리더 팝오버에서만 쓰이고 버려지던 `article_variants.glossary`를 다시 모은다.
 * 새 LLM 콜도, 새 테이블도 없다 — 사용자가 퀴즈까지 끝낸(completed·saved)
 * 진행 행에서 그 variant의 용어집을 펼치면 그대로 단어장이다.
 *
 * 같은 용어가 여러 글에 나오면 가장 최근에 완료한 글의 정의 하나와, 출처 글
 * 목록(최신순)을 남긴다.
 *
 * 콘텐츠 권리: 콘(getScoops)은 철회된 글도 "현재 열람 불가" 스쿱으로 남기지만,
 * 단어장은 더 보수적으로 간다. 용어 정의는 원문을 가공해 만든 파생물이라 제목만
 * 가리고 정의를 보여 주면 철회된 콘텐츠의 일부를 계속 내보내는 셈이 된다.
 * 그래서 지금 시점에 `articleAllows(..., "publish")`를 통과하지 못하는 글은
 * 출처로도, 용어로도 쓰지 않고 통째로 버린다. 권리가 복구되면 다시 나타난다.
 *
 * 이 판정은 사용자 스코프 클라이언트의 RLS(진행·variant·기사 테이블의 "rights
 * gate" 제한 정책, 0002_content_rights.sql)와 겹친다. 일부러 두 번 잰다 — RLS가
 * 바뀌거나 service role로 호출돼도 여기서 다시 막히게.
 */

export type WordSource = {
  variantId: number;
  articleId: number;
  title: string;
  /** 완료 날짜(KST 'YYYY-MM-DD'). */
  date: string;
  /** domains.slug */
  domain: string;
  domainLabel: string;
};

export type Word = {
  term: string;
  /** 가장 최근에 완료한 글의 정의. */
  definition: string;
  /** 가장 최근 출처의 도메인 — 목록의 색 점과 라벨에 쓴다. */
  domain: string;
  domainLabel: string;
  /** 이 용어가 나온 모든 도메인 slug. 도메인 필터는 이 중 하나만 맞으면 통과다. */
  domains: string[];
  /** 최신순. 같은 글은 한 번만. */
  sources: WordSource[];
};

/** `getWords`가 읽는 진행 행 한 줄의 조인 모양. 테스트도 이 모양으로 픽스처를 만든다. */
export type WordProgressRow = {
  article_id: number;
  variant_id: number;
  completed_at: string | null;
  article_variants: {
    title: string | null;
    glossary: unknown;
    articles: (ArticleRights & { domains: { slug: string; name_ko: string } | null }) | null;
  } | null;
};

/** 대소문자·공백·유니코드 정규화만 다른 용어는 같은 단어로 본다. */
export function termKey(term: string): string {
  return term.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function glossaryEntries(glossary: unknown): { term: string; definition: string }[] {
  if (!glossary || typeof glossary !== "object" || Array.isArray(glossary)) return [];
  return Object.values(glossary as Record<string, unknown>).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { term, definition } = entry as { term?: unknown; definition?: unknown };
    if (typeof term !== "string" || typeof definition !== "string") return [];
    const t = term.trim();
    const d = definition.trim();
    return t && d ? [{ term: t, definition: d }] : [];
  });
}

/**
 * 순수 함수 — 진행 행과 소스 권리 표에서 단어 목록을 만든다.
 * 결과는 가장 최근에 만난 단어부터(같은 글 안에서는 용어집 순서).
 */
export function collectWords(
  rows: WordProgressRow[],
  sources: Map<string, SourceRights>,
  now = Date.now(),
): Word[] {
  // 최신 완료가 먼저 오도록 정렬해 두면 "처음 만난 정의 = 최신 정의"가 된다.
  const ordered = rows
    .filter((row) => row.completed_at && Number.isFinite(Date.parse(row.completed_at)))
    .sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!) || b.article_id - a.article_id);

  // Map은 넣은 순서를 지키므로, 최신 글부터 돌면 목록도 그대로 최신순이다.
  const words = new Map<string, Word>();

  for (const row of ordered) {
    const variant = row.article_variants;
    const article = variant?.articles;
    // 권리 판정에 실패한 글은 정의까지 통째로 버린다(파일 머리 주석).
    if (!variant || !article || !articleAllows(article, sources, "publish", now)) continue;

    const domain = article.domains?.slug ?? "unknown";
    const source: WordSource = {
      variantId: row.variant_id,
      articleId: row.article_id,
      title: variant.title?.trim() || "제목 없음",
      date: dayKey(new Date(row.completed_at!)),
      domain,
      domainLabel: article.domains?.name_ko ?? "기타",
    };

    for (const entry of glossaryEntries(variant.glossary)) {
      const key = termKey(entry.term);
      const existing = words.get(key);
      if (!existing) {
        words.set(key, {
          term: entry.term,
          definition: entry.definition,
          domain: source.domain,
          domainLabel: source.domainLabel,
          domains: [source.domain],
          sources: [source],
        });
        continue;
      }
      if (!existing.sources.some((s) => s.articleId === source.articleId)) existing.sources.push(source);
      if (!existing.domains.includes(source.domain)) existing.domains.push(source.domain);
    }
  }

  return [...words.values()];
}

/**
 * 서버 전용. 요청자 본인의 완료 기록에서 단어장을 만든다.
 * `supabase`는 요청자 토큰을 붙인 클라이언트(getRequestContext)여야 한다.
 */
export async function getWords(supabase: SupabaseClient, userId: string): Promise<Word[]> {
  const [sources, { data, error }] = await Promise.all([
    getSourceRights(supabase),
    supabase
      .from("user_article_progress")
      .select(
        `article_id, variant_id, completed_at, article_variants(title, glossary, articles(${ARTICLE_RIGHTS_COLUMNS}, domains(slug, name_ko)))`,
      )
      .eq("user_id", userId)
      .in("status", ["completed", "saved"])
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
  ]);
  if (error) throw new Error("단어장을 불러오지 못했어요.");
  // 소스 권리 표를 못 읽으면 빈 Map이 오고, 그러면 모든 글이 거부된다(허용 쪽 폴백 없음).
  return collectWords((data ?? []) as unknown as WordProgressRow[], sources);
}
