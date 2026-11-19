import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Tone } from "@/lib/scale";
import { RingStat, SIGNAL, StatusPill } from "./charts";

export function DataBoard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dash-board grid min-w-0 gap-3 ${className}`}>{children}</div>;
}

export function DataCard({ title, hint, href, linkLabel, children, className = "", id }: { title: string; hint?: string; href?: string; linkLabel?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-label={title} className={`dash-card min-w-0 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-medium tracking-tight text-ink">{title}</h3>
          {hint ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{hint}</p> : null}
        </div>
        {href ? <Link href={href} className="circle-link" aria-label={linkLabel ?? `Abrir ${title.toLowerCase()}`}><ArrowUpRight size={16} aria-hidden /></Link> : null}
      </div>
      {children}
    </section>
  );
}

export function StatTile({ label, value, unit, hint, tone, status, trend, chart, href, linkLabel }: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: Tone;
  status?: string;
  trend?: ReactNode;
  chart?: ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <article className="dash-card flex min-w-0 flex-col !p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-ink">{label}</h3>
        {href ? <Link href={href} className="circle-link !size-8" aria-label={linkLabel ?? `Ver detalhes: ${label}`}><ArrowUpRight size={15} aria-hidden /></Link> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-display text-3xl font-bold leading-none tracking-tight text-ink tabular-nums">{value}{unit ? <span className="ml-0.5 text-xl text-ink-soft">{unit}</span> : null}</p>
        {status && tone ? <StatusPill tone={tone}>{status}</StatusPill> : null}
        {trend}
      </div>
      {chart ? <div className="mt-3">{chart}</div> : null}
      {hint ? <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{hint}</p> : null}
    </article>
  );
}

export function RingTile({ id, pct, label, value, hint, color = SIGNAL.brand, children }: {
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
        <p className="mt-1 font-display font-bold text-3xl leading-none tracking-tight text-ink tabular-nums">{value}</p>
        {hint ? <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{hint}</p> : null}
      </div>
      {children ? <div className="w-full min-w-0">{children}</div> : null}
    </article>
  );
}
