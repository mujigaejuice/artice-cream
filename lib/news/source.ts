import { XMLParser } from "fast-xml-parser";

import type { Source, SourceKind } from "./feeds";

/**
 * 소스 주도 뉴스 수집 (소스분류.md §3). 발행처 피드 41개를 직접 읽는다 —
 * 도메인마다 구글뉴스를 검색하던 이전 방식(GoogleNewsRss)은 지웠다. 분류는
 * 소스가 아니라 LLM이 글마다 정한다(lib/ai/pipeline.ts classifyCandidates).
 */

export type NewsItem = {
  title: string;
  /** 발행처 URL. */
  url: string;
  /** lib/news/feeds.ts의 Source.id. articles.source에 그대로 저장한다. */
  sourceId: string;
  sourceName: string;
  /** RSS description — 분류기 입력(제목만으로 애매할 때 보조 신호). */
  summary: string;
  publishedAt: Date | null;
};

export interface NewsSource {
  readonly id: string;
  readonly lang: "ko" | "en";
  readonly kind: SourceKind;
  /** 최근 글. 기본은 14일 창이고, 저빈도 소스는 2차 창에서 최신 몇 편만 건진다. */
  fetchLatest(): Promise<NewsItem[]>;
  /** 아카이브가 있는가. 없는 소스에 `fetchArchive`를 부르면 빈 배열이다. */
  readonly hasArchive: boolean;
  /** 지난 글(아카이브가 있는 소스만). 호출자가 그중 일부를 무작위로 고른다. */
  fetchArchive?(): Promise<NewsItem[]>;
}

export const USER_AGENT =
  "Mozilla/5.0 (compatible; artice-cream/0.1; +https://artice-cream.vercel.app)";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "#text" in v) return String((v as { "#text": unknown })["#text"]);
  return String(v);
}

export type FeedEntry = { title: string; link: string; summary: string; publishedAt: number };

/**
 * 사이트맵에는 제목이 없다. 소스분류.md §2가 정해 둔 대로 URL 슬러그를 제목 대신
 * 쓴다. 주소를 통째로 넘기면 분류기가 읽을 제목 신호가 사라진다.
 *
 *   /blog/2017/03/what-happens-when-you-type-a-url/ → "what happens when you type a url"
 */
function titleFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean).reverse();
    const slug = segments.find((seg) => /[a-z]{3}/i.test(seg));
    if (!slug) return url;
    return slug.replace(/\.(html?|php)$/i, "").replace(/[-_]+/g, " ").trim() || url;
  } catch {
    return url;
  }
}

/**
 * RSS 2.0, Atom, 사이트맵(`<urlset>`) 셋 다 읽는다. 사이트맵은 제목이 없으므로
 * URL 슬러그로 제목을 만든다.
 */
export function parseFeed(xmlText: string): FeedEntry[] {
  const doc = xml.parse(xmlText);

  const urls = asArray<Record<string, unknown>>(doc?.urlset?.url);
  if (urls.length) {
    return urls.map((u) => ({
      title: titleFromUrl(str(u.loc)),
      link: str(u.loc),
      summary: "",
      publishedAt: Date.parse(str(u.lastmod)) || 0,
    }));
  }

  const rss = asArray<Record<string, unknown>>(doc?.rss?.channel?.item);
  if (rss.length) {
    return rss
      .map((i) => ({
        title: str(i.title),
        link: str(i.link) || str(i.guid),
        summary: str(i.description),
        publishedAt: Date.parse(str(i.pubDate)) || 0,
      }))
      .sort((a, b) => b.publishedAt - a.publishedAt);
  }

  const atom = asArray<Record<string, unknown>>(doc?.feed?.entry);
  return atom
    .map((e) => {
      type Link = Record<string, string>;
      const links = asArray(e.link as Link | Link[] | undefined);
      const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
      return {
        title: str(e.title),
        link: alt?.["@_href"] ?? str(e.id),
        summary: str(e.summary) || str(e.content),
        publishedAt: Date.parse(str(e.published) || str(e.updated)) || 0,
      };
    })
    .filter((e) => e.link.startsWith("http"))
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

async function fetchEntries(url: string): Promise<FeedEntry[]> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`feed ${response.status} for ${url}`);
  return parseFeed(await response.text());
}

