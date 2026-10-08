/** Read-only review snapshot of the six existing Lemire articles. No LLM calls. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../lib/supabase/admin";
import { JSDOM } from "jsdom";

async function main() {
  const admin = createAdminClient();
  const { data: articles, error } = await admin.from("articles")
    .select("id,source_url,title,author,domain_id,rights_status,rights_attribution,rights_review_note")
    .eq("source", "lemire").eq("status", "ready").order("id");
  if (error) throw new Error(error.message);
  if (articles.length !== 6) throw new Error(`Expected six existing articles; found ${articles.length}`);
  const { data: variants, error: variantError } = await admin.from("article_variants")
    .select("id,article_id,level,title,summary,content_html,glossary")
    .in("article_id", articles.map((a) => a.id)).order("article_id").order("level");
  if (variantError) throw new Error(variantError.message);
  const { data: questions, error: quizError } = await admin.from("quiz_questions")
    .select("id,variant_id,position,prompt,options,correct_index,explanation")
    .in("variant_id", variants.map((v) => v.id)).order("variant_id").order("position");
  if (quizError) throw new Error(quizError.message);
  mkdirSync("spike-out/lemire-review", { recursive: true });
  const index: Record<string, unknown>[] = [];
  for (const article of articles) {
    const expected = new URL(article.source_url);
    if (expected.origin !== "https://lemire.me" || !/^\/blog\/\d{4}\/\d{2}\/\d{2}\//.test(expected.pathname)) {
      throw new Error(`Unexpected publisher URL for ${article.id}`);
    }
    const response = await fetch(article.source_url, { signal: AbortSignal.timeout(20_000), redirect: "error" });
    if (!response.ok) throw new Error(`Article ${article.id}: publisher HTTP ${response.status}`);
    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const body = doc.querySelector(".entry-content");
    if (!body) throw new Error(`Article ${article.id}: no WordPress entry content`);
    const post = body.closest("article");
    if (!post) throw new Error(`Article ${article.id}: missing post boundary`);
    const title = post.querySelector(".entry-title")?.textContent?.trim();
    const byline = post.querySelector<HTMLAnchorElement>(".entry-footer .byline .author a.fn");
    const author = byline?.textContent?.trim();
    const authorUrl = doc.querySelector<HTMLMetaElement>('meta[property="article:author"]')?.content;
    if (!title || !author || !byline || !authorUrl || byline.href !== authorUrl) {
      throw new Error(`Article ${article.id}: title/byline/author metadata disagree`);
    }
    // Never include comments, citation UI or inline scripts in the text reviewed.
    body.querySelectorAll("script,style,dialog").forEach((node) => node.remove());
    const inlineQuotes = [...body.querySelectorAll("blockquote")].map((node) => node.textContent?.trim());
    const images = [...body.querySelectorAll("img")].map((node) => ({ src: node.getAttribute("src"), alt: node.getAttribute("alt") }));
    const links = [...body.querySelectorAll("a[href]")].map((node) => ({ text: node.textContent?.trim(), href: node.getAttribute("href") }));
    const notices = [...body.querySelectorAll("a[rel~=license]")].map((node) => ({ text: node.textContent, href: node.getAttribute("href") }));
    const originalParagraphs = [...body.querySelectorAll("p,pre,li,h2,h3")].map((node) => node.textContent?.trim()).filter(Boolean);
    const review = { checkedAt: new Date().toISOString(), article,
      publisher: { title, author, authorUrl, text: body.textContent?.trim(), originalParagraphs, inlineQuotes, images, links, notices },
      variants: variants.filter((v) => v.article_id === article.id).map((v) => ({ ...v,
        body: new JSDOM(v.content_html).window.document.body.textContent?.trim(),
        questions: questions.filter((q) => q.variant_id === v.id),
      })) };
    writeFileSync(`spike-out/lemire-review/${article.id}.json`, JSON.stringify(review, null, 2));
    index.push({ id: article.id, sourceUrl: article.source_url, storedTitle: article.title,
      publisherTitle: title, publisherAuthor: author, originalChars: review.publisher.text?.length,
      inlineQuotes: inlineQuotes.length, images: images.length, variantIds: review.variants.map((v) => v.id),
      levels: review.variants.map((v) => v.level), questionCounts: review.variants.map((v) => v.questions.length) });
    dom.window.close();
  }
  writeFileSync("spike-out/lemire-review/index.json", JSON.stringify(index, null, 2));
  console.log(JSON.stringify(index, null, 2));
}
main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Review failed"); process.exitCode = 1; });
