import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORY_SLUGS } from "../lib/ai/schemas";
import { CATEGORY_COUNT, INGEST_RUNS_PER_DAY, INGEST_DAILY_BUDGET_USD,
  INGEST_BUDGET_PER_CATEGORY_USD, COLLECT_CANDIDATES_PER_SOURCE } from "../lib/policy";
import { selectUnseenCandidates } from "../lib/news/discovery";
import { FeedSource, parseFeed, type NewsItem } from "../lib/news/source";

async function main() {
  const { crons } = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
  assert.ok(crons.length <= 100, "stay within the Hobby cron count");
  assert.equal(new Set(crons.map(c => c.path)).size, crons.length);
  for (const cron of crons) assert.match(cron.schedule, /^\d+ \d+ \* \* \*$/, "each job runs once daily on Hobby");
  const jobs = (path: string) => crons.filter(c => c.path.split("?")[0] === path);
  const minute = (schedule: string) => { const [m,h] = schedule.split(" ").map(Number); return h * 60 + m; };
  const collections = jobs("/api/cron/ingest");
  assert.equal(collections.length, INGEST_RUNS_PER_DAY);
  for (const category of CATEGORY_SLUGS) {
    const processing = jobs(`/api/cron/ingest/${category}`);
    assert.equal(processing.length, INGEST_RUNS_PER_DAY);
    const times = processing.map(c => minute(c.schedule)).sort((a,b) => a-b);
    times.forEach((time,i) => assert.ok((times[(i+1)%times.length] - time + 1440) % 1440 >= 120,
      "same-category runs cannot overlap even with 59-minute Hobby jitter and a 5-minute worker"));
    processing.forEach((job,i) => assert.ok((minute(job.schedule) - minute(collections[i].schedule) + 1440) % 1440 >= 120,
      "collection has time to finish before processing"));
  }
  assert.equal(INGEST_BUDGET_PER_CATEGORY_USD * CATEGORY_COUNT * INGEST_RUNS_PER_DAY, INGEST_DAILY_BUDGET_USD,
    "extra scheduled rounds must not multiply the daily dollar allocation");
  const candidate = (source: string, id: number) => ({ item: { sourceId: source, sourceName: source,
    url: `https://publisher.invalid/${source}/${id}`, title: `Article ${id}`, summary: "", publishedAt: null } satisfies NewsItem });
  const knownRows = Array.from({length:50},(_,i) => candidate("a",i));
  const unseen = Array.from({length:30},(_,i) => candidate("a",50+i));
  const rows = [...knownRows,...unseen,unseen[0],candidate("b",1),candidate("b",2)];
  const selected = selectUnseenCandidates(rows,new Set(knownRows.map(r=>r.item.url)),COLLECT_CANDIDATES_PER_SOURCE);
  assert.equal(selected.length, COLLECT_CANDIDATES_PER_SOURCE+2, "known archive entries must not consume discovery slots");
  assert.equal(new Set(selected.map(r=>r.item.url)).size,selected.length);
  const second = selectUnseenCandidates(rows,new Set([...knownRows,...selected].map(r=>r.item.url)),COLLECT_CANDIDATES_PER_SOURCE);
  assert.equal(second.length,10,"the next scheduled run advances through the remaining archive");
  const sitemap = parseFeed('<urlset><url><loc>https://publisher.invalid/2014/10/30/old/</loc><lastmod>2026-10-24</lastmod></url></urlset>');
  assert.equal(sitemap[0].publishedAt,Date.parse("2014-10-30T00:00:00Z"),"recent sitemap updates must not turn old posts into new articles");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(`<rss><channel><item><title>Archive</title><link>https://publisher.invalid/old</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`);
  };
  try {
    const source = new FeedSource({id:"fixture",url:"https://publisher.invalid/feed",lang:"en",kind:"blog",archive:{url:"https://publisher.invalid/feed"}});
    assert.equal((await source.fetchLatest()).length,0);
    assert.equal((await source.fetchArchive()).length,1,"old eligible posts remain available outside the news freshness window");
    assert.equal(calls,1,"reuse a shared latest/archive feed within one collection run");
  } finally {globalThis.fetch=originalFetch;}
  console.log("Ingest schedule/discovery: four daily rounds, Hobby timing, budget allocation, unseen archive selection, source caps and feed reuse passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
