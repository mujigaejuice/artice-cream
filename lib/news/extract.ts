import { Readability } from "@mozilla/readability";
// jsdom은 26.1.0에 고정한다. 27부터는 의존성 안에 ESM 전용 패키지(@exodus/bytes)가
// 들어오는데, Vercel 런타임은 Node를 --no-experimental-require-module로 띄워서
// 이 라우트가 모듈을 불러오는 단계에서 죽는다. 올리려면 이 플래그로 먼저 확인한다.
import { JSDOM } from "jsdom";

import { MAX_BODY_CHARS } from "../policy";
import { USER_AGENT, type NewsItem } from "./source";
import type { SourceKind } from "./feeds";

/**
 * 본문 추출. 소스가 발행처 피드로 바뀌면서(소스분류.md) 구글뉴스 링크 해석과
 * 화이트리스트는 필요 없어졌다 — 41개 소스는 전부 직접 fetch 가능한 발행처다.
 *
 * 길이 규칙은 소스 유형에 따라 다르다(소스분류.md §2):
 *   - news: 역피라미드라 앞에서 MAX_BODY_CHARS까지만 쓴다.
 *   - blog: 결론이 뒤에 오므로 자르지 않고, 넘으면 그 글을 건너뛴다.
 */

export type ExtractFailure =
  | "fetch-failed"
  | "not-html"
  | "no-article"
  | "too-short"
  | "too-long"
  | "paywalled";

export type ExtractResult =
  | {
      ok: true;
      url: string;
      host: string;
      title: string;
      text: string;
      charCount: number;
      /** og:image. spec §8 articles.image_url용. 없으면 null. */
      imageUrl: string | null;
    }
  | { ok: false; url: string; host: string | null; reason: ExtractFailure };

/** Below this, Readability found navigation chrome rather than an article. */
export const MIN_BODY_CHARS = 600;

const PAYWALL_MARKERS = [
  "구독자 전용",
  "유료 기사",
  "로그인 후 이용",
  "subscribe to continue",
  "this content is for subscribers",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function extractArticle(
  item: Pick<NewsItem, "url" | "title">,
  kind: SourceKind = "news",
): Promise<ExtractResult> {
  const host = hostOf(item.url);
  if (!host) {
    return { ok: false, url: item.url, host: null, reason: "fetch-failed" };
  }

  let html: string;
  try {
    const response = await fetch(item.url, {
      headers: { "user-agent": USER_AGENT },
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, url: item.url, host, reason: "fetch-failed" };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { ok: false, url: item.url, host, reason: "not-html" };
    }
    html = await response.text();
  } catch {
    return { ok: false, url: item.url, host, reason: "fetch-failed" };
  }

  // `url` matters: Readability resolves relative links against it.
  const dom = new JSDOM(html, { url: item.url });
  const parsed = new Readability(dom.window.document).parse();
  dom.window.close();

  if (!parsed?.content) {
    return { ok: false, url: item.url, host, reason: "no-article" };
  }

  const text = normalizeBody(proseTextOf(parsed.content));

  if (PAYWALL_MARKERS.some((marker) => text.includes(marker))) {
    return { ok: false, url: item.url, host, reason: "paywalled" };
  }
  if (text.length < MIN_BODY_CHARS) {
    return { ok: false, url: item.url, host, reason: "too-short" };
  }

  const bounded = boundBody(text, kind);
  if (!bounded) {
    return { ok: false, url: item.url, host, reason: "too-long" };
  }

  return {
    ok: true,
    url: item.url,
    host,
    title: parsed.title?.trim() || item.title,
    text: bounded,
    charCount: bounded.length,
    imageUrl: ogImage(html),
  };
}

/**
 * 정책.md §3 원문 상한. news는 앞에서 자르고(역피라미드라 안전),
 * blog는 결론이 뒤에 있으므로 자르지 않고 넘으면 건너뛴다(null).
 */
function boundBody(text: string, kind: SourceKind): string | null {
  if (text.length <= MAX_BODY_CHARS) return text;
  return kind === "news" ? text.slice(0, MAX_BODY_CHARS) : null;
}

/** pre·code·table·figure를 뺀 본문 텍스트. 소스분류.md §2가 잰 길이와 같은 기준이다. */
function proseTextOf(contentHtml: string): string {
  const dom = new JSDOM(contentHtml);
  dom.window.document.querySelectorAll("pre, code, table, figure").forEach((n) => n.remove());
  const text = dom.window.document.body.textContent ?? "";
  dom.window.close();
  return text;
}

/** og:image / twitter:image 중 먼저 나오는 것. 순서에 의존하지 않도록 둘 다 본다. */
function ogImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const found = html.match(pattern)?.[1];
    if (found?.startsWith("http")) return found;
  }
  return null;
}

function normalizeBody(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n\n")
    .trim();
}
