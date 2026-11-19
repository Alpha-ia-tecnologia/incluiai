import Link from "next/link";
import type { ReactNode } from "react";
import { supportInfo, type Tone } from "@/lib/scale";
import type { CharacterVariant } from "@/lib/characters";
import { Character } from "./character";
import { BUTTON_CLS, type ButtonVariant } from "./form-styles";

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

const HERO_LAYOUT = {
  page: { section: "mb-8 gap-y-3 p-5 sm:items-center sm:gap-x-8 sm:p-8", title: "text-2xl", actions: "mt-5", character: "w-14 sm:w-32 lg:w-40" },
  standalone: { section: "mx-auto w-full max-w-3xl items-center gap-6 p-6 sm:p-10", title: "text-3xl", actions: "mt-6", character: "w-28 justify-self-center sm:w-40" },
};

export function PageHero({ title, lede, eyebrow, character, actions, children, preload = false, standalone = false }: {
  title: string;
  lede?: ReactNode;
  eyebrow?: ReactNode;
  character: CharacterVariant;
  actions?: ReactNode;
  children?: ReactNode;
  preload?: boolean;
  standalone?: boolean;
}) {
  const layout = HERO_LAYOUT[standalone ? "standalone" : "page"];
  return (
    <section className={`page-hero surface-navy grid min-w-0 rounded-3xl sm:grid-cols-[minmax(0,1fr)_auto] ${layout.section}`}>
      <div className="min-w-0 sm:row-start-1">
        {eyebrow ? <p className="mb-2 flex items-center gap-2 text-sm font-medium text-on-navy-soft">{eyebrow}</p> : null}
        <h1 className={`font-display ${layout.title} font-bold leading-[1.15] tracking-tight text-on-navy sm:text-4xl`}>{title}</h1>
        {lede ? <div className="mt-3 max-w-2xl text-sm leading-relaxed text-on-navy-soft sm:text-base">{lede}</div> : null}
        {actions ? <div className={`${layout.actions} flex flex-wrap gap-2`}>{actions}</div> : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
      <Character variant={character} className={`row-start-1 sm:col-start-2 ${layout.character}`} preload={preload} />
    </section>
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
    <h2 className="mb-4 text-base font-medium tracking-tight text-ink">
      {children}
    </h2>
  );
}

const BADGE_TONES: Record<Tone, string> = {
  info: "bg-brand-soft text-brand-strong",
  mid: "bg-amber-soft text-amber",
  alert: "bg-coral-soft text-coral",
  good: "bg-green-soft text-green",
  neutral: "bg-line/60 text-ink-soft",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function SupportPill({ level }: { level: number }) {
  const info = supportInfo(level);
  return (
    <Badge tone="info">
      <span className="font-semibold">{info.code}</span>
      <span className="hidden sm:inline">· {info.label}</span>
    </Badge>
  );
}

export function AIDisclaimer() {
  return (
    <p className="mt-3 rounded-xl bg-amber-soft px-3 py-2 text-sm leading-relaxed text-amber">
      Sugestão para análise do profissional — não substitui avaliação pedagógica ou clínica.
    </p>
  );
}

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

export function ButtonLink({ href, variant = "primary", className = "", children }: { href: string; variant?: ButtonVariant; className?: string; children: ReactNode }) {
  return <Link href={href} className={`${BUTTON_CLS[variant]} ${className}`}>{children}</Link>;
}
