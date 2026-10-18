import type { ReactNode } from "react";
import { RingStat } from "@/components/data-viz";
import { SIGNAL } from "@/components/charts";

// Cartão com anel e número grande, como o do "Minha jornada". Sem base
// (pct null), o anel fica vazio e o centro mostra "—", nunca 0%.

export function RingTile({ id, pct, label, value, hint, color = SIGNAL.lime, children }: {
  id: string;
  pct: number | null;
  label: string;
  value: ReactNode;
  hint?: string;
  color?: string;
  children?: ReactNode;
}) {
  return (
    <article className="dash-card flex min-w-0 flex-wrap items-center gap-4 !p-4">
      <RingStat id={id} value={pct} label={label} size={84} color={color} />
      <div className="min-w-[8rem] flex-1">
        <h3 className="text-sm font-medium leading-snug text-ink">{label}</h3>
        <p className="mt-1 font-display text-3xl leading-none tracking-tight text-ink tabular-nums">{value}</p>
        {hint ? <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{hint}</p> : null}
      </div>
      {children ? <div className="w-full min-w-0">{children}</div> : null}
    </article>
  );
}
