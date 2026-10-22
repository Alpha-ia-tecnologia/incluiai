"use client";

import { useSyncExternalStore } from "react";
import { isTextScale, type TextScale } from "@/lib/speech-text";

// Tamanho do texto (tela e impressão), guardado neste navegador. O script do
// layout raiz aplica a escolha antes da primeira pintura (TEXT_SCALE_SCRIPT).

export const TEXT_SCALE_KEY = "incluiedu-texto";
export const TEXT_SCALE_SCRIPT = `try{var s=localStorage.getItem("${TEXT_SCALE_KEY}");if(s==="2"||s==="3")document.documentElement.dataset.textScale=s}catch(e){}`;
const EVENT = "incluiedu-texto";

const apply = (value: TextScale) => {
  if (value === "1") delete document.documentElement.dataset.textScale;
  else document.documentElement.dataset.textScale = value;
};

function subscribe(callback: () => void) {
  // Outra aba mudou o tamanho: esta acompanha.
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

const OPTIONS: { value: TextScale; label: string; size: string }[] = [
  { value: "1", label: "Texto no tamanho padrão", size: "text-sm" },
  { value: "2", label: "Texto grande", size: "text-base" },
  { value: "3", label: "Texto maior", size: "text-lg" },
];

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
      <span aria-hidden className="mr-1 text-xs text-ink-soft">Texto</span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          aria-pressed={scale === option.value}
          onClick={() => choose(option.value)}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-full font-medium transition-colors ${option.size} ${scale === option.value ? "bg-brand text-white" : "bg-surface-muted text-ink hover:bg-line"}`}
        >
          A
        </button>
      ))}
    </div>
  );
}
