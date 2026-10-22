"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Planejamento" },
  { slug: "apoios", label: "Apoios individuais" },
  { slug: "aplicacao", label: "Aplicação e evidências" },
  { slug: "materiais", label: "Materiais" },
  { slug: "niveis", label: "Níveis" },
  { slug: "historico", label: "Versões e histórico" },
];

// Seções do planejamento com DUA, no mesmo padrão das abas do estudante.
export function PlanningTabs({ planningId }: { planningId: string }) {
  const pathname = usePathname();
  const base = `/planejamento/${planningId}`;
  const tabs = TABS.map((tab) => ({ ...tab, href: tab.slug ? `${base}/${tab.slug}` : base }));
  const active = tabs.find((tab) => (tab.slug ? pathname === tab.href || pathname.startsWith(`${tab.href}/`) : pathname === base))?.href ?? base;
  return (
    <nav aria-label="Seções do planejamento" className="print:hidden">
      <ul className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.href === active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 py-3 text-sm transition-colors ${tab.href === active ? "bg-brand font-medium text-white" : "bg-surface-muted text-ink-soft hover:bg-line hover:text-ink"}`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
