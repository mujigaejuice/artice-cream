"use client";

import { usePathname } from "next/navigation";

import { isWideRoute } from "@/lib/layout-width";

/** 본문 칸. 휴대폰은 지금 폭 그대로, 노트북은 오늘·리더·내 콘만 넓게 쓰고 나머지는 가운데 칸에 둔다. */
export function PageFrame({ children }: { children: React.ReactNode }) {
  const wide = isWideRoute(usePathname());
  return (
    <div className={`mx-auto w-full max-w-lg px-4 pb-16 lg:px-6 lg:pt-8 ${wide ? "lg:max-w-[1100px]" : "lg:max-w-[680px]"}`}>
      {children}
    </div>
  );
}
