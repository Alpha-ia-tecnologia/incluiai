import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { supportInfo } from "@/lib/scale";
import { Character, type CharacterVariant } from "./character";
import { BUTTON_CLS, type ButtonVariant } from "./form-styles";

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
        className="viz-ring"
      />
      <text x="32" y="32" transform="rotate(90 32 32)" textAnchor="middle" dominantBaseline="central"
        className="fill-[var(--ink)] text-sm font-semibold tabular-nums">
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
        {sub ? <div className="mt-0.5 text-xs text-ink/80">{sub}</div> : null}
      </div>
      {typeof pct === "number" ? <ProgressRing pct={pct} /> : null}
    </Card>
  );
}

// Título da página. level 2 = título de uma aba dentro de uma ficha que já tem
// o título principal (ex.: o nome do estudante no cabeçalho).
export function PageHeader({ title, lede, actions, level = 1 }: { title: string; lede?: string; actions?: ReactNode; level?: 1 | 2 }) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className={`${level === 1 ? "mb-8" : "mb-6"} flex flex-wrap items-end justify-between gap-4`}>
      <div className="max-w-2xl">
        <Heading className={level === 1
          ? "font-display text-2xl font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl"
          : "font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl"}>{title}</Heading>
        {lede ? <p className="mt-3 text-sm leading-relaxed text-ink-soft">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

// Herói das telas principais: faixa azul-clara com o título, o personagem do assunto
// e, se houver, ações e números (HeroStat). O personagem é decorativo; no
// celular fica pequeno acima do título, para títulos longos não encostarem nele.
export function PageHero({ title, lede, eyebrow, character, actions, children, preload = false }: {
  title: string;
  lede?: ReactNode;
  eyebrow?: ReactNode;
  character: CharacterVariant;
  actions?: ReactNode;
  children?: ReactNode;
  preload?: boolean;
}) {
  return (
    <section className="page-hero mb-8 grid min-w-0 gap-y-3 rounded-3xl bg-lilac-soft/65 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-8 sm:p-8">
      <div className="min-w-0 sm:row-start-1">
        {eyebrow ? <p className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-strong">{eyebrow}</p> : null}
        <h1 className="font-display text-2xl font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl">{title}</h1>
        {lede ? <div className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">{lede}</div> : null}
        {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
      <Character variant={character} className="row-start-1 w-14 sm:col-start-2 sm:w-32 lg:w-40" preload={preload} />
    </section>
  );
}

// Número dentro do herói: valor grande e o que ele conta.
export function HeroStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-paper-raised px-4 py-3">
      <p className="font-display font-bold text-2xl leading-none tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1.5 text-xs leading-snug text-ink-soft">{label}</p>
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
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]}`}>
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

// Estado vazio com o personagem do assunto da tela (ver docs/visual.md) e,
// quando faz sentido, a ação que resolve o vazio.
export function EmptyState({ title, hint, character = "resources", action }: { title: string; hint?: string; character?: CharacterVariant; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface-muted/40 px-6 py-12 text-center">
      <Character variant={character} className="mx-auto mb-4 w-24" />
      <p className="font-medium text-ink">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{hint}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

// Botões do kit (src/components/form-styles.ts): pílula com quatro pesos.
export function Button({ variant = "primary", className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; children: ReactNode }) {
  return <button type="button" {...rest} className={`${BUTTON_CLS[variant]} ${className}`}>{children}</button>;
}

export function ButtonLink({ href, variant = "primary", className = "", children }: { href: string; variant?: ButtonVariant; className?: string; children: ReactNode }) {
  return <Link href={href} className={`${BUTTON_CLS[variant]} ${className}`}>{children}</Link>;
}

// Botão primário padrão do design system (mantido para os formulários existentes).
export function PrimaryButton({ children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`${BUTTON_CLS.primary} shadow-e1 hover:shadow-e2 active:translate-y-px ${className}`}
    >
      {children}
    </button>
  );
}
