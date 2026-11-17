import { ONBOARDING_QUIZ } from "./onboarding-quiz-data";

/**
 * 온보딩 레벨 퀴즈의 공개 변환·채점·판정 (설계: docs/superpowers/specs/2026-11-17-onboarding-quiz-design.md).
 *
 * 서버 전용이다 — 정답이 든 lib/onboarding-quiz-data.ts를 import한다. 클라이언트는
 * 이 파일에서 `import type`만 한다.
 */

export const QUIZ_LENGTH = 8;

export type PublicQuizQuestion = { prompt: string; options: string[] };

/** 맞힌 개수 → 시작 레벨. 0~3개 Lv1, 4~6개 Lv2, 7~8개 Lv3. */
export function levelFromQuizScore(correct: number): 1 | 2 | 3 {
  if (correct >= 7) return 3;
  if (correct >= 4) return 2;
  return 1;
}

/** 분야 slug에서 정해지는 난수열. 요청마다 같은 배치가 나와야 채점이 맞는다. */
function seeded(slug: string): () => number {
  let state = 2166136261;
  for (const char of slug) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const layouts = new Map<string, number[][]>();

/**
 * 문항마다 화면 자리 → 원래 보기 번호(0이 정답). 정답 자리는 분야마다 0~3이 두 번씩
 * 나오도록 섞어서 위치로 찍는 것을 막는다.
 */
function layout(slug: string): number[][] | null {
  const items = ONBOARDING_QUIZ[slug];
  if (!items) return null;
  let cached = layouts.get(slug);
  if (!cached) {
    const random = seeded(slug);
    const slots = shuffle(items.map((_, i) => i % 4), random);
    cached = slots.map((slot) => {
      const wrong = shuffle([1, 2, 3], random);
      const order = [...wrong];
      order.splice(slot, 0, 0);
      return order;
    });
    layouts.set(slug, cached);
  }
  return cached;
}

/** 클라이언트로 내려가는 문항. 정답과 난이도는 들어 있지 않다. */
export function publicQuiz(slug: string): PublicQuizQuestion[] | null {
  const order = layout(slug);
  if (!order) return null;
  return ONBOARDING_QUIZ[slug].map((item, i) => ({
    prompt: item.prompt,
    options: order[i].map((original) => item.options[original]),
  }));
}

/**
 * 화면에 보인 순서 기준 답안(0~3, 모르겠어요는 null) 8개를 채점한다. 형식이 틀리거나
 * 퀴즈가 없는 분야면 null.
 */
export function countCorrect(slug: string, answers: unknown): number | null {
  const order = layout(slug);
  if (!order || !Array.isArray(answers) || answers.length !== QUIZ_LENGTH) return null;
  let correct = 0;
  for (const [i, answer] of answers.entries()) {
    if (answer === null) continue;
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) return null;
    if (order[i][answer] === 0) correct++;
  }
  return correct;
}
