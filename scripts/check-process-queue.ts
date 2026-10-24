import assert from "node:assert/strict";
import { processQueue } from "../lib/news/process-queue";

async function main() {
  const candidates = ["a", "a", "a", "a", "b"].map((source, id) => ({ source, id }));
  const attempted: number[] = [];
  let activeA = 0;
  const result = await processQueue(candidates, {
    cap: 4, maxPerSource: 4, concurrency: 2, canStart: () => null,
    process: async (row) => {
      attempted.push(row.id);
      if (row.source === "a") {
        activeA++;
        assert.equal(activeA, 1, "do not run two articles from one publisher concurrently");
        await new Promise(resolve => setTimeout(resolve, 1));
        activeA--;
      }
      return true;
    },
  });
  assert.equal(result.processed, 4);
  assert.deepEqual(attempted.slice(0, 2), [0, 4], "try distinct publishers before filling from the same publisher");
  assert.deepEqual(new Set(attempted), new Set([0, 1, 2, 4]));
  assert.equal(result.stoppedBy, "cap");

  const sole = await processQueue(candidates.filter(row => row.source === "a"), {
    cap: 4, maxPerSource: 4, concurrency: 2, canStart: () => null, process: async () => true,
  });
  assert.equal(sole.processed, 4, "a one-publisher queue must use all available slots");

  const defaultLimit = await processQueue(candidates, {
    cap: 4, concurrency: 2, canStart: () => null, process: async () => true,
  });
  assert.equal(defaultLimit.processed, 2, "unspecified per-source cap remains one");
  console.log("Processing queue: publisher diversity first, same-publisher fallback, per-source serialization and default cap passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
