import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { getDomains, getLevels } from "@/lib/feed";
import { countCorrect, levelFromQuizScore, publicQuiz, type PublicQuizQuestion } from "@/lib/onboarding-quiz";
import { getDomainTerms, levelFromTermCheck, type DomainTerms } from "@/lib/terms";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 온보딩 데이터 (앱출시.md §2 — `app/onboarding/page.tsx`의 서버 쿼리가 여기로 왔다).
 *
 * 세션이 없어도 200이다. `domains`와 `domain_terms`는 RLS가 전체 읽기를 허용하고
 * (supabase/policies.sql), 로그인 화면이 온보딩에 있다.
 *
 * 레벨은 분야별 8문항 퀴즈로 정한다. 문항은 정답 없이 내려가고, 채점은 POST에서
 * 서버가 한다. `domainTerms`와 `rareChecked` 입력은 용어 체크 시절의 앱을 위해 남겼다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user, supabase } = await getRequestContext(request);

  const domains = await getDomains(supabase);
  const [levels, termsByDomain] = await Promise.all([
    user ? getLevels(supabase, user.id) : new Map<number, number>(),
    getDomainTerms(supabase, domains.map((d) => d.id)),
  ]);

  const domainTerms: Record<string, DomainTerms> = {};
  for (const [domainId, terms] of termsByDomain) domainTerms[String(domainId)] = terms;

  const quizzes: Record<string, PublicQuizQuestion[]> = {};
  if (user) {
    for (const domain of domains) {
      const quiz = publicQuiz(domain.slug);
      if (quiz) quizzes[String(domain.id)] = quiz;
    }
  }

  return json(request, {
    domains,
    levels: Object.fromEntries(levels),
    domainTerms,
    quizzes,
    isSignedIn: user != null,
  });
}

type Graded = { domainId: number; correct: number | null; level: 1 | 2 | 3 };

/** 입력 하나 → 시작 레벨. 형식이 틀리면 null. */
function grade(selection: unknown, slugs: Map<number, string>): Graded | null {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;
  const { domainId, answers, skipped, rareChecked } = selection as Record<string, unknown>;
  const slug = typeof domainId === "number" ? slugs.get(domainId) : undefined;
  if (typeof domainId !== "number" || !Number.isSafeInteger(domainId) || slug === undefined) return null;

  const given = [answers !== undefined, skipped !== undefined, rareChecked !== undefined].filter(Boolean).length;
  if (given !== 1) return null;
  if (skipped !== undefined) return skipped === true ? { domainId, correct: null, level: 2 } : null;
  if (rareChecked !== undefined) {
    return Number.isSafeInteger(rareChecked) && (rareChecked as number) >= 0 && (rareChecked as number) <= 4
      ? { domainId, correct: null, level: levelFromTermCheck(rareChecked as number) } : null;
  }
  const correct = countCorrect(slug, answers);
  return correct === null ? null : { domainId, correct, level: levelFromQuizScore(correct) };
}

/** Existing proficiency is retained; only newly selected domains receive a starting level. */
export async function POST(request: Request) {
  const { user, supabase } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(request, "invalid body", 400); }
  const selections = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).selections : null;
  if (!Array.isArray(selections) || selections.length > 32) return apiError(request, "invalid body", 400);

  const slugs = new Map((await getDomains(supabase)).map((d) => [d.id, d.slug]));
  const results: Graded[] = [];
  for (const selection of selections) {
    const graded = grade(selection, slugs);
    if (!graded || results.some((r) => r.domainId === graded.domainId)) {
      return apiError(request, "invalid body", 400);
    }
    results.push(graded);
  }

  try {
    const { data, error } = await createAdminClient().rpc("save_onboarding_preferences", {
      p_user_id: user.id,
      p_selections: results.map(({ domainId, level }) => ({ domainId, level })),
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid preferences result");
    if (typeof data.error === "string") {
      return apiError(request, data.error, data.error === "invalid body" ? 400 : 503);
    }
    if (data.ok !== true) throw new Error("Invalid preferences result");
    return json(request, { ...data, results });
  } catch {
    return apiError(request, "preferences temporarily unavailable", 503);
  }
}
