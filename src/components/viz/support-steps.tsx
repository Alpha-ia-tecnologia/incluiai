import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Minus, MoveRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { PARTICIPATION, SUPPORT_LEVELS, TREND } from "@/lib/scale";
import { reachedGoal, stepsSentence, visibleLessons, type StepLesson, type StepsAudience, type StepsSize, type SupportStepsData } from "@/lib/support-steps";
import { trendLabel, type SupportTrend, type TrendReason } from "@/lib/support-trend";
import { StatusPill } from "./charts";

export type { StepsAudience, StepsSize, SupportStepsData } from "@/lib/support-steps";

const LEVELS = [0, 1, 2, 3, 4, 5] as const;

const GEOMETRY: Record<StepsSize, { cell: number; gap: number; dot: string }> = {
  mini: { cell: 8, gap: 2, dot: "size-0.5" },
  regular: { cell: 14, gap: 3, dot: "size-[3px]" },
  full: { cell: 14, gap: 3, dot: "size-[3px]" },
};

// Colunas mais antigas saem quando o espaço do contêiner não as comporta,
// para caber a 320 px sem rolagem lateral. `hide` esconde a coluna abaixo da
// largura; `only` mostra só abaixo dela (a data da coluna mais antiga visível).
type Tier = { upTo: number; hide: string; only: string };
const TIERS: Record<StepsSize, ReadonlyArray<Tier>> = {
  mini: [{ upTo: 8, hide: "", only: "" }],
  regular: [
    { upTo: 9, hide: "", only: "" },
    { upTo: 11, hide: "@max-3xs:hidden", only: "@3xs:hidden" },
    { upTo: 12, hide: "@max-2xs:hidden", only: "@2xs:hidden" },
  ],
  full: [
    { upTo: 10, hide: "", only: "" },
    { upTo: 13, hide: "@max-2xs:hidden", only: "@2xs:hidden" },
    { upTo: 17, hide: "@max-md:hidden", only: "@md:hidden" },
    { upTo: 20, hide: "@max-lg:hidden", only: "@lg:hidden" },
    { upTo: 24, hide: "@max-xl:hidden", only: "@xl:hidden" },
  ],
};
const tierOf = (size: StepsSize, fromEnd: number) => TIERS[size].find((tier) => fromEnd < tier.upTo) ?? TIERS[size][TIERS[size].length - 1];

const WORDS: Record<StepsAudience, { goal: string; up: string; down: string; legend: [string, string, string, string] }> = {
  equipe: { goal: "meta", up: "mais autonomia", down: "mais apoio", legend: [PARTICIPATION.total.short!, PARTICIPATION.parcial.short!, PARTICIPATION.recusou.label, "Na meta"] },
  familia: { goal: "objetivo", up: "mais autonomia", down: "mais ajuda", legend: ["Participou", "Em parte", "Recusou", "No objetivo"] },
};

const ENTRANCE_MS = 120;

const kindOf = (participation: string) => (participation === "parcial" || participation === "recusou" ? participation : "total");
const FILL = {
  total: "bg-current",
  parcial: "border-[1.5px] border-current bg-paper-raised bg-[linear-gradient(to_top,currentColor_50%,transparent_50%)]",
  recusou: "border-[1.5px] border-current bg-paper-raised",
};

/** Um quadrado dos degraus, para legendas e quadros agregados com o mesmo vocabulário. */
export function StepSquare({ participation, reached, size, style, className = "" }: { participation: string; reached: boolean; size: StepsSize; style?: CSSProperties; className?: string }) {
  const fill = FILL[kindOf(participation)];
  return <span className={`block size-full ${size === "mini" ? "rounded-[2px]" : "rounded-[3px]"} ${reached ? "text-green" : "text-ink-strong"} ${fill} ${className}`} style={style} />;
}

