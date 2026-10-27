"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ScoopCone } from "@/components/ScoopCone";
import { ConeScene } from "@/components/ConeScene";
import { apiFetch, apiJson } from "@/lib/client-api";
import { safeEquipped, safeScoopColors, type CosmeticItem, type CosmeticSlot, type Equipped,
  type ScoopColors, type ShopSnapshot } from "@/lib/cosmetics";
import { defaultScoopHex, DOMAIN_FLAVORS } from "@/lib/color";
import { dayKey } from "@/lib/day";
import type { Scoop } from "@/lib/feed";
import { MUSIC_EQUIPPED_EVENT, MUSIC_PREVIEW_EVENT, MUSIC_TRACKS, isMusicKey } from "@/lib/shop-music";
import { createClient } from "@/lib/supabase/client";

const slots: { slot: CosmeticSlot; label: string }[] = [
  { slot: "palette", label: "스쿱 색" }, { slot: "texture", label: "질감" },
  { slot: "topping", label: "토핑" }, { slot: "cone", label: "콘" },
  { slot: "background", label: "배경" },
  { slot: "music", label: "배경음악" },
];

const SAMPLE_COLORS: ScoopColors = {
  cloud: "#BB8FDD", infra: "#F3AE91", data: "#83B8A8", "cs-fundamentals": "#E7BE78",
  "deep-learning": "#9DAEE7", llm: "#C994C7", "ai-security": "#E98BA2", security: "#A7B96B",
};

function ShopArtwork({ product, scoops, equipped, scoopColors }: {
  product: CosmeticItem; scoops: Scoop[]; equipped: Equipped; scoopColors: ScoopColors;
}) {
  if (product.slot === "music") {
    const track = isMusicKey(product.assetKey) ? MUSIC_TRACKS[product.assetKey] : null;
    return <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-xl"
      style={{ backgroundColor: track?.light ?? "#EDE9E0" }} aria-hidden="true">
      <svg viewBox="0 0 160 96" className="h-24 w-full" fill="none">
        <path d="M0 71c24-25 37-9 57-27s37-14 53-4 31 4 50-15" stroke={track?.color ?? "#847A87"}
          strokeWidth="2" strokeLinecap="round" opacity=".6" />
        <circle cx="80" cy="48" r="33" fill="#292333" />
        <circle cx="80" cy="48" r="23" stroke="#FFF8F0" strokeWidth="1.5" opacity=".6" />
        <circle cx="80" cy="48" r="9" fill={track?.color ?? "#847A87"} />
        <circle cx="80" cy="48" r="2" fill="#FFF8F0" />
        <path d="M43 78v-18m0 18c-4-3-7-1-7 2s7 5 7-2Zm87-50V14l-13 3v23m13-12-13 3m0 9c-4-3-7-1-7 2s7 5 7-2Z"
          stroke="#292333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>;
  }
  const look = { ...equipped, [product.slot]: product.assetKey };
  const colors = product.slot === "palette" && !product.owned ? SAMPLE_COLORS : scoopColors;
  return <div className="relative isolate flex h-28 items-center justify-center overflow-hidden rounded-xl bg-[#EDE9E0]"
    aria-hidden="true">
    <ConeScene scene={look.background} />
    <div className="relative z-10 w-24"><ScoopCone scoops={scoops.slice(-1)} equipped={look}
      scoopColors={colors} interactive={false}
      previewCrop={product.slot === "topping" || product.slot === "texture" || product.slot === "palette"} /></div>
    {product.slot === "palette" && <div className="absolute bottom-1 right-2 z-10 flex gap-0.5 rounded-full bg-white/85 p-1">
      {Object.values(SAMPLE_COLORS).map((color) => <span key={color} className="size-1.5 rounded-full"
        style={{ backgroundColor: color }} />)}
    </div>}
  </div>;
}

type Props = {
  userId: string;
  scoops: Scoop[];
  onClose: () => void;
  onApplied: (equipped: Equipped) => void;
  onColorsChanged?: (colors: ScoopColors) => void;
  onBalanceChanged: () => void;
};

