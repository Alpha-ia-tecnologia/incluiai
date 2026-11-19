"use client";

import { useEffect } from "react";

/** Endereços guardados do Painel de uma página só (`/painel#aulas`) abrem a vista que hoje tem a seção. */
export function LegacyAnchor({ anchors }: { anchors: Readonly<Record<string, string>> }) {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const view = Object.hasOwn(anchors, id) ? anchors[id] : null;
    if (!view || document.getElementById(id)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("vista", view);
    // Navegação completa: o navegador leva até a âncora sozinho e o endereço antigo sai do histórico.
    window.location.replace(url.href);
  }, [anchors]);
  return null;
}
