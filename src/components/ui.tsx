import type { ComponentType, ReactNode } from "react";
import { supportInfo } from "@/lib/scale";
import { Character } from "./character";

// Anel de progresso para KPIs percentuais — valor sempre também em texto.
function ProgressRing({ pct }: { pct: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${clamped}%`} className="shrink-0 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={r} fill="none"
        stroke="var(--brand)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
      />
      <text x="32" y="32" transform="rotate(90 32 32)" textAnchor="middle" dominantBaseline="central"
        className="fill-[var(--ink)] font-mono text-[13px] font-semibold">
        {clamped}%
      </text>
    </svg>
  );
}

// info = indicador sem juízo de valor; verde, âmbar e coral indicam estado.
type KpiTone = "info" | "amber" | "coral" | "green" | "neutral";

const KPI_CARD_TONES: Record<KpiTone, string> = {
  info: "bg-sky-soft/60",
  amber: "bg-amber-soft",
  coral: "bg-coral-soft",
  green: "bg-green-soft",
  neutral: "bg-surface-muted",
};

const KPI_ICON_TONES: Record<KpiTone, string> = {
  info: "bg-sky-soft text-sky-ink",
  amber: "bg-amber-soft text-amber-800",
  coral: "bg-coral-soft text-coral",
  green: "bg-green-soft text-green",
  neutral: "bg-line/60 text-ink-soft",
};

export function KpiCard({
  value, label, sub, pct, icon: Icon, tone = "info",
}: {
  value: string | number;
  label: string;
  sub?: string;
  pct?: number | null;
  icon?: ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean }>;
  tone?: KpiTone;
}) {
  return (
    <Card className={`flex items-center gap-4 ${KPI_CARD_TONES[tone]}`}>
      <div className="min-w-0 flex-1">
        {Icon ? (
          <span className={`mb-3 inline-flex size-9 items-center justify-center rounded-full ${KPI_ICON_TONES[tone]}`}>
            <Icon size={16} aria-hidden />
          </span>
        ) : null}
        <div className={`font-display text-4xl font-medium leading-none ${tone === "coral" ? "text-coral" : "text-ink"}`}>{value}</div>
        <div className="mt-1.5 text-xs font-medium text-ink/80">{label}</div>
        {sub ? <div className="mt-0.5 text-[11px] text-ink/80">{sub}</div> : null}
      </div>
      {typeof pct === "number" ? <ProgressRing pct={pct} /> : null}
    </Card>
  );
}

export function PageHeader({ title, lede, actions }: { title: string; lede?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-normal leading-[1.15] tracking-tight text-ink sm:text-[40px]">{title}</h1>
        {lede ? <p className="mt-3 text-sm leading-relaxed text-ink-soft">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`ui-card ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-medium tracking-tight text-ink">
      {children}
    </h2>
  );
}

type BadgeTone = "brand" | "amber" | "coral" | "green" | "neutral";

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: "bg-brand-soft text-brand-strong",
  amber: "bg-amber-soft text-amber-800",
  coral: "bg-coral-soft text-coral",
  green: "bg-green-soft text-green",
  neutral: "bg-line/60 text-ink-soft",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

// Selo do nível de apoio (0-5): vocabulário central da plataforma.
export function SupportPill({ level }: { level: number }) {
  const info = supportInfo(level);
  const hue = ["green", "green", "brand", "amber", "coral", "coral"][Math.min(5, Math.max(0, level))] as BadgeTone;
  return (
    <Badge tone={hue}>
      <span className="font-semibold">{info.code}</span>
      <span className="hidden sm:inline">· {info.label}</span>
    </Badge>
  );
}

export function AIDisclaimer() {
  return (
    <p className="mt-3 rounded-xl bg-amber-soft px-3 py-2 text-xs leading-relaxed text-amber-900">
      Sugestão para análise do profissional — não substitui avaliação pedagógica ou clínica.
    </p>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line bg-surface-muted/40 px-6 py-12 text-center">
      <Character variant="resources" className="mx-auto mb-4 w-24" />
      <p className="font-medium text-ink">{title}</p>
      {hint ? <p className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  );
}

// Botão primário padrão do design system (bg-brand, elevação e1→e2, active).
export function PrimaryButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-e1 transition-all duration-200 hover:bg-brand-strong hover:shadow-e2 active:translate-y-px disabled:pointer-events-none disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
