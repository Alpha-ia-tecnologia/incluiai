import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Info, type LucideIcon } from "lucide-react";

export type StepItem = { icon: LucideIcon; label: string };

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

export function Assurances({ items, label, className = "" }: { items: AssuranceItem[]; label: string; className?: string }) {
  return (
    <ul aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-surface-line bg-surface-raised px-3 py-1.5 text-sm text-surface-ink">
          <Icon size={15} aria-hidden className="shrink-0 text-surface-good" />
          {text}
        </li>
      ))}
    </ul>
  );
}

export function HowToRead({ summary = "Como ler", children, className = "" }: { summary?: string; children: ReactNode; className?: string }) {
  return (
    <details className={`group ${className}`}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full text-sm font-medium [&::-webkit-details-marker]:hidden text-action-ink">
        <Info size={15} aria-hidden className="shrink-0" />
        {summary}
        <ChevronDown size={15} aria-hidden className="shrink-0 group-open:rotate-180 motion-safe:transition-transform" />
      </summary>
      <div className="mt-1 max-w-prose text-sm leading-relaxed text-surface-ink-soft">{children}</div>
    </details>
  );
}
