import Link from "next/link";

import { coreColor, formatDate } from "@/lib/color";
import type { Scoop } from "@/lib/feed";
import { readHref } from "@/lib/routes";

/**
 * 선택한 스쿱의 타이틀 패널. 콘 오른쪽 빈 슬롯 **안에만** 들어간다.
 *
 * 화면구성.md §4-2 — 카드가 아니다. 테두리도 그림자도 배경색도 없이 페이지
 * 배경 위에 글씨만 뜬다. 줄마다 왼쪽에서 오른쪽으로 마스크를 쓸어내며 나타난다
 * (`.ac-write` — app/globals.css).
 *
 * 세로 크기는 감싼 쪽(ConeBoard)이 슬롯 높이로 잘라 준다. 네 줄이 그 안에
 * 들어가야 하므로 줄간격을 좁게 두고, 제목은 두 줄에서 말줄임한다 — 길이에 따라
 * 블록이 늘면 위아래 스쿱을 덮는다.
 *
 * 닫기 버튼은 두지 않는다. 같은 스쿱 다시 탭 · 배경 탭 · Esc · 뒤로가기로 닫힌다.
 *
 * 타이틀 자체가 링크다 — 여기서 아티클 전문으로 들어간다. 스쿱은 정의상 저장까지
 * 끝난 아티클이므로 재열람에 쿼터가 소모되지 않는다(app/read/[variantId]/page.tsx).
 */

export function ScoopPanel({
  scoop,
  base = "",
  animate = true,
}: {
  scoop: Scoop;
  /** 미리보기(app/preview)가 자기 리더로 보낼 수 있게 열어 둔 것. */
  /** 목데이터 미리보기가 /preview 아래에서 같은 컴포넌트를 쓰려고 열어 둔 접두사. */
  base?: string;
  /** 선택이 없다가 생길 때만 쓸어내기 애니메이션을 튼다 — 옮겨 다닐 때는 바로 바뀐다. */
  animate?: boolean;
}) {
  const writeClass = animate ? "ac-write" : "";

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="선택한 스쿱"
      /* px-0.5: 감싼 쪽이 슬롯 높이로 잘라내므로 포커스 링이 잘리지 않게 한 칸 둔다. */
      className="flex h-full flex-col justify-center px-0.5"
    >
      <p
        className={`flex items-center gap-1.5 text-[11px] leading-4 ${writeClass}`}
        style={{ animationDelay: "0ms" }}
      >
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: coreColor(scoop.domain) }}
          aria-hidden="true"
        />
        <span className="font-medium text-stone-600">{scoop.domainLabel}</span>
        <span className="text-stone-400">· {formatDate(scoop.date)}</span>
      </p>

      <Link
        href={readHref(scoop.variantId, base)}
        className={`ac-link mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-tight text-stone-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stone-800 ${writeClass}`}
        style={{ animationDelay: "90ms" }}
      >
        {scoop.title}
      </Link>

      {scoop.summaryFirstLine && (
        <p
          className={`mt-0.5 truncate text-[11px] leading-4 text-stone-600 ${writeClass}`}
          style={{ animationDelay: "180ms" }}
        >
          {scoop.summaryFirstLine}
        </p>
      )}

      <p
        className={`mt-0.5 text-[11px] leading-4 text-stone-500 ${writeClass}`}
        style={{ animationDelay: "270ms" }}
      >
        퀴즈 {Math.round(scoop.score * 100)}점 ·{" "}
        <Link
          href={readHref(scoop.variantId, base)}
          className="ac-link font-medium text-stone-700 hover:text-stone-900"
        >
          다시 읽기 →
        </Link>
      </p>
    </div>
  );
}
