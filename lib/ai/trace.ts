import type { Level } from "./schemas";

export type TraceEvent = {
  event: "call" | "validation" | "length";
  articleId?: number;
  runId?: string;
  level?: Level;
  stage?: "rewrite" | "glossary" | "quiz" | "classify";
  pass?: "initial" | "length";
  repair?: boolean;
  [key: string]: unknown;
};

export type TraceContext = Pick<TraceEvent, "articleId" | "runId" | "level" | "stage" | "pass" | "repair"> & {
  onTrace?: (event: TraceEvent) => void;
};

/** Metadata only: never log prompts, generated text, credentials, or gateway response bodies. */
export function trace(context: TraceContext | undefined, event: TraceEvent): void {
  if (!context) return;
  const { onTrace, ...metadata } = context;
  const record = { ...metadata, ...event };
  console.log("[llm:trace]", JSON.stringify(record));
  onTrace?.(record);
}
