import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Character } from "@/components/character";
import { PendingButton } from "@/components/pending-button";
import { dismissWelcome, startJourney } from "@/actions/journey";
import type { ChapterStatus, ChapterTone, Journey } from "@/lib/user-journey";

// Cada capítulo tem a sua família de papel: a aba (tab) usa o papel colorido do
// mural; soft e ink servem a fundos claros com texto (≥ 4,5:1).
export const TONE_CLASSES: Record<ChapterTone, { soft: string; ink: string; solid: string; tab: string }> = {
  rose: { soft: "bg-rose-soft", ink: "text-rose-ink", solid: "bg-rose-ink", tab: "bg-paper-pink" },
  sky: { soft: "bg-sky-soft", ink: "text-sky-ink", solid: "bg-sky-ink", tab: "bg-paper-blue" },
  peach: { soft: "bg-peach-soft", ink: "text-peach-ink", solid: "bg-peach-ink", tab: "bg-paper-pink" },
  teal: { soft: "bg-teal-soft", ink: "text-teal-ink", solid: "bg-teal-ink", tab: "bg-paper-green" },
  sage: { soft: "bg-sage-soft", ink: "text-sage-ink", solid: "bg-sage-ink", tab: "bg-paper-green" },
  lilac: { soft: "bg-lilac-soft", ink: "text-pen", solid: "bg-ink", tab: "bg-paper-lilac" },
};

export type MarkState = "feito" | "agora" | "aberto" | "aguardando";
const MARK_TEXT: Record<MarkState, string> = { feito: "feito", agora: "agora", aberto: "em aberto", aguardando: "aguardando outra pessoa" };

export function markState(status: ChapterStatus): MarkState {
  if (status === "concluido") return "feito";
  if (status === "agora") return "agora";
  if (status === "aguardando") return "aguardando";
  return "aberto";
}

