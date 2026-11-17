import { ExternalLink, Landmark } from "lucide-react";
import { FEDERAL_NORMS, INEP_CENSUS_GUIDANCE } from "@/lib/federal-guidance";
import { HowToRead } from "@/components/explain";

export function FederalGuidance({ rules, summary = "O que diz a orientação", className = "" }: { rules?: readonly string[]; summary?: string; className?: string }) {
  return (
    <aside aria-label="Orientação do Governo Federal" className={`min-w-0 rounded-2xl border border-brand/30 bg-brand-soft/40 px-4 py-3 print:border-line print:bg-transparent ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink"><Landmark size={16} aria-hidden className="shrink-0 text-brand-strong" /> Orientação do Governo Federal</span>
          <span className="text-ink-soft">INEP/MEC · {FEDERAL_NORMS.join(" · ")}</span>
        </p>
        <a href={INEP_CENSUS_GUIDANCE.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-strong underline underline-offset-4 print:hidden">
          Ver no gov.br <ExternalLink size={14} aria-hidden /><span className="sr-only"> (abre em nova aba)</span>
        </a>
      </div>
      {rules?.length ? (
        <HowToRead summary={summary}>
          <ul className="grid list-disc gap-1 pl-5">{rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        </HowToRead>
      ) : null}
    </aside>
  );
}
