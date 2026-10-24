/** Bound article concurrency and reserve source/cap slots before asynchronous work. */
export const ARTICLE_CONCURRENCY = 2;
/** Start only with enough time for a typical article; slow work may use the remaining window. */
export const ARTICLE_START_SECONDS = 110;
export const ARTICLE_TIMEOUT_SECONDS = 240;

export function articleTimeoutMs(remainingSeconds: number): number {
  // Keep 15 seconds inside the run's work window for final logging / term refresh.
  return Math.max(1, Math.floor(Math.min(ARTICLE_TIMEOUT_SECONDS, remainingSeconds - 15) * 1000));
}

export type ProcessStop = "done" | "cap" | "time" | "budget";

export async function processQueue<T extends { source: string | null }>(
  candidates: T[],
  options: {
    cap: number;
    /** Prefer distinct publishers, then fill unused slots from eligible publishers. */
    maxPerSource?: number;
    concurrency: number;
    canStart: () => "time" | "budget" | null;
    process: (candidate: T) => Promise<boolean>;
  },
): Promise<{ processed: number; skippedSource: number; stoppedBy: ProcessStop }> {
  const pending = [...candidates];
  const completedBySource = new Map<string, number>();
  const reservedSources = new Set<string>();
  let processed = 0;
  let inFlight = 0;
  let stoppedBy: ProcessStop = "done";
  const maxPerSource = options.maxPerSource ?? 1;
  if (!Number.isInteger(maxPerSource) || maxPerSource < 1) throw new Error("maxPerSource must be a positive integer");

  async function worker() {
    while (processed + inFlight < options.cap) {
      // Reserved candidates stay queued: if that source's in-flight article fails,
      // the worker that releases it can try its next candidate.
      const firstFromSource = (row: T) => !row.source ||
        ((completedBySource.get(row.source) ?? 0) === 0 && !reservedSources.has(row.source));
      let index = pending.findIndex(firstFromSource);
      if (index === -1) index = pending.findIndex((row) => !row.source ||
        (!reservedSources.has(row.source) && (completedBySource.get(row.source) ?? 0) < maxPerSource));
      if (index === -1) return;
      const stop = options.canStart();
      if (stop) { stoppedBy = stop; return; }

      const [row] = pending.splice(index, 1);
      inFlight += 1;
      if (row.source) reservedSources.add(row.source);
      try {
        if (await options.process(row)) {
          processed += 1;
          if (row.source) completedBySource.set(row.source, (completedBySource.get(row.source) ?? 0) + 1);
        }
      } finally {
        inFlight -= 1;
        if (row.source) reservedSources.delete(row.source);
      }
    }
  }

  const workers = await Promise.allSettled(Array.from({ length: options.concurrency }, worker));
  for (const result of workers) if (result.status === "rejected") throw result.reason;
  return {
    processed,
    skippedSource: pending.filter((row) => row.source && (completedBySource.get(row.source) ?? 0) > 0).length,
    stoppedBy: processed >= options.cap ? "cap" : stoppedBy,
  };
}
