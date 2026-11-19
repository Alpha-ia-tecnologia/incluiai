import { ArrowDown, ArrowUp, X } from "lucide-react";
import { MONTH_NAMES } from "@/lib/dates";
import type { MonthState } from "@/lib/dashboard";
import type { TrendGroupKey } from "@/lib/panel-overview";
import { PARTICIPATION, SUPPORT_LEVELS } from "@/lib/scale";
import { reachedGoal } from "@/lib/support-steps";
import { trendLabel, type SupportTrend } from "@/lib/support-trend";
import { Meter } from "@/components/viz/charts";
import { StepSquare, TrendChip } from "@/components/viz/support-steps";

const MONTH_STATE_TEXT: Record<MonthState, (records: number) => string> = {
  registro: (records) => `${records} ${records === 1 ? "registro" : "registros"}`,
  sem_registro: () => "nenhum registro",
  aberto: () => "mês em andamento, ainda sem registro",
  recesso: () => "recesso escolar",
  antes: () => "antes do primeiro registro",
  futuro: () => "ainda não chegou",
};

function MonthDot({ state, records, label }: { state: MonthState; records: number; label: string }) {
  const text = `${label}: ${MONTH_STATE_TEXT[state](records)}`;
  const base = "mx-auto flex size-[18px] items-center justify-center rounded-full sm:size-[22px]";
  const dot = state === "registro" ? <span className={`${base} border-[3px] border-signal-lime-soft bg-signal-lime`} />
    : state === "sem_registro" ? <span className={`${base} bg-signal-orange text-ink-strong`}><X size={11} strokeWidth={3} /></span>
      : state === "aberto" ? <span className={`${base} border-2 border-dashed border-line`} />
        : state === "recesso" ? <span className={`${base} border border-line bg-paper`} />
          : <span className="mx-auto block size-1.5 rounded-full bg-line" />;
  return <span title={text} className="block">{dot}<span className="sr-only">{text}</span></span>;
}

