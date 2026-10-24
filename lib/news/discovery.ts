import type { NewsItem } from "./source";

/** Select unseen URLs before applying the per-publisher limit, including archive candidates. */
export function selectUnseenCandidates<T extends { item: NewsItem }>(
  candidates: T[], known: Set<string>, perSource: number,
): T[] {
  const seen = new Set(known);
  const counts = new Map<string, number>();
  return candidates.filter(({ item }) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    const count = counts.get(item.sourceId) ?? 0;
    if (count >= perSource) return false;
    counts.set(item.sourceId, count + 1);
    return true;
  });
}
