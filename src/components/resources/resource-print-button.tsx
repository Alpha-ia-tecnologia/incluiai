"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { quietButtonCls } from "@/components/form-styles";

export function ResourcePrintButton({ label, activityId, materialsOnly = false }: {
  label: string;
  activityId?: string;
  materialsOnly?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function print(button: HTMLButtonElement) {
    const root = button.closest<HTMLElement>("[data-resource-print-root]");
    if (!root || root.dataset.resourcePrintBusy === "true") return;
    setPending(true);
    setError("");
    const reset = () => {
      delete root.dataset.resourcePrintMode;
      delete root.dataset.resourcePrintBusy;
      root.querySelectorAll("[data-print-selected]").forEach((activity) => activity.removeAttribute("data-print-selected"));
    };
    reset();

    const selected = [...root.querySelectorAll<HTMLElement>("[data-resource-activity]")].find((activity) => activity.dataset.resourceActivity === activityId);
    if (activityId && !selected) { setPending(false); return; }
    root.dataset.resourcePrintBusy = "true";
    if (selected) selected.dataset.printSelected = "true";
    root.dataset.resourcePrintMode = materialsOnly ? "material" : activityId ? "activity" : "all";

    try {
      // Imagens de cartões abaixo da dobra também precisam estar no papel.
      const images = [...(selected ?? root).querySelectorAll<HTMLImageElement>("[data-resource-card-image]")];
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

  return <span className="inline-flex flex-col items-start gap-2 print:hidden" data-resource-screen>
    <button type="button" className={quietButtonCls} disabled={pending} aria-busy={pending || undefined} onClick={(event) => void print(event.currentTarget)}>
      <Printer size={16} aria-hidden="true" /> {pending ? "Preparando imagens…" : label}
    </button>
    {error ? <span role="alert" className="max-w-sm text-xs text-coral">{error}</span> : null}
  </span>;
}
