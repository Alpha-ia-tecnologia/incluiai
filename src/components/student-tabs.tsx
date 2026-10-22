"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TABS = [
  { slug: "", label: "Resumo" },
  { slug: "estudo-de-caso", label: "Estudo de caso" },
  { slug: "perfil", label: "Como aprende" },
  { slug: "ppi", label: "Plano de ensino" },
  { slug: "atividades", label: "Atividades" },
  { slug: "dua", label: "Atividades com DUA" },
  { slug: "diario", label: "Registrar aula" },
  { slug: "atendimentos-aee", label: "Atendimentos AEE" },
  { slug: "linha-do-tempo", label: "Evolução" },
  { slug: "materiais", label: "Materiais de apoio" },
  { slug: "relatorios", label: "Relatórios" },
];

// Seções que ficam ocultas para quem não acessa o detalhe pedagógico (família e terapeuta).
const PEDAGOGICAL_ONLY = new Set(["estudo-de-caso", "dua", "atendimentos-aee"]);
// Leitura sem edição (Secretaria com motivo registrado): as abas de consulta.
const READ_ONLY_TABS = new Set(["", "estudo-de-caso", "ppi", "atendimentos-aee", "linha-do-tempo", "materiais", "relatorios"]);

type Fade = "start" | "end" | "both" | undefined;

// showCaseStudy = pode ver o detalhe pedagógico (estudo de caso, DUA e frequência do AEE).
// showDua, quando informado, esconde só a aba do DUA de quem vê o detalhe mas não planeja (secretaria).
// As abas ficam numa linha que rola de lado (computador e celular); a aberta fica à vista.
export function StudentTabs({ studentId, showCaseStudy, showDua = showCaseStudy, readOnly = false }: { studentId: string; showCaseStudy: boolean; showDua?: boolean; readOnly?: boolean }) {
  const pathname = usePathname();
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [fade, setFade] = useState<Fade>(undefined);
  const base = `/estudantes/${studentId}`;
  const tabs = TABS.filter((tab) => (showCaseStudy || !PEDAGOGICAL_ONLY.has(tab.slug)) && (showDua || tab.slug !== "dua") && (!readOnly || READ_ONLY_TABS.has(tab.slug))).map((tab) => ({
    ...tab,
    href: tab.slug ? `${base}/${tab.slug}` : base,
  }));
  const activeHref = tabs.find((tab) => tab.slug
    ? pathname === tab.href || pathname.startsWith(`${tab.href}/`)
    : pathname === base)?.href ?? base;

  // Quais bordas têm mais abas escondidas: esmaece aquele lado e mostra a seta.
  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const start = strip.scrollLeft > 2;
    const end = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2;
    setFade(start && end ? "both" : start ? "start" : end ? "end" : undefined);
  }, []);

  // A aba aberta fica à vista, sem rolar a página: a linha só se move quando
  // a aba está fora da área visível (assim as primeiras não somem à toa).
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
    </nav>
  );
}
