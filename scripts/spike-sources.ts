/**
 * 소스 스파이크. CS 도메인 전환(소스분류.md)의 소스 목록을 실측한다.
 *
 * 피드마다 최근 발행량을 세고, 최신 글 몇 편을 실제로 열어 Readability로 본문이
 * 나오는지, 코드·표를 뺀 본문이 원문 상한(정책.md §3, 12,000자) 안에 드는지,
 * robots.txt가 그 경로를 막는지 본다. 아카이브가 있는 소스는 아카이브의 오래된 글도
 * 같은 방식으로 연다.
 *
 *   npm run spike:sources
 *   SPIKE_PER_FEED=6 npm run spike:sources
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";

import { MIN_BODY_CHARS } from "../lib/news/extract";
import { SOURCES, type Source } from "../lib/news/feeds";
import { USER_AGENT, parseFeed, type FeedEntry } from "../lib/news/source";

/** 정책.md §3의 원문 입력 상한. */
const MAX_BODY_CHARS = 12000;

const PER_FEED = Number(process.env.SPIKE_PER_FEED ?? 4);

type Sample = {
  title: string;
  url: string;
  status: number | string;
  /** Readability 본문 전체 */
  chars: number;
  /** pre·code·table·figure를 뺀 본문. 재작성에 실제로 쓰일 분량에 가깝다. */
  proseChars: number;
  robotsBlocked: string | null;
};

async function extract(url: string): Promise<Omit<Sample, "title" | "robotsBlocked">> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return { url: response.url, status: response.status, chars: 0, proseChars: 0 };

    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(await response.text(), { url: response.url, virtualConsole });
    const parsed = new Readability(dom.window.document).parse();
    dom.window.close();

    const body = new JSDOM(parsed?.content ?? "", { virtualConsole });
    const chars = squash(body.window.document.body.textContent).length;
    body.window.document
      .querySelectorAll("pre, code, table, figure")
      .forEach((node) => node.remove());
    const proseChars = squash(body.window.document.body.textContent).length;
    body.window.close();

    return { url: response.url, status: response.status, chars, proseChars };
  } catch (cause) {
    return { url, status: `error: ${String(cause).slice(0, 40)}`, chars: 0, proseChars: 0 };
  }
}

const squash = (text: string | null) => (text ?? "").replace(/\s+/g, " ").trim();

const robotsCache = new Map<string, Promise<string[]>>();

/** `User-agent: *` 그룹의 Disallow 규칙만 본다. 우리 UA 전용 그룹은 두지 않는다. */
function disallowRules(origin: string): Promise<string[]> {
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } })
        .then((r) => (r.ok ? r.text() : ""))
        .then((text) => {
          const rules: string[] = [];
          let inStarGroup = false;
          let groupHasRules = false;
          for (const raw of text.split(/\r?\n/)) {
            const match = raw.replace(/#.*/, "").trim().match(/^([\w-]+)\s*:\s*(.*)$/);
            if (!match) continue;
            const [, key, value] = match;
            if (key.toLowerCase() === "user-agent") {
              if (groupHasRules) inStarGroup = groupHasRules = false;
              if (value === "*") inStarGroup = true;
            } else {
              groupHasRules = true;
              if (inStarGroup && key.toLowerCase() === "disallow" && value) rules.push(value);
            }
          }
          return rules;
        })
        .catch(() => []),
    );
  }
  return robotsCache.get(origin)!;
}

async function robotsBlocked(url: string): Promise<string | null> {
  const { origin, pathname, search } = new URL(url);
  for (const rule of await disallowRules(origin)) {
    const pattern = rule
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\\\$$/, "$");
    if (new RegExp(`^${pattern}`).test(pathname + search)) return rule;
  }
  return null;
}

type Report = Source & {
  feedStatus: number | string;
  last14d: number;
  samples: Sample[];
  /** 아카이브 주소에서 받은 글 수와, 그중 가장 오래된 글들로 잰 표본. */
  archiveSize?: number;
  archiveSamples?: Sample[];
};

async function fetchEntries(url: string): Promise<{ status: number | string; entries: FeedEntry[] }> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { status: response.status, entries: [] };
    return { status: response.status, entries: parseFeed(await response.text()) };
  } catch (cause) {
    return { status: `error: ${String(cause).slice(0, 40)}`, entries: [] };
  }
}

async function sample(entries: FeedEntry[]): Promise<Sample[]> {
  const samples: Sample[] = [];
  for (const entry of entries) {
    const result = await extract(entry.link);
    samples.push({
      title: entry.title,
      ...result,
      robotsBlocked: result.status === 200 ? await robotsBlocked(result.url) : null,
    });
  }
  return samples;
}

async function measure(source: Source): Promise<Report> {
  const { status, entries } = await fetchEntries(source.url);
  const since = Date.now() - 14 * 86_400_000;
  const report: Report = {
    ...source,
    feedStatus: status,
    last14d: entries.filter((e) => e.publishedAt >= since).length,
    samples: await sample(entries.slice(0, PER_FEED)),
  };

  if (source.archive) {
    const { match } = source.archive;
    const archived = (await fetchEntries(source.archive.url)).entries.filter(
      (e) => !match || e.link.includes(match),
    );
    report.archiveSize = archived.length;
    report.archiveSamples = await sample(archived.slice(-PER_FEED));
  }
  return report;
}

function summarize(samples: Sample[]) {
  const extracted = samples.filter((s) => s.chars >= MIN_BODY_CHARS);
  const prose = extracted.map((s) => s.proseChars).sort((a, b) => a - b);
  return {
    extracted: `${extracted.length}/${samples.length}`,
    fits: `${extracted.filter((s) => s.proseChars <= MAX_BODY_CHARS).length}/${samples.length}`,
    median: prose.length ? String(prose[Math.floor(prose.length / 2)]) : "-",
    blocked: samples.filter((s) => s.robotsBlocked).length,
  };
}

async function main() {
  const reports: Report[] = [];
  const queue = [...SOURCES];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        reports.push(await measure(next));
        process.stderr.write(".");
      }
    }),
  );
  process.stderr.write("\n");
  reports.sort((a, b) => SOURCES.findIndex((s) => s.id === a.id) - SOURCES.findIndex((s) => s.id === b.id));

  console.log(
    ["source", "lang", "kind", "feed", "14일", "추출", "≤12k", "prose 중앙값", "robots", "아카이브"].join("\t"),
  );
  for (const r of reports) {
    const recent = summarize(r.samples);
    const archive = r.archiveSamples && summarize(r.archiveSamples);
    const blocked = recent.blocked + (archive?.blocked ?? 0);
    console.log(
      [
        r.id,
        r.lang,
        r.kind,
        r.feedStatus,
        r.last14d,
        recent.extracted,
        recent.fits,
        recent.median,
        blocked ? `차단 ${blocked}` : "-",
        archive
          ? `${r.archiveSize}편 · 추출 ${archive.extracted} · ≤12k ${archive.fits} · 중앙값 ${archive.median}`
          : "-",
      ].join("\t"),
    );
  }

  const samples = reports.flatMap((r) => [...r.samples, ...(r.archiveSamples ?? [])]);
  const extracted = samples.filter((s) => s.chars >= MIN_BODY_CHARS).length;
  console.log(
    `\n전체 추출 ${extracted}/${samples.length} (${((extracted / samples.length) * 100).toFixed(1)}%)`,
  );

  mkdirSync("spike-out", { recursive: true });
  writeFileSync("spike-out/sources.json", JSON.stringify(reports, null, 2), "utf-8");
  console.log("원자료 → spike-out/sources.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