export function MonthGrid({ years }: { years: { year: number; months: { month: number; records: number; state: MonthState }[] }[] }) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-y-1.5 text-center">
      <caption className="sr-only">Registros de aula por mês e ano</caption>
      <thead>
        <tr>
          <th scope="col" className="w-11"><span className="sr-only">Ano</span></th>
          {MONTH_NAMES.map((month) => <th key={month} scope="col" className="pb-1 text-xs font-medium text-ink"><abbr title={month} className="no-underline">{month[0].toUpperCase()}</abbr></th>)}
        </tr>
      </thead>
      <tbody>
        {years.map(({ year, months }) => (
          <tr key={year}>
            <th scope="row" className="text-left text-xs font-normal tabular-nums text-ink-soft">{year}</th>
            {months.map((month) => <td key={month.month}><MonthDot state={month.state} records={month.records} label={`${MONTH_NAMES[month.month - 1]} de ${year}`} /></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Cobertura: quantos estudantes já têm cada passo, em "X de N". A barra é quantidade, sem juízo (azul). */
export function CoverageList({ rows, total }: { rows: ReadonlyArray<{ key: string; label: string; hint?: string; done: number }>; total: number }) {
  return (
    <ul className="grid gap-3.5">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
          <span className="min-w-0 text-sm text-ink">{row.label}{row.hint ? <span className="text-xs text-ink-soft"> · {row.hint}</span> : null}</span>
          <span className="whitespace-nowrap text-sm tabular-nums text-ink-soft"><strong className="font-semibold text-ink">{row.done}</strong> de {total}</span>
          <Meter value={row.done} max={total} thick className="col-span-2" />
        </li>
      ))}
    </ul>
  );
}

export type TrendStep = { key: string; level: number | null; participation: string | null; target: number | null };
export type TrendStepGroup = { key: TrendGroupKey; reading: Pick<SupportTrend, "trend" | "reason">; items: ReadonlyArray<TrendStep> };

const LEVELS = [0, 1, 2, 3, 4, 5] as const;
const byLevel = (a: TrendStep, b: TrendStep) => (a.level ?? 9) - (b.level ?? 9) || (a.target ?? 9) - (b.target ?? 9);

function EdgeLabel({ up, children }: { up: boolean; children: string }) {
  const Icon = up ? ArrowUp : ArrowDown;
  return <span className="flex items-center gap-1 text-xs leading-4 text-ink-soft"><Icon size={12} aria-hidden className="shrink-0" />{children}</span>;
}

/**
 * Degraus de apoio agregados: cada objetivo é uma coluna, com o quadrado na altura
 * do apoio da aula mais recente (mais alto, mais autonomia; preenchimento pela
 * participação; verde na meta) e o traço da meta. Os objetivos vêm agrupados pela
 * tendência, com o mesmo selo da ficha. Com muitos objetivos, as células encolhem
 * e as colunas quebram linha dentro do grupo.
 */
export function TrendSteps({ groups, sentence }: { groups: ReadonlyArray<TrendStepGroup>; sentence: string }) {
  const items = groups.flatMap((group) => group.items);
  const mini = items.length > 48;
  const [cell, gap] = mini ? [8, 2] : [14, 3];
  const pitch = cell + gap;
  const kinds = new Set<string | null>(items.map((item) => (item.participation === "parcial" || item.participation === "recusou" ? item.participation : item.participation ? "total" : null)));
  const reached = items.some((item) => item.level !== null && reachedGoal(item.level, item.target));
  const legend: [string, string][] = [["total", PARTICIPATION.total.short!], ["parcial", PARTICIPATION.parcial.short!], ["recusou", PARTICIPATION.recusou.label]];
  return (
    <figure data-trend-steps className="min-w-0">
      <div role="img" aria-label={sentence} className="flex min-w-0 flex-col gap-1.5">
        <EdgeLabel up>mais autonomia</EdgeLabel>
        <div className="flex min-w-0 flex-wrap items-start gap-x-7 gap-y-4">
          {groups.map((group) => (
            <div key={group.key} className="flex min-w-0 max-w-full flex-col gap-2">
              <span className="flex items-center gap-1.5">
                <TrendChip reading={group.reading} />
                <span className="text-sm font-semibold tabular-nums text-ink">{group.items.length}</span>
              </span>
              <span className="flex flex-wrap" style={{ columnGap: gap, rowGap: 10 }}>
                {[...group.items].sort(byLevel).map((item) => (
                  <span key={item.key} className="relative flex flex-col" style={{ gap, width: cell }}>
                    {item.target !== null ? <span className="absolute -inset-x-0.5 border-t-[1.5px] border-dashed border-ink-soft" style={{ top: item.target * pitch + cell / 2 - 0.75 }} /> : null}
                    {LEVELS.map((level) => (
                      <span key={level} className="relative z-[1] flex items-center justify-center" style={{ height: cell }}>
                        {item.level === level
                          ? <StepSquare participation={item.participation ?? "total"} reached={reachedGoal(level, item.target)} size={mini ? "mini" : "regular"} />
                          : <span className={`${mini ? "size-0.5" : "size-[3px]"} rounded-full bg-line`} />}
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <EdgeLabel up={false}>mais apoio</EdgeLabel>
      </div>
      <ul aria-hidden className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
        {legend.map(([key, label]) => kinds.has(key) ? (
          <li key={key} className="inline-flex items-center gap-1.5"><span className="size-2.5"><StepSquare participation={key} reached={false} size="mini" /></span>{label}</li>
        ) : null)}
        {reached ? <li className="inline-flex items-center gap-1.5"><span className="size-2.5"><StepSquare participation="total" reached size="mini" /></span>Na meta</li> : null}
        <li className="inline-flex items-center gap-1.5"><span className="w-3.5 border-t-[1.5px] border-dashed border-ink-soft" />meta</li>
      </ul>
      {/* Tabela ignora width:1px; o bloco sr-only em volta impede que ela alargue a página a 320px. */}
      <div className="sr-only">
        <table>
          <caption>Objetivos por tendência</caption>
          <thead><tr><th scope="col">Tendência</th><th scope="col">Apoio na aula mais recente</th><th scope="col">Meta</th></tr></thead>
          <tbody>
            {groups.flatMap((group) => [...group.items].sort(byLevel).map((item) => (
              <tr key={item.key}>
                <td>{trendLabel(group.reading)}</td>
                <td>{item.level === null ? "Sem registro" : SUPPORT_LEVELS[item.level].label}</td>
                <td>{item.target === null ? "—" : SUPPORT_LEVELS[item.target].label}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
