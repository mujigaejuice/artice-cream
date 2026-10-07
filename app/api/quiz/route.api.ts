import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { canPublishArticle } from "@/lib/content-rights";
import type {
  PublicQuizQuestion,
  QuizQuestionRow,
  QuizReviewItem,
} from "@/lib/supabase/types";

/**
 * 퀴즈 문항 (앱출시.md §2 — `app/read/[variantId]/quiz/page.tsx`의 서버 쿼리).
 *
 * 문항은 service role로 읽고 여기서 깎는다 — `correct_index`와 `explanation`은
 * 채점 전에 클라이언트로 건너가지 않는다. `quiz_questions`에는 클라이언트가 읽을
 * RLS 정책이 아예 없으므로 이 길뿐이다.
 *
 * 이미 completed·saved까지 끝낸 아티클이면 퀴즈를 다시 풀리지 않고 저장된
 * quiz_answers로 결과를 다시 조립해 돌려준다(재채점 없음, 정책.md §7·§13).
 * 이때는 정답이 이미 공개된 상태이므로 review에 담아도 된다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user, supabase } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  const variantId = Number(new URL(request.url).searchParams.get("v"));
  if (!Number.isInteger(variantId)) {
    return apiError(request, "invalid variant", 400);
  }

  const { data: variantRow } = await supabase
    .from("article_variants")
    .select("id, title, articles(id, source_url, domains(slug, name_ko))")
    .eq("id", variantId)
    .maybeSingle();

  if (!variantRow) return apiError(request, "not found", 404);

  const variant = variantRow as unknown as {
    id: number;
    title: string;
    articles: {
      id: number;
      source_url: string;
      domains: { slug: string; name_ko: string } | null;
    } | null;
  };

  const article = variant.articles;
  if (!article) return apiError(request, "not found", 404);

  const admin = createAdminClient();
  if (!await canPublishArticle(admin, article.id)) return apiError(request, "not found", 404);

  const { data: rows } = await admin
    .from("quiz_questions")
    .select("*")
    .eq("variant_id", variantId)
    .order("position");

  const questionRows = (rows ?? []) as QuizQuestionRow[];
  if (questionRows.length === 0) return apiError(request, "no questions", 404);

  const { data: progress } = await admin
    .from("user_article_progress")
    .select("status, quiz_score, quiz_answers")
    .eq("user_id", user.id)
    .eq("article_id", article.id)
    .maybeSingle();

  if (progress && (progress.status === "completed" || progress.status === "saved")) {
    const answers = (progress.quiz_answers ?? {}) as Record<string, number>;
    const review: QuizReviewItem[] = questionRows.map((q) => {
      const picked = answers[String(q.id)] ?? null;
      return {
        questionId: q.id,
        prompt: q.prompt,
        options: q.options,
        picked,
        correct_index: q.correct_index,
        correct: picked === q.correct_index,
        explanation: q.explanation,
      };
    });

    return json(request, {
      mode: "result",
      articleTitle: variant.title,
      result: {
        score: progress.quiz_score ?? 0,
        correct: review.filter((r) => r.correct).length,
        total: review.length,
        review,
        prevLevel: null,
        newLevel: null,
        dir: "유지",
        rollingAccuracy: null,
        domain: article.domains?.slug ?? "",
        domainLabel: article.domains?.name_ko ?? "",
        articleId: article.id,
        isReview: progress.status === "saved",
        sourceUrl: article.source_url,
      },
    });
  }

  const questions: PublicQuizQuestion[] = questionRows.map(
    ({ id, position, prompt, options }) => ({ id, position, prompt, options }),
  );

  return json(request, {
    mode: "quiz",
    articleTitle: variant.title,
    variantId,
    questions,
  });
}
