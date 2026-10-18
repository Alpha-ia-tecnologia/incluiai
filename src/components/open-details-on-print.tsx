"use client";

import { useEffect } from "react";

// Um <details> fechado esconde o conteúdo também no papel: antes de imprimir,
// abre os recolhidos dentro de `selector` e, depois, devolve o estado de antes.
export function OpenDetailsOnPrint({ selector }: { selector: string }) {
  useEffect(() => {
    let reopened: HTMLDetailsElement[] = [];
    const before = () => {
      reopened = [...document.querySelectorAll<HTMLDetailsElement>(selector)].filter((item) => !item.open);
      for (const item of reopened) item.open = true;
    };
    const after = () => {
      for (const item of reopened) item.open = false;
      reopened = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [selector]);
  return null;
}
