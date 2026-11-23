"use client";

import { useId } from "react";

import { coreColor } from "@/lib/color";
import type { Equipped, ScoopColors } from "@/lib/cosmetics";
import type { DomainRow } from "@/lib/supabase/types";

/** 색이 왜 다른지 설명이 없으면 스쿱 색은 그냥 장식으로 읽힌다. */
export function FlavorLegend({ domains, equipped, scoopColors, className = "mt-8" }: {
  domains: DomainRow[];
  equipped?: Equipped;
  scoopColors?: ScoopColors;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className}>
      <h2 id={headingId} className="text-sm font-semibold text-stone-700">
        분야별 맛
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-stone-600">
        {domains.map((d) => (
          <li key={d.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: equipped?.palette === "berry-palette" ? scoopColors?.[d.slug as keyof ScoopColors] ?? coreColor(d.slug) : coreColor(d.slug) }}
              aria-hidden="true"
            />
            {d.name_ko}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-stone-500">
        같은 분야도 기사마다 밝기와 선명도가 조금씩 달라져요.
      </p>
    </section>
  );
}
