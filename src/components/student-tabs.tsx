"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { FormEvent } from "react";

const TABS = [
  { slug: "", label: "Resumo" },
  { slug: "estudo-de-caso", label: "Estudo de caso" },
  { slug: "perfil", label: "Como aprende" },
  { slug: "ppi", label: "Plano de ensino" },
  { slug: "atividades", label: "Atividades" },
  { slug: "diario", label: "Registrar aula" },
  { slug: "linha-do-tempo", label: "Evolução" },
  { slug: "materiais", label: "Materiais de apoio" },
];

// O estudo de caso fica oculto para quem não acessa o detalhe pedagógico.
export function StudentTabs({ studentId, showCaseStudy }: { studentId: string; showCaseStudy: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/estudantes/${studentId}`;
  const tabs = TABS.filter((tab) => showCaseStudy || tab.slug !== "estudo-de-caso").map((tab) => ({
    ...tab,
    href: tab.slug ? `${base}/${tab.slug}` : base,
  }));
  const activeHref = tabs.find((tab) => tab.slug
    ? pathname === tab.href || pathname.startsWith(`${tab.href}/`)
    : pathname === base)?.href ?? base;

  function openSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const href = new FormData(event.currentTarget).get("section");
    if (typeof href === "string" && tabs.some((tab) => tab.href === href)) {
      router.push(href);
    }
  }

  return (
    <nav aria-label="Seções do estudante" className="print:hidden">
      <form onSubmit={openSection} className="sm:hidden">
        <label htmlFor="student-section" className="mb-2 block text-sm font-medium text-ink">
          Ir para outra seção
        </label>
        <div className="flex gap-2">
          <select
            key={pathname}
            id="student-section"
            name="section"
            defaultValue={activeHref}
            className="min-h-12 min-w-0 flex-1 border border-line bg-paper-raised px-3 text-base text-ink"
          >
            {tabs.map((tab) => <option key={tab.href} value={tab.href}>{tab.label}</option>)}
          </select>
          <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong">
            Abrir <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </form>
      <div className="hidden flex-wrap gap-2 sm:flex">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === activeHref ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-3 text-sm transition-colors ${
              tab.href === activeHref
                ? "bg-brand font-medium text-white"
                : "bg-surface-muted text-ink-soft hover:bg-line hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
