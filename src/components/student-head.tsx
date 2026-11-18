"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Para âncoras e foco do teclado não ficarem escondidos embaixo dele (WCAG 2.4.11).
export function StudentHead({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact((current) => (current ? window.scrollY > 40 : window.scrollY > 200));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // No celular, compactar troca a grade de abas pela seção atual (e o contrário):
  // o foco que estava na parte que sumiu passa para a seção atual que ficou.
  useEffect(() => {
    const nav = ref.current?.querySelector("nav");
    const focused = document.activeElement;
    if (!nav || !(focused instanceof HTMLElement) || !nav.contains(focused) || focused.getClientRects().length) return;
    [...nav.querySelectorAll<HTMLElement>('[aria-current="page"], [data-current="true"]')].find((item) => item.getClientRects().length)?.focus();
  }, [compact]);

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
