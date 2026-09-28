"use client";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ConeBoard } from "@/components/ConeBoard";
import { mockDomains, mockScoops } from "@/lib/mock";
import { readHref } from "@/lib/routes";
import { useQueryParams } from "@/lib/use-query";

/**
 * 콘 탭 미리보기 — Supabase 없이 화면만 본다.
 *
 * 실제 /cone과 같은 컴포넌트·같은 목데이터로 렌더한다. 인증도 DB도 타지 않는다.
 * 클라이언트 컴포넌트인 이유는 실제 화면과 같다 — 정적 내보내기는 서버에서
 * `searchParams`를 읽을 수 없다(앱출시.md §2).
 */

export default function ConePreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const query = useQueryParams();
  const initial = Number(query?.get("scoop"));
  const initialScoopId = mockScoops.some((s) => s.id === initial) ? initial : null;

  return (
    <main>
      <PreviewBar here="cone" />

      <header className="mb-2 flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight text-stone-900">
          <span className="ac-mark">내 콘</span>
        </h1>
        <p className="text-xs text-stone-500">스쿱 {mockScoops.length}개</p>
      </header>

      <ConeBoard
        scoops={mockScoops}
        domains={mockDomains}
        initialScoopId={initialScoopId}
        base="/preview"
      />
    </main>
  );
}

export function PreviewBar({ here }: { here: "cone" | "today" | "read" }) {
  const items = [
    { key: "cone", href: "/preview", label: "콘" },
    { key: "today", href: "/preview/today", label: "오늘" },
    { key: "read", href: readHref(201, "/preview"), label: "리더" },
  ] as const;

  return (
    <div className="mb-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-2.5">
      <p className="mb-2 text-center text-[11px] font-medium text-amber-900">
        미리보기 · 목데이터 (DB 연결 안 됨)
      </p>
      <div className="flex justify-center gap-1.5">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              it.key === here
                ? "bg-amber-900 text-white"
                : "bg-white text-amber-900 hover:bg-amber-100"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
