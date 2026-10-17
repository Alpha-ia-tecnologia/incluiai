import Link from "next/link";
import { ArrowRight, Check, Route } from "lucide-react";
import { Character } from "@/components/character";
import { PendingButton } from "@/components/pending-button";
import { dismissWelcome, startJourney } from "@/actions/journey";
import type { ChapterTone, Journey } from "@/lib/user-journey";

// Cada capítulo tem a sua cor de categoria; o texto *-ink sobre o *-soft
// correspondente passa de 4.5:1 (ver a paleta em globals.css).
export const TONE_CLASSES: Record<ChapterTone, { soft: string; ink: string; solid: string }> = {
  rose: { soft: "bg-rose-soft", ink: "text-rose-ink", solid: "bg-rose-ink" },
  sky: { soft: "bg-sky-soft", ink: "text-sky-ink", solid: "bg-sky-ink" },
  peach: { soft: "bg-peach-soft", ink: "text-peach-ink", solid: "bg-peach-ink" },
  teal: { soft: "bg-teal-soft", ink: "text-teal-ink", solid: "bg-teal-ink" },
  sage: { soft: "bg-sage-soft", ink: "text-sage-ink", solid: "bg-sage-ink" },
  lilac: { soft: "bg-lilac-soft", ink: "text-brand-strong", solid: "bg-brand" },
};

// Barra da história: um trecho por capítulo, preenchido quando concluído.
export function JourneyBar({ journey }: { journey: Journey }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {journey.chapters.map((chapter) => (
        <span key={chapter.key} className={`h-2 flex-1 rounded-full ${chapter.done ? TONE_CLASSES[chapter.tone].solid : chapter.status === "agora" ? `${TONE_CLASSES[chapter.tone].soft} ring-1 ring-inset ring-current ${TONE_CLASSES[chapter.tone].ink}` : "bg-line/70"}`} />
      ))}
    </div>
  );
}

// Primeiro acesso: a história do perfil em poucas linhas e um convite para começar.
export function JourneyWelcome({ journey }: { journey: Journey }) {
  const start = journey.current ?? journey.chapters[0];
  return (
    <section aria-labelledby="boas-vindas-titulo" className="mb-7 overflow-hidden rounded-[26px] bg-lilac-soft p-5 sm:p-7 print:hidden">
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-paper-raised px-3 py-1 text-xs font-medium text-brand-strong"><Route size={14} aria-hidden /> Sua história começa aqui</p>
          <h2 id="boas-vindas-titulo" className="font-display text-2xl font-medium leading-tight tracking-tight text-ink sm:text-3xl">{journey.welcome.headline}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">{journey.welcome.text}</p>
          {journey.chapters.length ? (
            <ol className="mt-5 grid gap-2 sm:grid-cols-3">
              {journey.chapters.slice(0, 3).map((chapter, index) => (
                <li key={chapter.key} className={`flex items-start gap-2.5 rounded-2xl p-3 ${TONE_CLASSES[chapter.tone].soft}`}>
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-paper-raised text-xs font-semibold ${TONE_CLASSES[chapter.tone].ink}`}>{chapter.done ? <Check size={14} strokeWidth={3} aria-label="concluído" /> : index + 1}</span>
                  <span className="text-sm font-medium leading-snug text-ink">{chapter.title}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {start ? (
              <form action={startJourney.bind(null, start.action.href)}>
                <PendingButton className="task-action" pendingText="Abrindo o capítulo...">Começar: {start.action.label} <ArrowRight size={16} aria-hidden /></PendingButton>
              </form>
            ) : null}
            <Link href="/jornada" className="task-action task-action-secondary">Ver a história completa</Link>
            <form action={dismissWelcome}>
              <button type="submit" className="min-h-12 rounded-[14px] px-4 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">Agora não</button>
            </form>
          </div>
        </div>
        <Character variant={journey.character} className="hidden w-36 sm:block xl:w-44" />
      </div>
    </section>
  );
}

// Cartão compacto: onde a pessoa está na história e o próximo passo.
export function JourneyProgress({ journey, layout = "card" }: { journey: Journey; layout?: "card" | "strip" }) {
  if (!journey.chapters.length) return null;
  const current = journey.current;
  const total = journey.chapters.length;
  const summary = `${journey.completed} de ${total} capítulos`;
  if (layout === "strip") {
    return (
      <section aria-label="Sua jornada" className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[22px] bg-lilac-soft px-4 py-3.5 sm:px-5 print:hidden">
        <div className="min-w-[180px] flex-1">
          <p className="flex items-center gap-2 text-xs font-medium text-brand-strong"><Route size={14} aria-hidden /> Sua jornada · {summary}</p>
          <p className="mt-1 text-sm font-medium text-ink">{current ? `Próximo: ${current.title}` : journey.completed < total ? "Você está em dia. O restante aguarda a outra parte." : "Todos os capítulos concluídos. A história continua a cada semana."}</p>
          <div className="mt-2 max-w-sm"><JourneyBar journey={journey} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {current ? <Link href={current.action.href} className="task-action !min-h-11 !py-2">{current.action.label} <ArrowRight size={16} aria-hidden /></Link> : null}
          <Link href="/jornada" className="task-action task-action-secondary !min-h-11 !py-2">Ver minha jornada</Link>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="jornada-resumo-titulo" className="rounded-[20px] bg-paper-raised p-5">
      <p className="flex items-center gap-2 text-xs font-medium text-brand-strong"><Route size={14} aria-hidden /> Minha jornada</p>
      <h2 id="jornada-resumo-titulo" className="mt-1 text-base font-medium leading-snug">{journey.title}</h2>
      <p className="mt-1 text-xs text-ink-soft">{summary}</p>
      <div className="mt-3"><JourneyBar journey={journey} /></div>
      {current ? (
        <>
          <p className="mt-4 text-xs text-ink-soft">Próximo capítulo</p>
          <p className="mt-0.5 text-sm font-medium leading-snug text-ink">{current.title}</p>
          <Link href={current.action.href} className="task-action mt-3 !min-h-11 !py-2">{current.action.label} <ArrowRight size={16} aria-hidden /></Link>
        </>
      ) : <p className="mt-4 text-sm leading-relaxed text-ink-soft">{journey.completed < total ? "Você está em dia. O restante aguarda a outra parte." : "Todos os capítulos concluídos. A história continua a cada aula registrada."}</p>}
      <Link href="/jornada" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong">Ver a história completa <ArrowRight size={16} aria-hidden /></Link>
    </section>
  );
}
