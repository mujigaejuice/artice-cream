import type { SupabaseClient } from "@supabase/supabase-js";

import type { DomainTermRow } from "./supabase/types";

/**
 * 정책.md §15 — 온보딩 용어 체크에 쓰는 분야별 용어 목록.
 *
 * `domain_terms`가 서빙 경로다: 온보딩은 이 표만 읽는다. `refreshDomainTerms`가
 * 쌓인 `article_variants.glossary`에서 자동 집계해 이 표를 덮어쓴다 — 인제스트
 * 뒤에 분류별로 한 번씩 부르면 된다(app/api/cron/ingest/route.ts). 아직 집계가
 * 없는 분야는 표가 비어 있고, 그러면 온보딩이 그 분야의 체크를 건너뛴다.
 */

export type DomainTerms = { easy: string[]; rare: string[] };

const MAX_PER_TIER = 4;

export async function getDomainTerms(
  supabase: SupabaseClient,
  domainIds: number[],
): Promise<Map<number, DomainTerms>> {
  const map = new Map<number, DomainTerms>();
  if (domainIds.length === 0) return map;

  const { data } = await supabase
    .from("domain_terms")
    .select("domain_id, term, tier")
    .in("domain_id", domainIds);

  for (const row of (data ?? []) as DomainTermRow[]) {
    const entry = map.get(row.domain_id) ?? { easy: [], rare: [] };
    if (row.tier === "easy" && entry.easy.length < MAX_PER_TIER) entry.easy.push(row.term);
    if (row.tier === "rare" && entry.rare.length < MAX_PER_TIER) entry.rare.push(row.term);
    map.set(row.domain_id, entry);
  }
  return map;
}

/**
 * 도메인 하나의 용어 목록을 다시 집계해 domain_terms를 덮어쓴다.
 *
 * level 1 variant에서 하이라이트된 용어는 쉬운 축, level 3에만 나오고 level 1에는
 * 없는 용어는 드문 축이다(정책.md §15). 빈도순으로 상위 몇 개만 남긴다 — 온보딩
 * 화면 하나에 다 보여줄 것도 아니고, 표가 무한히 커질 이유도 없다.
 */
export async function refreshDomainTerms(
  admin: SupabaseClient,
  domainId: number,
): Promise<void> {
  const { data: variants } = await admin
    .from("article_variants")
    .select("level, glossary, articles!inner(domain_id)")
    .eq("articles.domain_id", domainId);

  const easyCount = new Map<string, number>();
  const rareCount = new Map<string, number>();

  for (const row of (variants ?? []) as unknown as {
    level: number;
    glossary: Record<string, { term: string }>;
  }[]) {
    const terms = Object.values(row.glossary ?? {}).map((t) => t.term);
    const bucket = row.level === 1 ? easyCount : row.level === 3 ? rareCount : null;
    if (!bucket) continue;
    for (const term of terms) bucket.set(term, (bucket.get(term) ?? 0) + 1);
  }

  // 드문 축 = level 3에는 나왔지만 level 1에는 한 번도 안 나온 용어.
  for (const term of easyCount.keys()) rareCount.delete(term);

  const topN = (counts: Map<string, number>, n: number) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([term]) => term);

  const rows = [
    ...topN(easyCount, 20).map((term) => ({ domain_id: domainId, term, tier: "easy" as const })),
    ...topN(rareCount, 20).map((term) => ({ domain_id: domainId, term, tier: "rare" as const })),
  ];

  await admin.from("domain_terms").delete().eq("domain_id", domainId);
  if (rows.length > 0) {
    await admin.from("domain_terms").insert(rows);
  }
}

/**
 * 온보딩 용어 체크 결과 → 초기 수준(정책.md §15).
 *
 * 드문 축에서 고른 개수만 본다 — 쉬운 축은 "얼마나 겸손한가"를 가릴 뿐 판정을
 * 바꾸지 않는다(표의 두 "0" 행이 결국 같은 결과로 수렴하는 이유).
 */
export function levelFromTermCheck(rareChecked: number): 1 | 2 | 3 {
  if (rareChecked >= 3) return 3;
  if (rareChecked >= 1) return 2;
  return 1;
}
