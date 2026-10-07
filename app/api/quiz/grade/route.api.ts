import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { applyQuiz, clampLevel } from "@/lib/level";
import { createAdminClient } from "@/lib/supabase/admin";
import { canPublishArticle } from "@/lib/content-rights";
import type {
  QuizQuestionRow,
  QuizReviewItem,
  UserDomainLevelRow,
} from "@/lib/supabase/types";

/**
 * 서버 채점 (spec §8 RLS 메모: "채점 API를 서버에서 처리 권장").
 *
 * 클라이언트는 correct_index를 받은 적이 없으므로 스스로 채점할 수 없고, 점수를
 * 자기 신고할 수도 없다. 이 라우트가:
 *   1. 정답을 읽고 미응답을 막고(정책.md §6),
 *   2. 첫 제출이면 user_article_progress를 completed로 쓰고(= 스쿱은 저장을
 *      눌러야 생긴다, 정책.md §2·§13),
 *   3. 첫 제출일 때만 user_domain_levels를 움직인다 — 재제출은 복습이라
 *      점수·수준을 건드리지 않는다(정책.md §7).
 * 전부 service role로 일어나며, 그래서 대응하는 클라이언트 쓰기 정책이 없다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

type GradeRequest = {
  variantId: number;
  /** { [quiz_questions.id]: 고른 보기 index } */
  answers: Record<string, number>;
};

export async function POST(request: Request) {
  const { user } = await getRequestContext(request);

  if (!user) {
    return apiError(request, "unauthenticated", 401);
  }

  let body: GradeRequest;
  try {
    body = await request.json();
  } catch {
    return apiError(request, "invalid body", 400);
  }

  const variantId = Number(body?.variantId);
  if (!Number.isInteger(variantId) || typeof body.answers !== "object") {
    return apiError(request, "invalid body", 400);
  }

  const admin = createAdminClient();

  const { data: variantRow } = await admin
    .from("article_variants")
    .select("id, level, articles(id, domain_id, source_url, domains(slug, name_ko))")
    .eq("id", variantId)
    .maybeSingle();

  if (!variantRow) {
    return apiError(request, "variant not found", 404);
  }

  const variant = variantRow as unknown as {
    id: number;
    level: number;
    articles: {
      id: number;
      domain_id: number;
      source_url: string;
      domains: { slug: string; name_ko: string };
    };
  };

  if (!variant.articles || !await canPublishArticle(admin, variant.articles.id)) {
    return apiError(request, "not found", 404);
  }

  const { data: questionRows } = await admin
    .from("quiz_questions")
    .select("*")
    .eq("variant_id", variant.id)
    .order("position");

  const questions = (questionRows ?? []) as QuizQuestionRow[];
  if (questions.length === 0) {
    return apiError(request, "no questions", 409);
  }

  // 정책.md §6 — 클라이언트는 이미 미응답을 막고 있지만, API를 직접 부르면
  // 빠진 키가 조용히 오답(0점)으로 채점돼 수준을 끌어내릴 수 있다. 서버도 막는다.
  const unanswered = questions.some(
    (q) => !Number.isInteger(body.answers[String(q.id)]),
  );
  if (unanswered) {
    return apiError(request, "incomplete", 400);
  }

  const review: QuizReviewItem[] = questions.map((question) => {
    const picked = body.answers[String(question.id)];
    return {
      questionId: question.id,
      prompt: question.prompt,
      options: question.options,
      picked,
      correct_index: question.correct_index,
      correct: picked === question.correct_index,
      explanation: question.explanation,
    };
  });

  const correct = review.filter((r) => r.correct).length;
  const total = questions.length;
  const score = correct / total;

  // 정책.md §7 — 진행 행이 이미 있으면(completed 또는 saved) 이 제출은 복습이다.
  // 점수·수준·저장 상태 어느 것도 건드리지 않는다.
  const { data: existingProgress } = await admin
    .from("user_article_progress")
    .select("id, status, quiz_score")
    .eq("user_id", user.id)
    .eq("article_id", variant.articles.id)
    .maybeSingle();

  const isReview =
    existingProgress?.status === "completed" || existingProgress?.status === "saved";

  if (isReview) {
    return json(request, {
      score,
      correct,
      total,
      review,
      prevLevel: null,
      newLevel: null,
      dir: "유지",
      rollingAccuracy: null,
      domain: variant.articles.domains.slug,
      domainLabel: variant.articles.domains.name_ko,
      articleId: variant.articles.id,
      isReview: true,
      sourceUrl: variant.articles.source_url,
    });
  }

  /* ── 수준 조정 (spec §4.3, 첫 제출만) ───────────────────────── */

  const { data: existingLevel } = await admin
    .from("user_domain_levels")
    .select("*")
    .eq("user_id", user.id)
    .eq("domain_id", variant.articles.domain_id)
    .maybeSingle();

  const current = existingLevel as UserDomainLevelRow | null;
  const change = applyQuiz(
    {
      // 수준 행이 없으면(온보딩에서 이 도메인을 안 골랐으면) 방금 읽은
      // variant의 수준을 출발점으로 삼는다.
      level: clampLevel(current?.level ?? variant.level),
      history: current?.recent_scores ?? [],
    },
    score,
  );

  const { error: levelError } = await admin.from("user_domain_levels").upsert(
    {
      user_id: user.id,
      domain_id: variant.articles.domain_id,
      level: change.level,
      rolling_accuracy: change.rollingAccuracy,
      quizzes_taken: (current?.quizzes_taken ?? 0) + 1,
      recent_scores: change.history,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,domain_id" },
  );
  if (levelError) throw levelError;

  /* ── 진행 기록 (정책.md §2 — 스쿱은 저장을 눌러야 생긴다) ─────── */

  const { error: progressError } = await admin.from("user_article_progress").upsert(
    {
      user_id: user.id,
      article_id: variant.articles.id,
      variant_id: variant.id,
      status: "completed",
      quiz_score: score,
      quiz_answers: body.answers,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,article_id" },
  );

  if (progressError) throw progressError;

  return json(request, {
    score,
    correct,
    total,
    review,
    prevLevel: change.prevLevel,
    newLevel: change.level,
    dir: change.dir,
    rollingAccuracy: change.rollingAccuracy,
    domain: variant.articles.domains.slug,
    domainLabel: variant.articles.domains.name_ko,
    articleId: variant.articles.id,
    isReview: false,
    sourceUrl: variant.articles.source_url,
  });
}
