/** Shared by articles in this process; separate serverless instances have separate limits. */
export const LLM_CONCURRENCY = 6;

let active = 0;
const waiting: (() => void)[] = [];

async function acquire(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (active < LLM_CONCURRENCY) {
    active += 1;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const start = () => {
      signal?.removeEventListener("abort", abort);
      active += 1;
      resolve();
    };
    const abort = () => {
      const index = waiting.indexOf(start);
      if (index !== -1) waiting.splice(index, 1);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason);
    };
    waiting.push(start);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export async function withLlmSlot<T>(call: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  await acquire(signal);
  try {
    signal?.throwIfAborted();
    return await call();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}
