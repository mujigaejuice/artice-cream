import type { SupabaseClient } from "@supabase/supabase-js";

export type RightsStatus = "unreviewed" | "permitted" | "restricted" | "blocked";
export type RightsAction = "collect" | "process" | "publish";
export type SourceRights = {
  source: string;
  rights_status: RightsStatus;
  evidence_url: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  allow_collect: boolean;
  allow_process: boolean;
  allow_publish: boolean;
};
export type Attribution = {
  author: string;
  originalTitle: string;
  licenseLabel: string;
  licenseUrl: string;
  changes: string;
  notices: string;
};
export type ArticleRights = {
  source: string | null;
  status: string;
  rights_status: RightsStatus;
  rights_evidence_url: string | null;
  rights_reviewed_at: string | null;
  rights_expires_at: string | null;
  rights_attribution: Attribution | null;
};

export const ARTICLE_RIGHTS_COLUMNS = "source, status, rights_status, rights_evidence_url, rights_reviewed_at, rights_expires_at, rights_attribution";

function httpUrl(value: unknown): boolean {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

function reviewed(record: { rights_status: RightsStatus; reviewed_at: string | null; evidence_url: string | null; expires_at: string | null }, now: number): boolean {
  return record.rights_status === "permitted" && httpUrl(record.evidence_url) &&
    Boolean(record.reviewed_at) && Number.isFinite(Date.parse(record.reviewed_at!)) &&
    Date.parse(record.reviewed_at!) <= now &&
    (record.expires_at === null || Date.parse(record.expires_at) > now);
}

/** Missing schema, failed reads and unknown sources deny access; there is no permissive fallback. */
export async function getSourceRights(supabase: SupabaseClient): Promise<Map<string, SourceRights>> {
  const { data, error } = await supabase.from("content_source_rights")
    .select("source, rights_status, evidence_url, reviewed_at, expires_at, allow_collect, allow_process, allow_publish");
  if (error) {
    console.error("[content-rights] source registry unavailable", error.code);
    return new Map();
  }
  return new Map(((data ?? []) as SourceRights[]).map((row) => [row.source, row]));
}

export function sourceAllows(source: SourceRights | undefined, action: RightsAction, now = Date.now()): boolean {
  return Boolean(source && reviewed(source, now) && source[`allow_${action}`] === true);
}

export function articleAllows(article: ArticleRights | null | undefined, sources: Map<string, SourceRights>, action: "process" | "publish", now = Date.now()): boolean {
  if (!article || !sourceAllows(sources.get(article.source ?? ""), action, now)) return false;
  if (!reviewed({ rights_status: article.rights_status, evidence_url: article.rights_evidence_url,
    reviewed_at: article.rights_reviewed_at, expires_at: article.rights_expires_at }, now)) return false;
  const attribution = article.rights_attribution;
  if (!attribution || !["author", "originalTitle", "licenseLabel", "licenseUrl", "changes"].every(
    (key) => typeof attribution[key as keyof Attribution] === "string" && attribution[key as keyof Attribution].trim().length > 0,
  )) return false;
  if (!httpUrl(attribution.licenseUrl) || typeof attribution.notices !== "string") return false;
  return action === "publish" ? article.status === "ready" : article.status === "pending";
}

/** Service-role routes must explicitly check rights before quizzes, writes or quota consumption. */
export async function canPublishArticle(supabase: SupabaseClient, articleId: number): Promise<boolean> {
  const [sources, { data, error }] = await Promise.all([
    getSourceRights(supabase),
    supabase.from("articles").select(ARTICLE_RIGHTS_COLUMNS).eq("id", articleId).maybeSingle(),
  ]);
  return !error && articleAllows(data as ArticleRights | null, sources, "publish");
}
