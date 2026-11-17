"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";

type Props = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 두 갈래 확인창. 취소가 기본 선택이라 실수로 Enter를 눌러도 아무 일도 일어나지 않는다. */
export function ConfirmDialog({ title, description, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const first = cancelRef.current, last = confirmRef.current;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/55 px-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
        onKeyDown={onKeyDown} className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        <h2 id={titleId} className="text-base font-semibold leading-snug text-stone-900">{title}</h2>
        {description && <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-stone-600">{description}</p>}
        <div className="mt-6 flex gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel}
            className="flex-1 rounded-xl bg-stone-100 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm}
            className="flex-1 rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
