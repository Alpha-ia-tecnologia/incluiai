"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Cabeçalho da ficha do estudante: fica preso no topo e, com a página rolada,
// encolhe para nome e abas. A altura vai para --sticky-offset, para âncoras e
// foco do teclado não ficarem escondidos embaixo dele (WCAG 2.4.11).
export function StudentHead({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    // Folga entre encolher e voltar: a mudança de altura não faz o cabeçalho piscar.
    const onScroll = () => setCompact((current) => (current ? window.scrollY > 40 : window.scrollY > 200));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const head = ref.current;
    if (!head) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--sticky-offset", `${head.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(head);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--sticky-offset");
    };
  }, []);

  return (
    <div ref={ref} className="student-head" data-compact={compact ? "true" : undefined}>
      {children}
    </div>
  );
}
