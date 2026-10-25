"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ScoopCone } from "@/components/ScoopCone";
import { apiFetch, apiJson } from "@/lib/client-api";
import { safeEquipped, type CosmeticItem, type CosmeticSlot, type Equipped, type ShopSnapshot } from "@/lib/cosmetics";
import { dayKey } from "@/lib/day";
import type { Scoop } from "@/lib/feed";
import { createClient } from "@/lib/supabase/client";

const slots: { slot: CosmeticSlot; label: string }[] = [
  { slot: "palette", label: "스쿱 색" }, { slot: "cone", label: "콘" },
  { slot: "topping", label: "토핑" }, { slot: "background", label: "배경" },
];

type Props = {
  userId: string;
  scoops: Scoop[];
  onClose: () => void;
  onApplied: (equipped: Equipped) => void;
  onBalanceChanged: () => void;
};

export function ShopSheet({ userId, scoops, onClose, onApplied, onBalanceChanged }: Props) {
  const [shop, setShop] = useState<ShopSnapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setError("");
    try {
      const next = await apiJson<ShopSnapshot>("/api/shop");
      if (id !== requestId.current) return null;
      if (next.userId !== userId) throw new Error("계정이 변경됐어요.");
      setShop(next);
      onApplied(safeEquipped(next.equipped));
      return next;
    } catch {
      if (id === requestId.current) setError("꾸미기 정보를 불러오지 못했어요. 다시 시도해 주세요.");
      return null;
    }
  }, [onApplied, userId]);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    void load();
    return () => { requestId.current++; previousFocus.current?.focus(); };
  }, [load]);

  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === userId) return;
      requestId.current++;
      setShop(null);
      setSelected(null);
      onApplied({});
      onClose();
    });
    return () => subscription.unsubscribe();
  }, [userId, onApplied, onClose]);

  const item = shop?.items.find((entry) => entry.id === selected) ?? null;
  const equipped = safeEquipped(shop?.equipped);
  const preview = { ...equipped, ...(item ? { [item.slot]: item.assetKey } : {}) };
  const previewScoops: Scoop[] = scoops.length ? scoops.slice(-2) : [{
    id: -1, variantId: null, articleId: 1, domain: "ai-security", domainLabel: "미리보기",
    date: dayKey(), title: "미리보기", summaryFirstLine: null, score: 1,
  }];

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],select:not(:disabled),[tabindex="0"]') ?? [])]
      .filter((node) => node.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) return;
    const first = focusable[0], last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function purchase(product: CosmeticItem) {
    if (busy || !shop?.spendingEnabled || !product.isActive) return;
    setConfirming(false);
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/credits/spend", { method: "POST",
        body: JSON.stringify({ itemId: product.id, catalogVersion: product.catalogVersion }) });
      const result = await response.json();
      if (!response.ok) {
        if (result?.error === "price_changed") {
          await load();
          setError("가격이 바뀌었어요. 새 가격을 확인하고 다시 선택해 주세요.");
        } else if (result?.error === "insufficient_credits") {
          await load();
          setError(`크레딧 ${result.shortfall}개가 더 필요해요.`);
        } else setError("구매하지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const next = await load();
      if (!next?.ownedItems.includes(product.id)) throw new Error("purchase not reflected");
      onBalanceChanged();
    } catch {
      const next = await load();
      if (next?.ownedItems.includes(product.id)) onBalanceChanged();
      else setError("구매 결과를 확인하지 못했어요. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  async function equip(slot: CosmeticSlot, itemId: string | null) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiJson<{ userId: string; equipped: Equipped }>("/api/cosmetics/equip", {
        method: "POST", body: JSON.stringify({ slot, itemId }),
      });
      if (result.userId !== userId) throw new Error("account changed");
      onApplied(safeEquipped(result.equipped));
      await load();
    } catch {
      setError("적용하지 못했어요. 보유한 꾸미기는 그대로예요. 다시 시도해 주세요.");
      await load();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/55" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="shop-title" tabIndex={-1}
        onKeyDown={onKeyDown}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-[#F9F6F0] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl outline-none sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="shop-title" className="text-xl font-bold text-stone-950">내 콘 꾸미기</h2>
            <p className="mt-1 text-sm text-stone-600">먼저 둘러보고, 마음에 들면 적용해요.</p></div>
          <button type="button" onClick={onClose} disabled={busy}
            className="min-h-11 rounded-full border border-stone-300 px-4 text-sm focus-visible:outline-2">닫기</button>
        </div>
        {!shop ? <div className="py-12 text-center text-sm text-stone-600" role="status">
          {error || "꾸미기 정보를 불러오는 중…"}
          {error && <button type="button" onClick={() => void load()} className="ml-2 underline">다시 시도</button>}
        </div> : <>
          <p className="mt-5 text-sm font-semibold text-stone-800" aria-live="polite">
            현재 {shop.balance.toLocaleString("ko-KR")}크레딧
          </p>
          <div className={`mt-3 rounded-3xl ${preview.background === "night-sky" ? "bg-[#1F2441]" : "bg-[#EDE9E0]"}`}>
            <div className="mx-auto w-48"><ScoopCone scoops={previewScoops} equipped={preview} interactive={false} /></div>
          </div>
          <p className="mt-2 text-center text-xs text-stone-600">미리보기 · 선택만으로 적용되지 않아요</p>
          {!shop.spendingEnabled && <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
            꾸미기 구매를 준비 중이에요. 미리보기는 사용할 수 있어요.
          </p>}
          {slots.map(({ slot, label }) => <section key={slot} className="mt-6" aria-label={label}>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-stone-900">{label}</h3>
              {equipped[slot] && <button type="button" onClick={() => void equip(slot, null)} disabled={busy}
                className="text-sm text-stone-600 underline disabled:opacity-50">기본으로 되돌리기</button>}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {shop.items.filter((entry) => entry.slot === slot).map((product) => <button key={product.id}
                type="button" onClick={() => { setSelected(product.id); setConfirming(false); setError(""); }}
                aria-pressed={selected === product.id}
                className={`min-h-20 rounded-2xl border p-3 text-left text-sm focus-visible:outline-2 ${selected === product.id ?
                  "border-stone-900 bg-white" : "border-stone-200 bg-white/60"}`}>
                <span className="block font-semibold text-stone-900">{product.nameKo}</span>
                <span className="mt-1 block text-stone-600">{product.owned ? "보유 중" : `${product.price}크레딧`}</span>
              </button>)}
            </div>
          </section>)}
          {item && <div className="mt-6 border-t border-stone-300 pt-5">
            <p className="font-semibold text-stone-900">{item.nameKo}</p>
            {equipped[item.slot] === item.assetKey ? <p className="mt-2 text-sm text-stone-600">현재 적용 중이에요.</p> :
              item.owned ? <button type="button" onClick={() => void equip(item.slot, item.id)} disabled={busy}
                className="mt-3 min-h-12 w-full rounded-xl bg-stone-900 px-4 font-semibold text-white disabled:opacity-50">적용하기</button> :
              !shop.spendingEnabled || !item.isActive ? <p className="mt-2 text-sm text-stone-600">판매 준비 중이에요.</p> :
              shop.balance < item.price ? <div className="mt-2 text-sm text-stone-700">
                <p>크레딧 {item.price - shop.balance}개가 더 필요해요.</p>
                <Link href="/" className="mt-2 inline-block underline">학습하러 가기</Link>
              </div> : confirming ? <div className="mt-3 rounded-xl bg-white p-4 text-sm">
                <p>{item.nameKo}을(를) {item.price}크레딧으로 구매할까요? 구매 후 {shop.balance - item.price}크레딧이 남아요.</p>
                <div className="mt-3 flex gap-2"><button type="button" onClick={() => void purchase(item)} disabled={busy}
                  className="min-h-11 flex-1 rounded-lg bg-stone-900 px-4 text-white disabled:opacity-50">구매 확인</button>
                  <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border px-4">취소</button></div>
              </div> : <button type="button" onClick={() => setConfirming(true)} disabled={busy}
                className="mt-3 min-h-12 w-full rounded-xl bg-stone-900 px-4 font-semibold text-white disabled:opacity-50">
                {item.price}크레딧으로 구매</button>}
          </div>}
          {busy && <p role="status" className="mt-3 text-sm text-stone-600">처리 중…</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
        </>}
      </div>
    </div>
  );
}
