"use client";

import { notFound } from "next/navigation";

import { PreviewBar } from "@/app/(tabs)/preview/page";
import { ArticleCard } from "@/components/ArticleCard";
import { AdUnlockButton } from "@/components/AdUnlockButton";
import { mockPicks } from "@/lib/mock";
import { useQueryParams } from "@/lib/use-query";

/** 오늘 탭 미리보기. ?locked=1 을 붙이면 쿼터 소진 상태를 본다. */

export default function TodayPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const canRead = useQueryParams()?.get("locked") !== "1";

  return (
    <main>
      <PreviewBar here="today" />

      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight text-stone-900">
          <span className="ac-mark">오늘의 아티클</span>
        </h1>
        <p className="text-xs text-stone-500">
          {canRead ? "오늘 1편 남음" : "오늘 분량을 다 읽었어요"}
        </p>
      </header>

      <p className="mb-5 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-900">
        게스트로 읽고 있어요.{" "}
        <span className="font-semibold underline">로그인하면 콘이 저장돼요</span>
      </p>

      <ul className="space-y-3">
        {mockPicks.map((pick) => (
          <li key={pick.variantId}>
            <ArticleCard pick={pick} unlocked={canRead} />
          </li>
        ))}
      </ul>

      {!canRead && (
        <div className="mt-4">
          <AdUnlockButton />
        </div>
      )}
    </main>
  );
}
