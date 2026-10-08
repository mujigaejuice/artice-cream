// lib/news/feeds.ts — 소스분류.md §2의 확정 목록.
//
// scripts/spike-sources.ts가 이 SOURCES를 재는 데 썼던 원본이다. 소스를
// 추가/제거하려면 여기와 소스분류.md를 같이 고친다.

import { SOURCE_CANDIDATES } from "./source-candidates";

export type SourceKind = "news" | "blog";

export type Source = {
  id: string;
  url: string;
  lang: "ko" | "en";
  kind: SourceKind;
  /**
   * 지난 글을 받는 주소(소스분류.md §2 아카이브). 피드의 뒤쪽 페이지나 사이트맵이다.
   *
   * - `match`가 있으면 링크에 그 문자열이 든 것만 쓴다.
   * - `pages`가 있으면 `url`의 `{page}` 자리에 그 범위에서 무작위로 고른 수를 끼운다.
   *   범위를 두는 이유는 소스분류.md §2가 "인제스트 한 번에 소스마다 무작위 페이지
   *   하나를 읽는다"고 정해 뒀기 때문이다. 쪽을 하나로 고정하면 그 쪽의 글이 전부
   *   `source_url` 중복 제거에 걸린 뒤로는 아카이브가 영원히 빈손이 된다.
   * - `step`은 쪽이 아니라 오프셋(Blogger `start-index`)인 소스용 증분이다.
   */
  archive?: { url: string; match?: string; pages?: [number, number]; step?: number };
};