const DAY_MS = 86_400_000;

/** 소스분류.md §2 — 일반 피드는 최근 14일 글만 후보로 본다. */
const RECENT_DAYS = 14;

/**
 * 14일 창이 통째로 비는 저빈도 소스를 위한 2차 창.
 *
 * Embrace The Red와 OWASP GenAI는 주 0.2편이라 14일로 자르면 대부분의 날에
 * 목록에서 빠진다. 둘 다 AI 보안 전용 소스라 그 분류의 공급이 그만큼 마른다.
 * 2026-09-22 실측에서 최신 글이 각각 26일·19일 전이었다.
 */
const FALLBACK_DAYS = 45;
const FALLBACK_ITEMS = 2;

/**
 * 한 피드가 후보를 독식하지 못하게 하는 상한.
 *
 * 분류마다 소스당 1편까지만 고르므로(인제스트) 한 피드에서 50건을 분류해도 49건은
 * 어차피 버려진다. 2026-09-22 실측에서 14일 후보 404건 중 150건이 AI타임스·
 * 데일리시큐·The Hacker News 셋이었다.
 */
const MAX_ITEMS_PER_FEED = 20;

/** 소스분류.md §2 — 아카이브에서 2016년 이전 글은 쓰지 않는다. */
const ARCHIVE_MIN_YEAR = 2016;

/**
 * 아카이브 주소의 `{page}`를 `pages` 범위에서 무작위로 고른 값으로 바꾼다.
 * 범위가 없는 소스(피드 하나에 전체 글이 든 Brooker, 사이트맵인 Julia Evans)는
 * 주소를 그대로 쓴다.
 */
function archiveUrl(archive: NonNullable<Source["archive"]>): string {
  if (!archive.pages) return archive.url;
  const [lo, hi] = archive.pages;
  const step = archive.step ?? 1;
  const slots = Math.max(1, Math.floor((hi - lo) / step) + 1);
  const page = lo + step * Math.floor(Math.random() * slots);
  return archive.url.replace("{page}", String(page));
}

/** 소스 하나에 대한 NewsSource. lib/news/feeds.ts의 설정을 그대로 감싼다. */
export class FeedSource implements NewsSource {
  readonly id: string;
  readonly lang: "ko" | "en";
  readonly kind: SourceKind;
  readonly hasArchive: boolean;

  constructor(private readonly source: Source) {
    this.id = source.id;
    this.lang = source.lang;
    this.kind = source.kind;
    this.hasArchive = Boolean(source.archive);
  }

  private toItem(e: { title: string; link: string; summary: string; publishedAt: number }): NewsItem {
    return {
      title: e.title,
      url: e.link,
      sourceId: this.source.id,
      sourceName: this.source.id,
      summary: e.summary,
      publishedAt: e.publishedAt ? new Date(e.publishedAt) : null,
    };
  }

  async fetchLatest(): Promise<NewsItem[]> {
    const entries = (await fetchEntries(this.source.url)).sort(
      (a, b) => b.publishedAt - a.publishedAt,
    );
    const within = (days: number) => {
      const since = Date.now() - days * DAY_MS;
      return entries.filter((e) => e.publishedAt === 0 || e.publishedAt >= since);
    };

    const recent = within(RECENT_DAYS);
    // 14일이 비면 저빈도 소스다. 2차 창에서 최신 몇 편만 건진다.
    const picked = recent.length ? recent : within(FALLBACK_DAYS).slice(0, FALLBACK_ITEMS);
    return picked.slice(0, MAX_ITEMS_PER_FEED).map((e) => this.toItem(e));
  }

  async fetchArchive(): Promise<NewsItem[]> {
    const archive = this.source.archive;
    if (!archive) return [];
    const oldest = Date.UTC(ARCHIVE_MIN_YEAR, 0, 1);
    const entries = await fetchEntries(archiveUrl(archive));
    return entries
      .filter((e) => !archive.match || e.link.includes(archive.match))
      .filter((e) => e.publishedAt === 0 || e.publishedAt >= oldest)
      .map((e) => this.toItem(e));
  }
}

export function feedSources(sources: Source[]): FeedSource[] {
  return sources.map((s) => new FeedSource(s));
}