export function ShopSheet({ userId, scoops, onClose, onApplied, onColorsChanged, onBalanceChanged }: Props) {
  const [shop, setShop] = useState<ShopSnapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewingMusic, setPreviewingMusic] = useState<string | null>(null);
  const [draftColors, setDraftColors] = useState<ScoopColors>({});
  const [previewDomain, setPreviewDomain] = useState<keyof ScoopColors>("cloud");
  const requestId = useRef(0);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const stopPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
    const player = previewAudio.current;
    previewAudio.current = null;
    if (player) { player.pause(); player.removeAttribute("src"); player.load(); }
    setPreviewingMusic(null);
    window.dispatchEvent(new window.CustomEvent(MUSIC_PREVIEW_EVENT, { detail: false }));
  }, []);

  function playPreview(product: CosmeticItem) {
    if (!isMusicKey(product.assetKey)) return;
    if (previewingMusic === product.id) { stopPreview(); return; }
    stopPreview();
    const player = new window.Audio(MUSIC_TRACKS[product.assetKey].source);
    player.volume = 0.28;
    player.preload = "none";
    player.onended = stopPreview;
    player.onerror = () => { stopPreview(); setError("음악을 불러오지 못했어요. 다시 시도해 주세요."); };
    previewAudio.current = player;
    previewTimer.current = setTimeout(stopPreview, 15_000);
    setPreviewingMusic(product.id);
    window.dispatchEvent(new window.CustomEvent(MUSIC_PREVIEW_EVENT, { detail: true }));
    void player.play().catch(() => { stopPreview(); setError("미리듣기를 시작하지 못했어요. 다시 눌러 주세요."); });
  }

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setError("");
    try {
      const next = await apiJson<ShopSnapshot>("/api/shop");
      if (id !== requestId.current) return null;
      if (next.userId !== userId) throw new Error("계정이 변경됐어요.");
      setShop(next);
      onApplied(safeEquipped(next.equipped));
      const colors = safeScoopColors(next.scoopColors);
      setDraftColors(colors);
      onColorsChanged?.(colors);
      return next;
    } catch {
      if (id === requestId.current) setError("꾸미기 정보를 불러오지 못했어요. 다시 시도해 주세요.");
      return null;
    }
  }, [onApplied, onColorsChanged, userId]);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    void load();
    return () => { requestId.current++; stopPreview(); previousFocus.current?.focus(); };
  }, [load, stopPreview]);

  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === userId) return;
      requestId.current++;
      setShop(null);
      setSelected(null);
      stopPreview();
      onApplied({});
      onColorsChanged?.({});
      onClose();
    });
    return () => subscription.unsubscribe();
  }, [userId, onApplied, onColorsChanged, onClose, stopPreview]);

  const item = shop?.items.find((entry) => entry.id === selected) ?? null;
  const equipped = safeEquipped(shop?.equipped);
  const preview = { ...equipped, ...(item ? { [item.slot]: item.assetKey } : {}) };
  const previewScoops: Scoop[] = scoops.length ? scoops.slice(-2) : [{
    id: -1, variantId: null, articleId: 1, domain: "ai-security", domainLabel: "미리보기",
    date: dayKey(), title: "미리보기", summaryFirstLine: null, score: 1,
  }];
  const palettePreviewScoops = item?.slot === "palette" ? [{ ...previewScoops.at(-1)!,
    domain: previewDomain, domainLabel: DOMAIN_FLAVORS[previewDomain].label }] : previewScoops;
  const previewColors = item?.slot === "palette" && !item.owned ? SAMPLE_COLORS : draftColors;

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
    stopPreview();
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
    stopPreview();
    setError("");
    try {
      const result = await apiJson<{ userId: string; equipped: Equipped }>("/api/cosmetics/equip", {
        method: "POST", body: JSON.stringify({ slot, itemId }),
      });
      if (result.userId !== userId) throw new Error("account changed");
      onApplied(safeEquipped(result.equipped));
      if (slot === "music") window.dispatchEvent(new window.Event(MUSIC_EQUIPPED_EVENT));
      await load();
    } catch {
      setError("적용하지 못했어요. 보유한 꾸미기는 그대로예요. 다시 시도해 주세요.");
      await load();
    } finally { setBusy(false); }
  }

  async function saveColors() {
    if (busy || !item?.owned || item.slot !== "palette") return;
    setBusy(true);
    setError("");
    try {
      const result = await apiJson<{ userId: string; equipped: Equipped; scoopColors: ScoopColors }>(
        "/api/cosmetics/colors", { method: "POST", body: JSON.stringify({ colors: draftColors }) });
      if (result.userId !== userId) throw new Error("account changed");
      onApplied(safeEquipped(result.equipped));
      onColorsChanged?.(safeScoopColors(result.scoopColors));
      await load();
    } catch {
      setError("색을 저장하지 못했어요. 다시 시도해 주세요.");
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
            구매 가능 {shop.spendableBalance.toLocaleString("ko-KR")}크레딧
          </p>
          <p className="mt-1 text-xs text-stone-600">퀴즈를 풀어 받은 크레딧만 구매에 사용할 수 있어요.</p>
          {shop.spendableBalance !== shop.balance && <p className="mt-1 text-xs text-stone-600">
            전체 잔액 {shop.balance.toLocaleString("ko-KR")}크레딧
          </p>}
          {item?.slot === "music" ? <div className="mx-auto mt-3 max-w-sm">
            <ShopArtwork product={item} scoops={previewScoops} equipped={equipped} scoopColors={draftColors} />
          </div> : <div className="relative isolate mt-3 overflow-hidden rounded-3xl bg-[#EDE9E0]">
            <ConeScene scene={preview.background} />
            <div className="relative z-10 mx-auto w-48"><ScoopCone scoops={palettePreviewScoops}
              equipped={preview} scoopColors={previewColors} interactive={false} /></div>
          </div>}
          <p className="mt-2 text-center text-xs text-stone-600">{item?.slot === "music" ?
            "음악은 미리듣고 고를 수 있어요 · 선택만으로 재생곡이 바뀌지 않아요" :
            "미리보기 · 선택만으로 적용되지 않아요"}</p>
          {!shop.spendingEnabled && <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
            꾸미기 구매를 준비 중이에요. 미리보기는 사용할 수 있어요.
          </p>}
          {item && <div className="mt-6 border-t border-stone-300 pt-5">
            <p className="font-semibold text-stone-900">{item.nameKo}</p>
            {equipped[item.slot] === item.assetKey ? <p className="mt-2 text-sm text-stone-600">현재 적용 중이에요.</p> :
              item.owned ? <button type="button" onClick={() => void equip(item.slot, item.id)} disabled={busy}
                className="mt-3 min-h-12 w-full rounded-xl bg-stone-900 px-4 font-semibold text-white disabled:opacity-50">적용하기</button> :
              !shop.spendingEnabled || !item.isActive ? <p className="mt-2 text-sm text-stone-600">판매 준비 중이에요.</p> :
              shop.spendableBalance < item.price ? <div className="mt-2 text-sm text-stone-700">
                <p>구매 가능 크레딧 {item.price - shop.spendableBalance}개가 더 필요해요.</p>
                <Link href="/" className="mt-2 inline-block underline">학습하러 가기</Link>
              </div> : confirming ? <div className="mt-3 rounded-xl bg-white p-4 text-sm">
                <p>{item.nameKo}을(를) {item.price}크레딧으로 구매할까요? 구매 후 사용 가능한 크레딧은 {shop.spendableBalance - item.price}개예요.</p>
                <div className="mt-3 flex gap-2"><button type="button" onClick={() => void purchase(item)} disabled={busy}
                  className="min-h-11 flex-1 rounded-lg bg-stone-900 px-4 text-white disabled:opacity-50">구매 확인</button>
                  <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border px-4">취소</button></div>
              </div> : <button type="button" onClick={() => setConfirming(true)} disabled={busy}
                className="mt-3 min-h-12 w-full rounded-xl bg-stone-900 px-4 font-semibold text-white disabled:opacity-50">
                {item.price}크레딧으로 구매</button>}
          </div>}
          {item?.slot === "palette" && item.owned && <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-4"
            aria-label="분야별 스쿱 색 설정">
            <h3 className="font-semibold text-stone-900">8개 분야별 색</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">분야마다 색을 고르세요. 원래 색으로 되돌릴 수도 있어요.</p>
            <div className="mt-4 space-y-2">
              {Object.entries(DOMAIN_FLAVORS).map(([domain, flavor]) => {
                const key = domain as keyof ScoopColors;
                const chosen = draftColors[key];
                return <div key={domain} className={`flex items-center gap-2 rounded-xl border p-2 ${
                  previewDomain === key ? "border-stone-900" : "border-stone-200"}`}>
                  <button type="button" onClick={() => setPreviewDomain(key)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-sm font-medium focus-visible:outline-2"
                    aria-pressed={previewDomain === key}>
                    <span className="size-6 shrink-0 rounded-full border border-stone-300"
                      style={{ backgroundColor: chosen ?? defaultScoopHex(domain) }} aria-hidden="true" />
                    {flavor.label}
                  </button>
                  <input type="color" value={chosen ?? defaultScoopHex(domain)}
                    aria-label={`${flavor.label} 색 고르기`}
                    onChange={(event) => { setPreviewDomain(key); setDraftColors((colors) => ({
                      ...colors, [key]: event.target.value.toUpperCase(),
                    })); }} disabled={busy}
                    className="size-11 shrink-0 cursor-pointer rounded-lg border border-stone-300 bg-white p-1" />
                  <button type="button" disabled={!chosen || busy}
                    onClick={() => { setPreviewDomain(key); setDraftColors((colors) => {
                      const next = { ...colors }; delete next[key]; return next;
                    }); }} className="min-h-11 shrink-0 rounded-lg px-2 text-xs text-stone-600 disabled:opacity-40">
                    원래 색
                  </button>
                </div>;
              })}
            </div>
            <button type="button" onClick={() => void saveColors()} disabled={busy}
              className="mt-4 min-h-12 w-full rounded-xl bg-stone-900 px-4 font-semibold text-white disabled:opacity-50">
              색 저장하고 적용
            </button>
          </section>}
          {slots.map(({ slot, label }) => <section key={slot} className="mt-6" aria-label={label}>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-stone-900">{label}</h3>
              {equipped[slot] && <button type="button" onClick={() => void equip(slot, null)} disabled={busy}
                className="text-sm text-stone-600 underline disabled:opacity-50">기본으로 되돌리기</button>}</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {shop.items.filter((entry) => entry.slot === slot).map((product) => <div key={product.id}
                className={`rounded-2xl border bg-white p-2 ${selected === product.id ?
                  "border-stone-900 ring-1 ring-stone-900" : "border-stone-200"}`}>
                <button type="button" onClick={() => { stopPreview(); setSelected(product.id); setConfirming(false);
                  setError(""); if (dialog.current) dialog.current.scrollTop = 0; }}
                  aria-pressed={selected === product.id}
                  className="w-full rounded-xl text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900">
                  <ShopArtwork product={product} scoops={previewScoops} equipped={equipped}
                    scoopColors={draftColors} />
                  <span className="mt-2 block px-1 font-semibold leading-5 text-stone-900">{product.nameKo}</span>
                  <span className="mt-1 block px-1 pb-1 text-xs text-stone-600">{product.owned ?
                    "보유 중" : `${product.price}크레딧`}</span>
                </button>
                {product.slot === "music" && <button type="button" onClick={() => playPreview(product)}
                  aria-label={`${product.nameKo} ${previewingMusic === product.id ? "미리듣기 중지" : "15초 미리듣기"}`}
                  className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-2 text-xs font-medium text-stone-800 focus-visible:outline-2">
                  {previewingMusic === product.id ? "■ 중지" : "▶ 15초 미리듣기"}
                </button>}
              </div>)}
            </div>
          </section>)}
          {busy && <p role="status" className="mt-3 text-sm text-stone-600">처리 중…</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
        </>}
      </div>
    </div>
  );
}
