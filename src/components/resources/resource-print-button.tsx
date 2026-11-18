"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { BUTTON_CLS } from "@/components/form-styles";
import { PRINT_ATTRIBUTE, printMark, printSelector } from "./print-marks";

export function ResourcePrintButton({ label, activityId, materialsOnly = false }: {
  label: string;
  activityId?: string;
  materialsOnly?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function print(button: HTMLButtonElement) {
    const root = button.closest<HTMLElement>(printSelector("root"));
    if (!root || root.getAttribute(PRINT_ATTRIBUTE.busy) === "true") return;
    setPending(true);
    setError("");
    const reset = () => {
      root.removeAttribute(PRINT_ATTRIBUTE.mode);
      root.removeAttribute(PRINT_ATTRIBUTE.busy);
      root.querySelectorAll(printSelector("selected")).forEach((activity) => activity.removeAttribute(PRINT_ATTRIBUTE.selected));
    };
    reset();

    const selected = activityId ? root.querySelector<HTMLElement>(printSelector("activity", activityId)) : null;
    if (activityId && !selected) { setPending(false); return; }
    root.setAttribute(PRINT_ATTRIBUTE.busy, "true");
    selected?.setAttribute(PRINT_ATTRIBUTE.selected, "true");
    root.setAttribute(PRINT_ATTRIBUTE.mode, materialsOnly ? "material" : activityId ? "activity" : "all");

    try {
      // Imagens de cartões abaixo da dobra também precisam estar no papel.
      const images = [...(selected ?? root).querySelectorAll<HTMLImageElement>(printSelector("cardImage"))];
      const loaded = await Promise.all(images.map(async (image) => {
        try { await image.decode(); } catch { /* Conferido abaixo, inclusive em navegadores sem decode. */ }
        return image.complete && image.naturalWidth > 0;
      }));
      if (loaded.some((ready) => !ready)) {
        reset();
        setError("Não foi possível carregar todas as imagens. Recarregue a página e tente imprimir novamente.");
        return;
      }
      await document.fonts.ready;
      window.addEventListener("afterprint", reset, { once: true });
      window.print();
    } catch {
      window.removeEventListener("afterprint", reset);
      reset();
      setError("Não foi possível abrir a impressão. Tente novamente pelo menu do navegador.");
    } finally { setPending(false); }
  }

  return <span className="inline-flex flex-col items-start gap-2 print:hidden" {...printMark("screen")}>
    <button type="button" className={BUTTON_CLS.quiet} disabled={pending} aria-busy={pending || undefined} onClick={(event) => void print(event.currentTarget)}>
      <Printer size={16} aria-hidden="true" /> {pending ? "Preparando imagens…" : label}
    </button>
    {error ? <span role="alert" className="max-w-sm text-xs text-coral">{error}</span> : null}
  </span>;
}