function EdgeLabel({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return <span className="flex items-center gap-1 text-xs leading-4 text-ink-soft"><Icon size={12} aria-hidden className="shrink-0" />{children}</span>;
}

/**
 * Degraus de apoio: cada aula é um quadrado; a altura é o nível de apoio (mais
 * alto, mais autonomia) e o preenchimento é a participação (cheio: toda a
 * atividade; metade: parte; contorno: recusou). Em verde quando chega à meta.
 *
 * - `mini`: 8 aulas, sem rótulos (cabeçalho, listas, fila do Início). Tamanho fixo.
 * - `regular`: 12 aulas, meta e legenda curta (cartões). Ocupa a largura do pai.
 * - `full`: 24 aulas, níveis por extenso, datas e legenda (Evolução). Ocupa a largura do pai.
 * Monte `data` com `stepsFor(objetivo, aulas)` ou `stepsFrom(aulas, { target })`, de `@/lib/support-steps`.
 */
export function SupportSteps({ data, size = "regular", audience = "equipe", name, highlightLast = false, className = "" }: {
  data: SupportStepsData;
  size?: StepsSize;
  audience?: StepsAudience;
  /** O objetivo, para a legenda da tabela e o começo da descrição. */
  name?: string;
  /** Destaca a aula mais recente (o registro que acabou de ser salvo). */
  highlightLast?: boolean;
  className?: string;
}) {
  const { cell, gap, dot } = GEOMETRY[size];
  const lessons = visibleLessons(data, size);
  const words = WORDS[audience];
  const sentence = stepsSentence(data, { size, audience });
  // Com poucas aulas, as colunas à direita ficam só com os pontos: o lugar das próximas.
  const columns: (StepLesson | null)[] = [...lessons, ...Array.from({ length: Math.max(0, TIERS[size][0].upTo - lessons.length) }, () => null)];
  const newest = lessons.length - 1;
  const pitch = cell + gap;
  const height = LEVELS.length * pitch - gap;
  const target = data.target;
  const labelled = size !== "mini";
  const stagger = lessons.length > 1 ? ENTRANCE_MS / (lessons.length - 1) : 0;
  const slots = (render: (level: number) => ReactNode) => (
    <span className="flex flex-col" style={{ gap }}>
      {LEVELS.map((level) => <span key={level} className="flex items-center" style={{ height: cell }}>{render(level)}</span>)}
    </span>
  );

  const grid = (
    <span className="flex items-start gap-2">
      {size === "full" ? (
        <span className="hidden shrink-0 @sm:block">{slots((level) => <span className="whitespace-nowrap text-xs leading-4 text-ink-soft">{SUPPORT_LEVELS[level].short}</span>)}</span>
      ) : null}
      <span className="relative flex shrink-0" style={{ gap, height: size === "full" ? undefined : height }}>
        {target !== null ? <span aria-hidden className="absolute -inset-x-1 border-t-[1.5px] border-dashed border-ink-soft" style={{ top: target * pitch + cell / 2 - 0.75 }} /> : null}
        {columns.map((lesson, index) => {
          const fromEnd = columns.length - 1 - index;
          // A data fica na aula mais recente e na mais antiga que estiver à vista.
          const oldestShown = index === 0 ? "" : tierOf(size, fromEnd + 1) !== tierOf(size, fromEnd) ? tierOf(size, fromEnd + 1).only : null;
          const dateClass = index === newest ? "" : lessons.length > 3 ? oldestShown : null;
          return (
            <span key={lesson?.key ?? index} className={`relative flex flex-col ${tierOf(size, fromEnd).hide}`} style={{ gap, width: cell }}>
              {LEVELS.map((level) => (
                <span key={level} className="relative z-[1] flex items-center justify-center" style={{ height: cell }}>
                  {lesson && lesson.level === level ? (
                    <StepSquare
                      participation={lesson.participation}
                      reached={reachedGoal(level, target)}
                      size={size}
                      className={`viz-grow-y ${highlightLast && index === newest ? "outline-2 outline-offset-2 outline-brand" : ""}`}
                      style={{ animationDuration: "180ms", animationDelay: `${Math.round(index * stagger)}ms` }}
                    />
                  ) : <span className={`${dot} rounded-full bg-line`} />}
                </span>
              ))}
              {size === "full" && lesson && dateClass !== null ? (
                <span className={`relative mt-1 h-4 ${dateClass}`}>
                  <span className={`absolute top-0 whitespace-nowrap text-xs leading-4 tabular-nums text-ink-soft ${index === newest && index > 1 ? "right-0" : "left-0"}`}>{lesson.date}</span>
                </span>
              ) : null}
            </span>
          );
        })}
        {labelled && !lessons.length ? (
          // Sem aula, a frase fica dentro da grade: no celular, ao lado ela caía entre a grade e a borda "mais apoio".
          <span className="absolute inset-x-0 top-1/2 z-[2] flex -translate-y-1/2 justify-center">
            <span className="whitespace-nowrap rounded-full bg-paper-raised px-2 text-sm text-ink-soft">Ainda sem registro</span>
          </span>
        ) : null}
      </span>
      {labelled && target !== null ? (
        <span className="shrink-0">{slots((level) => (level === target ? <span className="whitespace-nowrap text-xs font-medium leading-4 text-ink-soft">{words.goal}</span> : null))}</span>
      ) : null}
    </span>
  );

  if (size === "mini") {
    return (
      <span role="img" aria-label={name ? `${name}. ${sentence}` : sentence} data-support-steps="mini" className={`inline-block shrink-0 ${className}`}>
        {grid}
      </span>
    );
  }

  return (
    <figure data-support-steps={size} className={`@container min-w-0 ${className}`}>
      <div role="img" aria-label={name ? `${name}. ${sentence}` : sentence} className="flex min-w-0 flex-col gap-1.5">
        <span className={size === "full" ? "@sm:hidden" : ""}><EdgeLabel icon={ArrowUp}>{words.up}</EdgeLabel></span>
        {grid}
        <span className={size === "full" ? "@sm:hidden" : ""}><EdgeLabel icon={ArrowDown}>{words.down}</EdgeLabel></span>
      </div>
      {lessons.length ? (
        <ul aria-hidden className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
          {(["total", "parcial", "recusou"] as const).map((key, index) => lessons.some((lesson) => kindOf(lesson.participation) === key) ? (
            <li key={key} className="inline-flex items-center gap-1.5"><span className="size-2.5"><StepSquare participation={key} reached={false} size="mini" /></span>{words.legend[index]}</li>
          ) : null)}
          {lessons.some((lesson) => reachedGoal(lesson.level, target)) ? <li className="inline-flex items-center gap-1.5"><span className="size-2.5"><StepSquare participation="total" reached size="mini" /></span>{words.legend[3]}</li> : null}
        </ul>
      ) : null}
      {lessons.length ? (
        // Tabela ignora width:1px; o bloco sr-only em volta impede que ela alargue a página a 320px.
        <div className="sr-only">
          <table>
            {name ? <caption>{name}</caption> : null}
            <thead><tr><th scope="col">Data</th><th scope="col">Nível de apoio</th><th scope="col">Participação</th></tr></thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.key}><td>{lesson.dateLong}</td><td>{SUPPORT_LEVELS[lesson.level].label}</td><td>{PARTICIPATION[lesson.participation]?.label ?? lesson.participation}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  );
}

const REASON_ICON: Record<TrendReason, LucideIcon> = {
  poucos: Minus,
  meta: Check,
  menos_apoio: TrendingUp,
  mais_apoio: TrendingDown,
  recusas: AlertTriangle,
  sem_avanco: MoveRight,
  estavel: MoveRight,
};

/** O selo da tendência: a única cor de estado ao lado dos degraus, sempre com palavra e ícone. */
export function TrendChip({ reading }: { reading: Pick<SupportTrend, "trend" | "reason"> }) {
  const Icon = REASON_ICON[reading.reason];
  return (
    <StatusPill tone={TREND[reading.trend].tone}>
      <Icon size={12} aria-hidden className="shrink-0" /><span className="sr-only">Tendência: </span>{trendLabel(reading)}
    </StatusPill>
  );
}