const existingSources: Source[] = [
  { id: "aws-news", url: "https://aws.amazon.com/blogs/aws/feed/", lang: "en", kind: "news" },
  { id: "gcp-blog", url: "https://cloudblog.withgoogle.com/rss/", lang: "en", kind: "news" },
  { id: "cloudflare", url: "https://blog.cloudflare.com/rss/", lang: "en", kind: "blog" },
  { id: "kubernetes", url: "https://kubernetes.io/feed.xml", lang: "en", kind: "blog" },
  { id: "cncf", url: "https://www.cncf.io/feed/", lang: "en", kind: "blog" },
  { id: "thenewstack", url: "https://thenewstack.io/feed/", lang: "en", kind: "news" },
  { id: "infoq", url: "https://feed.infoq.com/", lang: "en", kind: "news" },
  { id: "meta-eng", url: "https://engineering.fb.com/feed/", lang: "en", kind: "blog" },
  // { id: "woowahan", url: "https://techblog.woowahan.com/feed/", lang: "ko", kind: "blog" },
  { id: "toss", url: "https://toss.tech/rss.xml", lang: "ko", kind: "blog" },
  { id: "lycorp-ko", url: "https://techblog.lycorp.co.jp/ko/feed/index.xml", lang: "ko", kind: "blog" },
  { id: "google-research", url: "https://research.google/blog/rss/", lang: "en", kind: "blog" },
  { id: "deepmind", url: "https://deepmind.google/blog/rss.xml", lang: "en", kind: "blog" },
  { id: "huggingface", url: "https://huggingface.co/blog/feed.xml", lang: "en", kind: "blog" },
  { id: "pytorch", url: "https://pytorch.org/feed/", lang: "en", kind: "blog" },
  { id: "nvidia-dev", url: "https://developer.nvidia.com/blog/feed/", lang: "en", kind: "blog" },
  { id: "mit-news-ai", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", lang: "en", kind: "news" },
  { id: "msr", url: "https://www.microsoft.com/en-us/research/feed/", lang: "en", kind: "blog" },
  { id: "simonwillison", url: "https://simonwillison.net/atom/entries/", lang: "en", kind: "blog" },
  { id: "interconnects", url: "https://www.interconnects.ai/feed", lang: "en", kind: "blog" },
  { id: "aitimes", url: "https://www.aitimes.com/rss/allArticle.xml", lang: "ko", kind: "news" },
  { id: "embracethered", url: "https://embracethered.com/blog/index.xml", lang: "en", kind: "blog" },
  { id: "owasp-genai", url: "https://genai.owasp.org/feed/", lang: "en", kind: "blog" },
  { id: "trailofbits", url: "https://blog.trailofbits.com/feed/", lang: "en", kind: "blog" },
  { id: "google-security", url: "https://security.googleblog.com/feeds/posts/default", lang: "en", kind: "blog" },
  { id: "thehackernews", url: "https://feeds.feedburner.com/TheHackersNews", lang: "en", kind: "news" },
  { id: "bleepingcomputer", url: "https://www.bleepingcomputer.com/feed/", lang: "en", kind: "news" },
  { id: "securityweek", url: "https://www.securityweek.com/feed/", lang: "en", kind: "news" },
  { id: "dailysecu", url: "https://www.dailysecu.com/rss/allArticle.xml", lang: "ko", kind: "news" },
  { id: "unit42", url: "https://unit42.paloaltonetworks.com/feed/", lang: "en", kind: "blog" },
  // CS 기초 — 지난 글도 후보로 받는다(아카이브).
  {
    id: "oldnewthing",
    url: "https://devblogs.microsoft.com/oldnewthing/feed",
    lang: "en",
    kind: "blog",
    // 쪽당 10편. 실측: 50쪽 2024년, 150쪽 2021년, 200쪽 2019년, 250쪽 2017년.
    archive: { url: "https://devblogs.microsoft.com/oldnewthing/feed?paged={page}", pages: [2, 240] },
  },
  {
    id: "lemire",
    url: "https://lemire.me/blog/feed/",
    lang: "en",
    kind: "blog",
    // 쪽당 40편. 실측: 20쪽 2017년, 25쪽 2014~15년. 2016년 경계가 22쪽 언저리라
    // 20쪽에서 끊는다. 기존 값 50쪽은 전부 2006년 글이었다(소스분류.md §2가 쓰지
    // 않기로 한 구간이다).
    archive: { url: "https://lemire.me/blog/feed/?paged={page}", pages: [2, 20] },
  },
  {
    id: "murat",
    url: "https://muratbuffalo.blogspot.com/feeds/posts/default",
    lang: "en",
    kind: "blog",
    // start-index는 쪽이 아니라 글 번호라 25씩 건너뛴다. 실측: 400이 2019~20년,
    // 600이 2017년.
    archive: {
      url: "https://muratbuffalo.blogspot.com/feeds/posts/default?start-index={page}&max-results=25",
      pages: [26, 575],
      step: 25,
    },
  },
  { id: "eli-bendersky", url: "https://eli.thegreenplace.net/feeds/all.atom.xml", lang: "en", kind: "blog" },
  {
    id: "brooker",
    url: "https://brooker.co.za/blog/rss.xml",
    lang: "en",
    kind: "blog",
    // 피드 하나에 전체 글이 들어 있다. 아카이브 표본은 그 피드의 가장 오래된 글이다.
    archive: { url: "https://brooker.co.za/blog/rss.xml" },
  },
  {
    id: "julia-evans",
    url: "https://jvns.ca/atom.xml",
    lang: "en",
    kind: "blog",
    archive: { url: "https://jvns.ca/sitemap.xml", match: "/blog/20" },
  },
  // 데이터
  { id: "databricks", url: "https://www.databricks.com/feed", lang: "en", kind: "blog" },
  { id: "towardsdatascience", url: "https://towardsdatascience.com/feed/", lang: "en", kind: "blog" },
  { id: "duckdb", url: "https://duckdb.org/feed.xml", lang: "en", kind: "blog" },
  { id: "spotify-eng", url: "https://engineering.atspotify.com/feed/", lang: "en", kind: "blog" },
  { id: "devsisters", url: "https://tech.devsisters.com/rss.xml", lang: "ko", kind: "blog" },
];

// Register reviewed public-license candidates without granting collection, processing or publication.
// Actual permissions are checked against content_source_rights before any source request.
export const SOURCES: Source[] = [
  ...existingSources,
  ...SOURCE_CANDIDATES.map(({ source }) => source).filter(
    (source) => !existingSources.some((existing) => existing.id === source.id),
  ),
];
