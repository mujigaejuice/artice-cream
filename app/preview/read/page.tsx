"use client";

import { notFound } from "next/navigation";

import { Reader } from "@/components/Reader";
import { mockArticle } from "@/lib/mock";
import { useQueryParams } from "@/lib/use-query";

/**
 * 리더 미리보기. (tabs) 바깥이라 탭 바가 없다 — 실제 리더와 같은 조건.
 * ?progress=completed|saved 로 재열람 상태(퀴즈 CTA 분기)를 본다.
 *
 * 경로는 실제 리더와 같이 `?v=`를 쓴다(/preview/read?v=201). 목데이터라 v는
 * 읽지 않지만, 링크 모양이 어긋나면 미리보기가 검증 대상에서 빠진다.
 */

export default function ReadPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const progress = useQueryParams()?.get("progress");
  const progressStatus =
    progress === "completed" || progress === "saved" ? progress : "started";

  return (
    <Reader
      variantId={mockArticle.variantId}
      articleId={mockArticle.articleId}
      level={mockArticle.level}
      title={mockArticle.title}
      contentHtml={mockArticle.contentHtml}
      glossary={mockArticle.glossary}
      readingMinutes={mockArticle.readingMinutes}
      domainSlug={mockArticle.domainSlug}
      domainLabel={mockArticle.domainLabel}
      sourceName={mockArticle.sourceName}
      sourceUrl={mockArticle.sourceUrl}
      progressStatus={progressStatus}
      quizScore={progressStatus === "started" ? null : 0.75}
    />
  );
}