// Marcas dos capítulos, como na folha da professora: o visto carimbado no que
// está feito, a tachinha vermelha no agora, contorno no que está em aberto e
// tracejado no que aguarda outra pessoa. A forma carrega o estado, não só a cor.
export function ChapterMarks({ marks, size = "md", label = "Capítulos", start = 1 }: {
  marks: { title: string; state: MarkState }[];
  size?: "sm" | "md";
  label?: string;
  start?: number;
}) {
  const box = size === "sm" ? "size-5 text-xs" : "size-7 text-xs";
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label={label}>
      {marks.map((mark, index) => (
        <li key={`${mark.title}-${index}`} className="flex">
          <span
            title={`${mark.title}: ${MARK_TEXT[mark.state]}`}
            className={`flex ${box} items-center justify-center rounded-full font-bold tabular-nums ${
              mark.state === "feito" ? "bg-ink text-paper-yellow"
                : mark.state === "agora" ? "border-[3px] border-tack bg-paper-raised text-ink"
                  : mark.state === "aguardando" ? "border-[1.5px] border-dashed border-ink bg-paper-raised text-ink"
                    : "border-[1.5px] border-ink bg-paper-raised text-ink"}`}
          >
            {mark.state === "feito" ? <Check size={size === "sm" ? 11 : 14} strokeWidth={3.2} aria-hidden /> : <span aria-hidden>{start + index}</span>}
            <span className="sr-only">{`${start + index}. ${mark.title}: ${MARK_TEXT[mark.state]}`}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const journeyMarks = (journey: Journey) => journey.chapters.map((chapter) => ({ title: chapter.title, state: markState(chapter.status) }));

// Linha das marcas da história, usada no resumo e na página da jornada.
export function JourneyBar({ journey }: { journey: Journey }) {
  return <ChapterMarks marks={journeyMarks(journey)} size="sm" />;
}

const textLink = "inline-flex min-h-12 items-center text-sm font-bold text-ink underline underline-offset-4 hover:decoration-2";

// Primeiro acesso: o recado de boas-vindas fixado no mural. Os passos mostrados
// começam no capítulo atual, para o botão e a lista dizerem a mesma coisa; sem
// capítulo pendente, não há botão de começar.
export function JourneyWelcome({ journey }: { journey: Journey }) {
  const start = journey.current;
  const first = start ? Math.max(0, Math.min(journey.chapters.indexOf(start), journey.chapters.length - 3)) : 0;
  const shown = journey.chapters.slice(first, first + 3);
  return (
    <section aria-labelledby="boas-vindas-titulo" className="mural-notice mb-8 p-5 pt-7 sm:p-8 sm:pt-9 print:hidden">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <h2 id="boas-vindas-titulo" className="font-display text-3xl font-extrabold leading-tight text-ink sm:text-[34px]">{journey.welcome.headline}</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink">{journey.welcome.text}</p>
          {shown.length ? (
            <ol className="mt-5 space-y-2">
              {shown.map((chapter, index) => (
                <li key={chapter.key} aria-current={chapter === start ? "step" : undefined} className="flex items-center gap-3">
                  <ChapterMarks marks={[{ title: chapter.title, state: markState(chapter.status) }]} start={first + index + 1} label={`Capítulo ${first + index + 1}`} />
                  <span className="text-base font-bold leading-snug text-ink">{chapter.title}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1">
            {start ? (
              <form action={startJourney.bind(null, start.action.href)}>
                <PendingButton className="task-action" pendingText="Abrindo o capítulo...">{journey.completed > 0 ? "Continuar" : "Começar"}: {start.action.label} <ArrowRight size={16} aria-hidden /></PendingButton>
              </form>
            ) : null}
            <Link href="/jornada" className={start ? textLink : "task-action"}>Ver a história completa</Link>
            <form action={dismissWelcome}>
              <button type="submit" className="min-h-12 text-sm text-ink underline-offset-4 hover:underline">Agora não</button>
            </form>
          </div>
        </div>
        <Character variant={journey.character} className="hidden w-36 sm:block xl:w-40" />
      </div>
    </section>
  );
}

// O recado de hoje, fixado no topo do mural: o capítulo atual, com uma ação só.
// Sem capítulo pendente, `fallback` traz a tarefa de rotina (registrar uma aula,
// abrir o painel).
export function JourneyToday({ journey, fallback, character = false }: {
  journey: Journey;
  fallback: { title: string; text: string; action: { label: string; href: string } };
  character?: boolean;
}) {
  const current = journey.current;
  const action = current?.action ?? fallback.action;
  const total = journey.chapters.length;
  return (
    <section aria-labelledby="hoje-titulo" className="mural-notice mb-7 p-5 pt-7 sm:p-8 sm:pt-9 print:hidden">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <h2 id="hoje-titulo" className="font-display text-[28px] font-extrabold leading-[1.1] text-ink sm:text-[34px]">{current?.title ?? fallback.title}</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink">{current?.story ?? fallback.text}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href={action.href} className="task-action">{action.label} <ArrowRight size={16} aria-hidden /></Link>
            <Link href="/jornada" className={textLink}>Ver a história completa</Link>
          </div>
          {total ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
              <ChapterMarks marks={journeyMarks(journey)} />
              <p className="text-sm text-ink">{journey.title} · {journey.completed} de {total} capítulos</p>
            </div>
          ) : null}
        </div>
        {character ? <Character variant={journey.character} className="hidden w-36 shrink-0 sm:block xl:w-40" preload /> : null}
      </div>
    </section>
  );
}

// Resumo compacto: onde a pessoa está na história e o próximo passo.
export function JourneyProgress({ journey, layout = "card" }: { journey: Journey; layout?: "card" | "strip" }) {
  if (!journey.chapters.length) return null;
  const current = journey.current;
  const total = journey.chapters.length;
  const summary = `${journey.completed} de ${total} capítulos`;
  const rest = journey.completed < total ? "Você está em dia. O restante aguarda a outra parte." : "Todos os capítulos concluídos. A história continua a cada semana.";
  if (layout === "strip") {
    return (
      <section aria-label="Sua jornada" className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-line bg-paper-raised px-4 py-3.5 sm:px-5 print:hidden">
        <div className="min-w-[200px] flex-1">
          <p className="text-sm font-bold text-ink">{current ? `Próximo: ${current.title}` : rest}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><JourneyBar journey={journey} /><span className="text-xs text-ink-soft">{summary}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {current ? <Link href={current.action.href} className="task-action !min-h-11 !py-2">{current.action.label} <ArrowRight size={16} aria-hidden /></Link> : null}
          <Link href="/jornada" className="task-action task-action-secondary !min-h-11 !py-2">Ver minha jornada</Link>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="jornada-resumo-titulo" className="rounded-lg border border-line bg-paper-raised p-5">
      <h2 id="jornada-resumo-titulo" className="font-display text-lg font-bold leading-snug">{journey.title}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2"><JourneyBar journey={journey} /><span className="text-xs text-ink-soft">{summary}</span></div>
      {current ? (
        <>
          <p className="mt-4 text-sm font-bold leading-snug text-ink">Próximo: {current.title}</p>
          <Link href={current.action.href} className="task-action mt-3 !min-h-11 !py-2">{current.action.label} <ArrowRight size={16} aria-hidden /></Link>
        </>
      ) : <p className="mt-4 text-sm leading-relaxed text-ink-soft">{rest}</p>}
      <Link href="/jornada" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-pen underline underline-offset-4">Ver a história completa <ArrowRight size={16} aria-hidden /></Link>
    </section>
  );
}
