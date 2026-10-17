import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, CircleHelp, Lightbulb, Lock, Route, Sparkles, Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import type { ReactNode } from "react";
import { loadJourney, recordJourneyMark, type Chapter, type ImpactItem } from "@/lib/user-journey";
import { TREND_TEXT } from "@/lib/series";
import { CountChips, DataCard, DotStrip, MiniColumns, QuoteCard, RingStat, Sparkline, StatTile, StatusPill, TONE_COLOR } from "@/components/data-viz";
import { formatDate } from "@/lib/format";
import { Character } from "@/components/character";
import { EmptyState } from "@/components/ui";
import { JourneyBar, TONE_CLASSES } from "@/components/journey-ui";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<Chapter["status"], string> = {
  concluido: "Concluído",
  agora: "Você está aqui",
  pendente: "Ainda não feito",
  em_seguida: "Em seguida",
  aguardando: "Aguardando",
};

function ChapterProgress({ chapter }: { chapter: Chapter }) {
  if (!chapter.progress || !chapter.progress.total) return null;
  const pct = Math.round((chapter.progress.done / chapter.progress.total) * 100);
  return (
    <div className="mt-3 max-w-xs" aria-hidden>
      <div className="h-2 overflow-hidden rounded-full bg-paper-raised">
        <div className={`h-full rounded-full ${TONE_CLASSES[chapter.tone].solid}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ estudante?: string }> }) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await recordJourneyMark(user.id, "boas_vindas");
  const journey = await loadJourney(user, { studentId: filters.estudante });
  const { chapters, current } = journey;
  const currentIndex = current ? chapters.indexOf(current) : -1;
  const waiting = chapters.filter((chapter) => chapter.status === "aguardando");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex items-center justify-between gap-5">
        <div className="min-w-0 max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-strong"><Route size={18} aria-hidden /> Minha jornada</p>
          <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-[40px]">{journey.title}</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">{journey.intro}</p>
          {chapters.length ? (
            <div className="mt-5 max-w-md">
              <p className="mb-2 text-sm text-ink"><strong className="font-medium">{journey.completed} de {chapters.length}</strong> capítulos concluídos</p>
              <JourneyBar journey={journey} />
            </div>
          ) : null}
        </div>
        <Character variant={journey.character} className="hidden w-36 shrink-0 sm:block lg:w-44" preload />
      </header>

      {journey.focus && journey.focus.options.length > 1 ? (
        <nav aria-label="Escolher o estudante da história" className="mb-7">
          <p className="mb-2 text-sm text-ink-soft">Acompanhar a história de:</p>
          <ul className="flex flex-wrap gap-2">
            {journey.focus.options.map((option) => (
              <li key={option.id}>
                <Link href={`/jornada?estudante=${option.id}`} scroll={false} aria-current={option.id === journey.focus!.id ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper-raised px-4 text-sm text-ink transition-colors hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand aria-[current=page]:text-white">
                  {option.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {!chapters.length ? (
        <EmptyState title="Sua história ainda não começou" hint={journey.intro} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {current ? (
              <section aria-labelledby="agora-titulo" className={`mb-8 rounded-[26px] p-5 sm:p-7 ${TONE_CLASSES[current.tone].soft}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${TONE_CLASSES[current.tone].ink}`}>Capítulo {currentIndex + 1} · Continue de onde parou</p>
                <h2 id="agora-titulo" className="mt-2 font-display text-2xl font-medium leading-tight tracking-tight text-ink sm:text-[28px]">{current.title}</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink">{current.story}</p>
                {current.evidence ? <p className="mt-3 max-w-2xl rounded-2xl bg-paper-raised/70 px-4 py-3 text-sm leading-relaxed text-ink-soft">{current.evidence}</p> : null}
                <ChapterProgress chapter={current} />
                <p className="mt-4 flex max-w-2xl items-start gap-2 text-sm leading-relaxed text-ink-soft"><Lightbulb size={17} className={`mt-0.5 shrink-0 ${TONE_CLASSES[current.tone].ink}`} aria-hidden /> {current.why}</p>
                <Link href={current.action.href} className="task-action mt-5 w-full sm:w-fit">{current.action.label} <ArrowRight size={17} aria-hidden /></Link>
              </section>
            ) : waiting.length ? (
              <section aria-labelledby="em-dia-titulo" className="mb-8 rounded-[26px] bg-sage-soft p-5 sm:p-7">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sage-ink"><Sparkles size={15} aria-hidden /> Você está em dia</p>
                <h2 id="em-dia-titulo" className="mt-2 font-display text-2xl font-medium leading-tight tracking-tight text-ink">O que depende de você já foi feito</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink">{waiting.map((chapter) => `“${chapter.title}” está aguardando: ${chapter.evidence ?? chapter.story}`).join(" ")}</p>
                <Link href={waiting[0].action.href} className="task-action task-action-secondary mt-5 w-full sm:w-fit">{waiting[0].action.label} <ArrowRight size={17} aria-hidden /></Link>
              </section>
            ) : (
              <section aria-labelledby="completa-titulo" className="mb-8 rounded-[26px] bg-sage-soft p-5 sm:p-7">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sage-ink"><Sparkles size={15} aria-hidden /> História completa</p>
                <h2 id="completa-titulo" className="mt-2 font-display text-2xl font-medium leading-tight tracking-tight text-ink">Todos os capítulos têm registro</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink">A história continua na rotina: cada aula registrada, cada conquista contada e cada revisão do plano somam ao que já foi construído.</p>
              </section>
            )}

            <h2 className="mb-4 text-lg font-medium">Todos os capítulos</h2>
            <ol className="relative">
              {chapters.map((chapter, index) => {
                const tone = TONE_CLASSES[chapter.tone];
                const last = index === chapters.length - 1;
                return (
                  <li key={chapter.key} aria-current={chapter.status === "agora" ? "step" : undefined} className="relative flex gap-4 pb-6">
                    {!last ? <span aria-hidden className="absolute left-[19px] top-11 bottom-0 w-px border-l-2 border-dashed border-line" /> : null}
                    <span className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${chapter.done ? `${tone.solid} text-white` : chapter.status === "agora" ? `${tone.soft} ${tone.ink} ring-2 ring-current` : "border-2 border-dashed border-line bg-paper-raised text-ink-soft"}`}>
                      {chapter.done ? <Check size={18} strokeWidth={3} aria-hidden /> : index + 1}
                    </span>
                    <article className={`min-w-0 flex-1 rounded-[20px] border p-4 sm:p-5 ${chapter.status === "agora" ? "border-transparent bg-paper-raised shadow-e2" : "border-line bg-paper-raised"}`}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-xs text-ink-soft">Capítulo {index + 1}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${chapter.done ? `${tone.soft} ${tone.ink}` : chapter.status === "agora" ? "bg-brand text-white" : "bg-surface-muted text-ink-soft"}`}>
                          {STATUS_LABELS[chapter.status]}{chapter.done && chapter.date ? ` em ${formatDate(chapter.date)}` : ""}
                        </span>
                        {chapter.progress && chapter.progress.total ? <span className="text-xs text-ink-soft">{chapter.progress.done} de {chapter.progress.total}</span> : null}
                      </div>
                      <h3 className="mt-1.5 text-base font-medium leading-snug text-ink sm:text-lg">{chapter.title}</h3>
                      {chapter.status === "agora" ? <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">Detalhes no destaque acima.</p>
                        : chapter.done ? <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{chapter.evidence ?? chapter.story}</p>
                          : <>
                            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{chapter.story}</p>
                            {chapter.evidence ? <p className={`mt-2 inline-block rounded-xl px-3 py-1.5 text-xs leading-relaxed ${tone.soft} ${tone.ink}`}>{chapter.evidence}</p> : null}
                          </>}
                      {chapter.status !== "agora" ? <ChapterProgress chapter={chapter} /> : null}
                      <Link href={chapter.action.href} className={`mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium ${tone.ink} underline-offset-4 hover:underline`}>
                        {chapter.action.label} <ArrowRight size={15} aria-hidden />
                      </Link>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className="space-y-5" aria-label="O que a jornada já construiu">
            {journey.impact.length || journey.strategies.length || journey.quote ? (
              <section aria-labelledby="impacto-titulo" className="dash-board !gap-3">
                <h2 id="impacto-titulo" className="px-2 pt-2 text-base font-medium">{journey.impactTitle}</h2>
                {journey.impact.length ? journey.impact.map((item, index) => <ImpactTile key={item.label} item={item} id={`impacto-${index}`} />)
                  : <p className="px-2 pb-2 text-sm leading-relaxed text-ink-soft">Os números aparecem depois dos primeiros registros de aula.</p>}
                {journey.strategies.length ? (
                  <DataCard title="O que funcionou nas aulas" hint="Marcado no registro da aula. O número é quantas vezes funcionou.">
                    <CountChips items={journey.strategies} />
                  </DataCard>
                ) : null}
                {journey.quote ? <QuoteCard text={journey.quote.text} source={journey.quote.source} /> : null}
              </section>
            ) : null}

            {journey.milestones.length ? (
              <section aria-labelledby="conquistas-titulo" className="rounded-[22px] bg-paper-raised p-5 ring-1 ring-line">
                <h2 id="conquistas-titulo" className="text-base font-medium">Conquistas da jornada</h2>
                <p className="mt-1 text-xs text-ink-soft">{journey.milestones.filter((milestone) => milestone.achieved).length} de {journey.milestones.length} alcançadas{journey.kind === "professor" || journey.kind === "escola" || journey.kind === "rede" ? " pela equipe" : ""}.</p>
                <ul className="mt-4 space-y-3">
                  {journey.milestones.map((milestone) => (
                    <li key={milestone.key} className="flex items-start gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${milestone.achieved ? "bg-amber-soft text-amber-800" : "bg-surface-muted text-ink-soft"}`}>
                        {milestone.achieved ? <Trophy size={16} aria-hidden /> : <Lock size={14} aria-hidden />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-medium leading-snug ${milestone.achieved ? "text-ink" : "text-ink-soft"}`}>{milestone.title}<span className="sr-only">{milestone.achieved ? ": alcançada" : ": ainda não alcançada"}</span></span>
                        <span className="block text-xs leading-relaxed text-ink-soft">{milestone.achieved && milestone.date ? `${formatDate(milestone.date)} · ` : ""}{milestone.description}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <Link href="/ajuda" className="flex items-center gap-3 rounded-[22px] bg-brand-soft p-5 text-sm text-ink transition-colors hover:bg-lilac">
              <CircleHelp size={22} className="shrink-0 text-brand-strong" aria-hidden />
              <span><span className="block font-medium">Dúvida em algum capítulo?</span><span className="text-ink-soft">A ajuda explica cada tarefa em poucos passos.</span></span>
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

// Um número da história com o gráfico que o explica (padrão do Painel de indicadores).
function ImpactTile({ item, id }: { item: ImpactItem; id: string }) {
  const viz = item.viz;
  let chart: ReactNode = null;
  let trend: ReactNode = null;
  if (viz?.kind === "weekly") chart = <MiniColumns points={viz.points} label={`${item.label} por semana`} />;
  if (viz?.kind === "dots") chart = <DotStrip items={viz.items} label={`${item.label}: uma marca por aula`} legend={PARTICIPATION_LEGEND} />;
  if (viz?.kind === "support") {
    chart = <Sparkline values={viz.values} domain={[0, 5]} invert label={`${item.label}: ${viz.values.join(", ")} (0 é independente, 5 é apoio físico total)`} />;
    trend = <StatusPill tone={viz.trend === "avancando" ? "good" : viz.trend === "atencao" ? "alert" : "neutral"}>{TREND_TEXT[viz.trend]}</StatusPill>;
  }
  if (viz?.kind === "ring") {
    return (
      <article className="dash-card flex min-w-0 items-center gap-4 !p-4">
        <RingStat id={id} value={viz.pct} label={item.label} size={84} color={TONE_COLOR[viz.tone]} />
        <div className="min-w-0">
          <h3 className="text-sm font-medium leading-snug text-ink">{item.label}</h3>
          <p className="mt-1 font-display text-[28px] leading-none tracking-tight text-ink tabular-nums">{item.value}</p>
          {item.hint ? <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{item.hint}</p> : null}
        </div>
      </article>
    );
  }
  return <StatTile label={item.label} value={item.value} hint={item.hint} chart={chart} trend={trend} />;
}

const PARTICIPATION_LEGEND = [{ tone: "good" as const, label: "Toda a atividade" }, { tone: "mid" as const, label: "Parte" }, { tone: "alert" as const, label: "Recusou" }];

