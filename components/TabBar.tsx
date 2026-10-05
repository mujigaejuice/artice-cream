"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 하단 탭 바. 탭이 늘어나는 것을 전제로 배열 주도로 둔다
 * (확장.md §3-4: 오늘 · 콘 · 단어장 · 나).
 *
 * 리더/퀴즈에는 렌더되지 않는다 — app/(tabs)/ route group 안쪽에만 있다.
 * 리더 하단에 이미 고정 CTA가 있어 그대로 겹치기도 하고, 읽는 동안 탭을 숨기는
 * 편이 몰입에 맞다.
 */

/**
 * 아이콘은 이모지 대신 선 아이콘이다 — 이모지는 플랫폼마다 다르게 그려지고,
 * 특히 🍦는 대부분 광택이 들어간 입체 그림이라 콘의 납작한 톤과 어긋난다.
 */
function TodayIcon() {
  return (
    <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="16" height="14" rx="2.5" />
      <path d="M3 9h16M7.5 3v3.5M14.5 3v3.5" />
      <path d="M7 13h4" />
    </svg>
  );
}

function ConeIcon() {
  return (
    <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.8 10.2a6.2 6.2 0 0 1 12.4 0z" />
      <path d="M5.4 10.2 11 19.4l5.6-9.2" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="7" r="3.5" />
      <path d="M4 19v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}

type Tab = {
  href: string;
  label: string;
  Icon: () => React.ReactElement;
  /** 0이면 숨긴다. */
  badge?: number;
};

const TABS: Tab[] = [
  { href: "/", label: "오늘", Icon: TodayIcon },
  { href: "/cone", label: "내 콘", Icon: ConeIcon },
  { href: "/account", label: "나", Icon: AccountIcon },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-[#faf7f2]/95 backdrop-blur"
    >
      <ul
        className="mx-auto flex w-full max-w-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {TABS.map((tab) => {
          const active = (pathname.replace(/\/$/, "") || "/") === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stone-800 ${
                  active ? "text-stone-900" : "text-stone-400"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 mx-auto h-0.5 w-10 rounded-full bg-stone-900"
                  />
                )}
                <tab.Icon />
                <span>{tab.label}</span>
                {tab.badge != null && tab.badge > 0 && (
                  <span className="absolute top-2 right-[28%] min-w-4 rounded-full bg-stone-900 px-1 text-[10px] leading-4 text-white">
                    {tab.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
