/**
 * Read-only ingest run report. No cron invocation, LLM request or database write.
 *
 *   npm run report:ingest                      # last 30 runs + 24h/7d success rate per category
 *   npm run report:ingest -- --limit 100 --category cloud
 *   npm run report:ingest -- --json            # raw rows for further digging (details jsonb included)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local is loaded if present).
 */
import { createAdminClient } from "../lib/supabase/admin";
import { runRates, type IngestRunRow, type RunRate } from "../lib/news/ingest-runs";

const LIST_COLUMNS = "run_id,route,category,started_at,duration_ms,status,http_status,collected,classified," +
  "extracted,processed,failed,stopped_by,llm_calls,http_retries,error";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const kst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const when = (iso: string) => kst.format(new Date(iso)).replace(",", "");
const n = (v: number | null | undefined) => v === null || v === undefined ? "-" : String(v);
const pct = (r: RunRate) => `${Math.round(r.successRate * 100)}%`;

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  return [line(headers), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n");
}

async function main() {
  const limit = Math.min(1000, Math.max(1, Number(arg("limit") ?? 30) || 30));
  const category = arg("category");
  const admin = createAdminClient();

  let list = admin.from("ingest_runs").select(process.argv.includes("--json") ? "*" : LIST_COLUMNS)
    .order("started_at", { ascending: false }).limit(limit);
  if (category === "collect") list = list.in("route", ["collect", "collect-documents"]);
  else if (category) list = list.eq("category", category);
  const { data: recent, error } = await list;
  if (error) throw new Error(`ingest_runs unavailable: ${error.code ?? ""} ${error.message}`);
  const rows = (recent ?? []) as unknown as IngestRunRow[];

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000);
  const window: Pick<IngestRunRow, "route" | "category" | "status" | "processed" | "started_at">[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error: rateError } = await admin.from("ingest_runs")
      .select("route,category,status,processed,started_at").gte("started_at", weekAgo.toISOString())
      .order("started_at").range(offset, offset + 999);
    if (rateError) throw new Error(`ingest_runs unavailable: ${rateError.code ?? ""} ${rateError.message}`);
    window.push(...(data as typeof window));
    if (data.length < 1000) break;
  }

  console.log(`Last ${rows.length} ingest runs (KST)${category ? ` — ${category}` : ""}`);
  console.log(table(
    ["started", "run", "route", "status", "sec", "coll", "cls", "ext", "proc", "fail", "stop", "llm", "retry", "error"],
    rows.map((r) => [when(r.started_at), r.run_id.slice(0, 8), r.route === "process" ? r.category ?? "?" : r.route,
      r.status, (r.duration_ms / 1000).toFixed(0), n(r.collected), n(r.classified), n(r.extracted), n(r.processed),
      n(r.failed), r.stopped_by ?? "-", n(r.llm_calls), n(r.http_retries), (r.error ?? "").slice(0, 70)]),
  ));

  const day = runRates(window, new Date(now - 86_400_000));
  const week = runRates(window, weekAgo);
  const keys = [...new Set([...week.map((r) => r.key), ...day.map((r) => r.key)])].sort();
  const empty = (key: string): RunRate => ({ key, total: 0, ok: 0, partial: 0, failed: 0, processed: 0, successRate: 0 });
  console.log("\nSuccess rate (ok / runs; partial and failed counted separately; proc = articles made ready)");
  console.log(table(
    ["category", "24h ok", "24h runs", "24h partial", "24h failed", "24h proc", "7d ok", "7d runs", "7d partial", "7d failed", "7d proc"],
    keys.map((key) => {
      const d = day.find((r) => r.key === key) ?? empty(key);
      const w = week.find((r) => r.key === key) ?? empty(key);
      return [key, d.total ? pct(d) : "-", String(d.total), String(d.partial), String(d.failed), String(d.processed),
        w.total ? pct(w) : "-", String(w.total), String(w.partial), String(w.failed), String(w.processed)];
    }),
  ));
  console.log("\nDetails for one run: npm run report:ingest -- --json --limit 5 (details holds failures, sources, usage).");
}

main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : cause); process.exitCode = 1; });
