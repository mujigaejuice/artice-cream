import { getRequestContext, json, preflight } from "@/lib/api";
import { hostLabel } from "@/lib/feed";
import type { Attribution, ReferenceLink } from "@/lib/content-rights";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 리더 진입 (정책.md §7, 앱출시.md §2 — `app/read/[variantId]/page.tsx`의 게이트).
 *
 * 게이트가 링크가 아니라 여기 있는 이유는 그대로다: URL은 추측할 수 있으니 본문을
 * 주는 자리에서 재야 한다. 정적 내보내기로 옮겨도 서버 권위는 그대로다 —
 * 클라이언트는 쿼터를 스스로 통과시킬 수 없고, 잠기면 본문을 받지 못한다.
 *
 * POST인 것은 부수효과가 있기 때문이다. 아티클을 처음 여는 것이면 쿼터가 한 편
 * 깎인다(아티클 단위, variant 단위가 아니다). 이미 연 글을 다시 여는 것은 공짜다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

type ReaderResult = {
  opened: true;
  variant: {
    id: number;
    level: number;
    title: string;
    content_html: string;
    glossary: Record<string, { term: string; definition: string }>;
    reading_minutes: number | null;
    articles: {
      id: number;
      source_url: string | null;
      content_kind: "external" | "original";
      reference_links: ReferenceLink[];
      rights_attribution: Attribution | null;
      domains: { slug: string; name_ko: string } | null;
    };
  };
  progress: { status: "started" | "completed" | "saved"; quiz_score: number | null };
};

export async function POST(request: Request) {
  const started = performance.now();
  const timings: string[] = [];
  const measure = async <T,>(name: string, work: () => PromiseLike<T>): Promise<T> => {
    const before = performance.now();
    try { return await work(); }
    finally { timings.push(`${name};dur=${(performance.now() - before).toFixed(1)}`); }
  };
  const respond = (body: unknown, status = 200) => {
    const response = json(request, body, { status });
    response.headers.set("Server-Timing", [...timings, `total;dur=${(performance.now() - started).toFixed(1)}`].join(", "));
    return response;
  };
  const fail = (message: string, status: number) => respond({ error: message }, status);
  const { user } = await measure("auth", () => getRequestContext(request));
  if (!user) return fail("unauthenticated", 401);

  let variantId: number;
  try {
    variantId = Number((await request.json())?.variantId);
  } catch {
    return fail("invalid body", 400);
  }
  if (!Number.isSafeInteger(variantId) || variantId <= 0) {
    return fail("invalid body", 400);
  }

  // One transaction performs current rights checks, atomic quota accounting and
  // content/progress reads. Do not fall back to an unchecked read on RPC failure.
  let data;
  try {
    const result = await measure("reader", () => createAdminClient().rpc("open_article_reader", {
      p_user_id: user.id, p_variant_id: variantId,
    }));
    if (result.error) throw result.error;
    data = result.data;
  } catch {
    return fail("reading temporarily unavailable", 503);
  }
  if (data?.error === "not found") return fail("not found", 404);
  // 잠겼으면 본문을 응답에 넣지 않는다. 화면만 가리는 것과 다르다.
  if (data?.opened === false && typeof data.quota?.canUnlockWithAd === "boolean") {
    return respond({
      opened: false,
      quota: { canUnlockWithAd: data.quota.canUnlockWithAd },
    });
  }

  if (data?.opened !== true || data.variant?.id !== variantId || !data.variant?.articles ||
      typeof data.variant.content_html !== "string" ||
      !["started", "completed", "saved"].includes(data.progress?.status)) {
    return fail("reading temporarily unavailable", 503);
  }
  const { variant, progress } = data as ReaderResult;
  const article = variant.articles;

  return respond({
    opened: true,
    reader: {
      variantId: variant.id,
      articleId: article.id,
      level: variant.level,
      title: variant.title,
      contentHtml: variant.content_html,
      glossary: variant.glossary ?? {},
      readingMinutes: variant.reading_minutes,
      domainSlug: article.domains?.slug ?? "",
      domainLabel: article.domains?.name_ko ?? "",
      isOriginal: article.content_kind === "original",
      referenceLinks: article.content_kind === "original" ? article.reference_links : [],
      sourceName: article.content_kind === "original" ? "artice cream Original" : hostLabel(article.source_url),
      sourceUrl: article.source_url,
      attribution: article.rights_attribution,
      progressStatus: progress?.status ?? "started",
      quizScore: progress?.quiz_score ?? null,
    },
  });
}
