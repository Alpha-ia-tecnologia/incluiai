"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { visibleTabs, type StudentTab, type StudentTabAccess } from "@/lib/student-tab-list";
import { isActivePath } from "@/lib/navigation";

type Tab = StudentTab & { href: string };

export function StudentTabs({ studentId, can }: { studentId: string; can: StudentTabAccess }) {
  const pathname = usePathname();
  const base = `/estudantes/${studentId}`;
  const tabs: Tab[] = visibleTabs(can).map((tab) => ({ ...tab, href: tab.slug ? `${base}/${tab.slug}` : base }));
  const active = tabs.find((tab) => isActivePath(pathname, tab.href, !tab.slug)) ?? tabs[0];
  const fixed = tabs.filter((tab) => tab.group !== "mais");
  const more = tabs.filter((tab) => tab.group === "mais");
  const cells = fixed.length + (more.length ? 1 : 0);
  const firstStep = fixed.find((tab) => tab.group === "trilha");
  const inMore = active.group === "mais";

  return (
    <nav aria-label="Seções do estudante" className="record-tabs print:hidden">
      <ul className="record-tabs-grid" style={{ "--tabs-all": cells, "--tabs-half": Math.ceil(cells / 2) } as CSSProperties}>
        {fixed.map((tab) => (
          <li key={tab.href} className="record-tabs-cell" data-edge={tab === firstStep ? "" : undefined}>
            <Link href={tab.href} aria-current={tab === active ? "page" : undefined} className="record-tab">{tab.label}</Link>
          </li>
        ))}
        {more.length ? (
          <li className="record-tabs-cell" data-edge="">
            <SectionMenu
              label="Mais seções do estudante"
              items={more}
              active={active}
              align="end"
              current={inMore}
              trigger={<>Mais{inMore ? <span className="sr-only">, atual: {active.label}</span> : null}</>}
            />
          </li>
        ) : null}
      </ul>
      <div className="record-tabs-switch">
        <SectionMenu
          label="Todas as seções do estudante"
          items={tabs}
          active={active}
          align="start"
          current
          trigger={<><span className="sr-only">Seção atual: </span>{active.label}</>}
        />
      </div>
    </nav>
  );
}

type MenuProps = { label: string; items: Tab[]; active: Tab; align: "start" | "end"; current: boolean; trigger: ReactNode };

function SectionMenu({ label, items, active, align, current, trigger }: MenuProps) {
  const pathname = usePathname();
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenAt(null);
      ref.current?.querySelector("button")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative h-full">
      <button type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpenAt(open ? null : pathname)} className="record-tab" data-current={current ? "true" : undefined}>
        {trigger} <ChevronDown size={15} aria-hidden className={`shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul id={menuId} aria-label={label} className={`record-tabs-menu absolute top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-paper-raised p-2 shadow-e2 ${align === "end" ? "right-0" : "left-0"}`}>
          {items.map((tab, index) => (
            <li key={tab.href} className={index > 0 && items[index - 1].group !== tab.group ? "mt-1 border-t border-line pt-1" : undefined}>
              <Link href={tab.href} aria-current={tab === active ? "page" : undefined} className="flex min-h-11 items-center rounded-lg px-3 text-sm text-ink hover:bg-brand-soft aria-[current=page]:bg-brand-soft aria-[current=page]:font-medium aria-[current=page]:text-brand-strong">
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
