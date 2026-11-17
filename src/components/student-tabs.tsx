"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { isEssentialTab, visibleTabs, type StudentTabAccess } from "@/lib/student-tab-list";
import { isActivePath } from "@/lib/navigation";

type Fade = "start" | "end" | "both" | undefined;

export function StudentTabs({ studentId, can }: { studentId: string; can: StudentTabAccess }) {
  const pathname = usePathname();
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [fade, setFade] = useState<Fade>(undefined);
  const base = `/estudantes/${studentId}`;
  const allTabs = visibleTabs(can).map((tab) => ({
    ...tab,
    href: tab.slug ? `${base}/${tab.slug}` : base,
  }));
  const activeHref = allTabs.find((tab) => isActivePath(pathname, tab.href, !tab.slug))?.href ?? base;
  const split = can.edit;
  const tabs = split ? allTabs.filter((tab) => isEssentialTab(tab.slug) || tab.href === activeHref) : allTabs;
  const moreTabs = split ? allTabs.filter((tab) => !isEssentialTab(tab.slug)) : [];

  const menuId = useId();
  const moreRef = useRef<HTMLDivElement>(null);
  const [openAt, setOpenAt] = useState<string | null>(null);
  const menuOpen = openAt === pathname;
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenAt(null);
      moreRef.current?.querySelector("button")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const start = strip.scrollLeft > 2;
    const end = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2;
    setFade(start && end ? "both" : start ? "start" : end ? "end" : undefined);
  }, []);

  useEffect(() => {
    const strip = stripRef.current;
    const active = activeRef.current;
    if (strip && active) {
      const start = active.offsetLeft - 48;
      const end = active.offsetLeft + active.offsetWidth + 48 - strip.clientWidth;
      if (start < strip.scrollLeft) strip.scrollTo({ left: Math.max(0, start), behavior: "instant" });
      else if (end > strip.scrollLeft) strip.scrollTo({ left: end, behavior: "instant" });
    }
    measure();
  }, [activeHref, measure]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [measure]);

  const scrollBy = (direction: 1 | -1) => stripRef.current?.scrollBy({ left: direction * 240 });
  const arrowCls = "absolute z-10 hidden size-9 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft shadow-e1 hover:text-ink sm:flex";

  return (
    <nav aria-label="Seções do estudante" className="relative flex items-center border-b border-line print:hidden">
      <div className="relative flex min-w-0 flex-1 items-center">
      {fade === "start" || fade === "both" ? (
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Ver as seções anteriores" className={`${arrowCls} left-0`}>
          <ChevronLeft size={18} aria-hidden />
        </button>
      ) : null}
      <div ref={stripRef} onScroll={measure} className="tab-strip min-w-0 flex-1" data-fade={fade}>
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <Link key={tab.href} ref={active ? activeRef : undefined} href={tab.href} aria-current={active ? "page" : undefined} className="tab-link">
              {tab.label}
            </Link>
          );
        })}
      </div>
      {fade === "end" || fade === "both" ? (
        <button type="button" onClick={() => scrollBy(1)} aria-label="Ver mais seções" className={`${arrowCls} right-0`}>
          <ChevronRight size={18} aria-hidden />
        </button>
      ) : null}
      </div>
      {moreTabs.length ? (
        <div ref={moreRef} className="relative shrink-0">
          <button type="button" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setOpenAt(menuOpen ? null : pathname)} className="tab-link gap-1">
            Mais <ChevronDown size={15} aria-hidden className={menuOpen ? "rotate-180" : undefined} />
          </button>
          {menuOpen ? (
            <ul id={menuId} aria-label="Mais seções do estudante" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-2xl border border-line bg-paper-raised p-2 shadow-e2">
              {moreTabs.map((tab) => (
                <li key={tab.href}>
                  <Link href={tab.href} aria-current={tab.href === activeHref ? "page" : undefined} className="flex min-h-11 items-center rounded-lg px-3 text-sm text-ink hover:bg-brand-soft aria-[current=page]:bg-brand-soft aria-[current=page]:font-medium aria-[current=page]:text-brand-strong">
                    {tab.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
