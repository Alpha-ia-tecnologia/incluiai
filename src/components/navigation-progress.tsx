"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Fica de fora do Suspense: um loading.tsx acima de páginas com
// formulário de ação (que revalida o layout) às vezes deixava a atualização
// presa em "Preparando…", então as telas de carregamento ficam só nas listas.
export function NavigationProgress() {
  const here = `${usePathname()}?${useSearchParams().toString()}`;
  const [leaving, setLeaving] = useState<string | null>(null);
  const active = leaving === here;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setLeaving(`${window.location.pathname}?${window.location.search.slice(1)}`);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setLeaving(null), 12000);
    return () => window.clearTimeout(timer);
  }, [active]);

  return <div aria-hidden="true" className="nav-progress print:hidden" data-active={active ? "true" : undefined} />;
}
