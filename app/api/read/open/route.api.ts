import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { hostLabel } from "@/lib/feed";
import { canPublishArticle, type Attribution } from "@/lib/content-rights";
import { getProgress, openArticle } from "@/lib/quota";
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

export async function POST(request: Request) {
  const { user, supabase } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  let variantId: number;
  try {
    variantId = Number((await request.json())?.variantId);
  } catch {
    return apiError(request, "invalid body", 400);
  }
  if (!Number.isInteger(variantId)) {
    return apiError(request, "invalid body", 400);
  }

  const { data } = await supabase
    .from("article_variants")
    .select(
      "id, level, title, content_html, glossary, reading_minutes, articles(id, source_url, published_at, rights_attribution, domains(slug, name_ko))",
    )
    .eq("id", variantId)
    .maybeSingle();

  if (!data) return apiError(request, "not found", 404);

  const variant = data as unknown as {
    id: number;
    level: number;
    title: string;
    content_html: string;
    /** { "w3": { term, definition } } — content_html의 <mark data-w>와 짝을 이룬다. */
    glossary: Record<string, { term: string; definition: string }>;
    reading_minutes: number | null;
    articles: {
      id: number;
      source_url: string;
      published_at: string | null;
      rights_attribution: Attribution | null;
      domains: { slug: string; name_ko: string } | null;
    } | null;
  };

  const article = variant.articles;
  if (!article) return apiError(request, "not found", 404);

  const admin = createAdminClient();
  if (!await canPublishArticle(admin, article.id)) return apiError(request, "not found", 404);
  const gate = await openArticle(admin, user.id, article.id, variant.id);

  // 잠겼으면 본문을 응답에 넣지 않는다. 화면만 가리는 것과 다르다.
  if (!gate.opened) {
    return json(request, {
      opened: false,
      quota: { canUnlockWithAd: gate.quota.canUnlockWithAd },
    });
  }

  const progress = await getProgress(admin, user.id, article.id);

  return json(request, {
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
      sourceName: hostLabel(article.source_url),
      sourceUrl: article.source_url,
      attribution: article.rights_attribution,
      progressStatus: progress?.status ?? "started",
      quizScore: progress?.quizScore ?? null,
    },
  });
}
