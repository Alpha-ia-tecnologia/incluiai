import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Info, type LucideIcon } from "lucide-react";

// Elementos visuais no lugar de parágrafos explicativos (docs/visual.md, "Menos texto"):
// - Steps: "como funciona" em etapas curtas com ícone, no lugar da prosa;
// - Assurances: garantias e cuidados (privacidade, revisão humana) em selos;
// - HowToRead: definição ou explicação longa, recolhida atrás de "Como ler".

export type StepItem = { icon: LucideIcon; label: string };

// Etapas de um fluxo, na ordem. Cada uma com 2 a 5 palavras.
export function Steps({ items, label, className = "" }: { items: StepItem[]; label: string; className?: string }) {
  return (
    <ol aria-label={label} className={`flex flex-wrap items-center gap-x-1.5 gap-y-2 ${className}`}>
      {items.map(({ icon: Icon, label: text }, index) => (
        <li key={text} className="flex items-center gap-1.5">
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5 text-sm text-ink">
            <Icon size={16} aria-hidden className="shrink-0 text-brand-strong" />
            {text}
          </span>
          {index < items.length - 1 ? <ChevronRight size={16} aria-hidden className="shrink-0 text-ink-soft" /> : null}
        </li>
      ))}
    </ol>
  );
}

export type AssuranceItem = { icon: LucideIcon; text: string };

// Garantias que a pessoa precisa saber antes de agir. Cada uma com até 6 palavras.
// onNavy: dentro de um herói em marinho.
export function Assurances({ items, label, className = "", onNavy = false }: { items: AssuranceItem[]; label: string; className?: string; onNavy?: boolean }) {
  return (
    <ul aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${onNavy ? "border-navy-line bg-navy-hover text-on-navy" : "border-line bg-paper-raised text-ink"}`}>
          <Icon size={15} aria-hidden className={`shrink-0 ${onNavy ? "text-signal-lime" : "text-green"}`} />
          {text}
        </li>
      ))}
    </ul>
  );
}

// Explicação a um toque: fechada por padrão, aberta na impressão do navegador
// só se a pessoa abriu.
// onNavy: dentro de uma superfície marinho (destaque do Painel).
export function HowToRead({ summary = "Como ler", children, className = "", onNavy = false }: { summary?: string; children: ReactNode; className?: string; onNavy?: boolean }) {
  return (
    <details className={`group ${className}`}>
      <summary className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full text-sm font-medium [&::-webkit-details-marker]:hidden ${onNavy ? "text-on-navy" : "text-brand-strong"}`}>
        <Info size={15} aria-hidden className="shrink-0" />
        {summary}
        <ChevronDown size={15} aria-hidden className="shrink-0 group-open:rotate-180 motion-safe:transition-transform" />
      </summary>
      <div className={`mt-1 max-w-prose text-sm leading-relaxed ${onNavy ? "text-on-navy-soft" : "text-ink-soft"}`}>{children}</div>
    </details>
  );
}
