"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HeaderCredits } from "@/components/HeaderCredits";
import { isActiveTab, TABS } from "@/components/TabBar";
import { isBareHeaderRoute } from "@/lib/layout-width";

/**
 * 화면 맨 위 줄. 휴대폰에서는 지금처럼 오른쪽 위 음악 버튼 줄만 보이고,
 * 노트북(lg)에서는 로고·주요 메뉴·크레딧·음악이 있는 고정 메뉴 바가 된다.
 * 음악 재생기는 children으로 받아 루트에 하나만 둔다.
 */
export function SiteHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = isBareHeaderRoute(pathname);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-6 lg:sticky lg:top-0 lg:z-20 lg:max-w-none lg:border-b lg:border-stone-200 lg:bg-[#faf7f2]/95 lg:px-0 lg:pt-0 lg:backdrop-blur">
      <div className="lg:mx-auto lg:flex lg:h-14 lg:max-w-[1100px] lg:items-center lg:gap-8 lg:px-6">
        <Link href="/" className="hidden rounded font-semibold tracking-tight text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 lg:block">
          artice cream
        </Link>
        {!bare && (
          <nav aria-label="주요 메뉴" className="hidden lg:flex lg:items-center lg:gap-6">
            {TABS.map((tab) => {
              const active = pathname != null && isActiveTab(pathname, tab.href);
              return (
                <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
                  className={`rounded py-1 text-sm underline-offset-[6px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 ${
                    active ? "font-semibold text-stone-900 underline decoration-2" : "text-stone-500 hover:text-stone-900"
                  }`}>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="lg:ml-auto lg:flex lg:items-center lg:gap-4">
          {!bare && <div className="hidden lg:block"><HeaderCredits /></div>}
          {children}
        </div>
      </div>
    </div>
  );
}
