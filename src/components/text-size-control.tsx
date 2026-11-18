"use client";

import { useSyncExternalStore } from "react";
import { TEXT_SCALES, TEXT_SCALE_KEY, applyTextScale, isTextScale, type TextScale } from "@/lib/text-scale";

const EVENT = "incluiedu-texto";
const apply = (value: TextScale) => applyTextScale(document.documentElement, value);

function subscribe(callback: () => void) {
  const fromStorage = (event: StorageEvent) => {
    if (event.key !== TEXT_SCALE_KEY) return;
    apply(isTextScale(event.newValue) ? event.newValue : "1");
    callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", fromStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", fromStorage);
  };
}
const current = (): TextScale => {
  const value = document.documentElement.dataset.textScale;
  return isTextScale(value) ? value : "1";
};

const BUTTON_TEXT = ["text-sm", "text-base", "text-lg"];

export function TextSizeControl() {
  const scale = useSyncExternalStore(subscribe, current, () => "1" as TextScale);
  const choose = (value: TextScale) => {
    apply(value);
    try {
      localStorage.setItem(TEXT_SCALE_KEY, value);
    } catch {
      // Navegação privada: vale só nesta página.
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <div role="group" aria-label="Tamanho do texto" className="flex items-center gap-1 print:hidden">
      <span aria-hidden className="mr-1 text-xs text-surface-ink-soft">Texto</span>
      {TEXT_SCALES.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          aria-pressed={scale === option.value}
          onClick={() => choose(option.value)}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-full font-medium transition-colors ${BUTTON_TEXT[index]} ${scale === option.value ? "bg-action text-on-action" : "bg-surface-muted text-ink hover:bg-line"}`}
        >
          A
        </button>
      ))}
    </div>
  );
}
