import type { ReactNode } from "react";
import { decimal, plural } from "@/lib/format";
import { supportInfo, supportOffset, supportTone } from "@/lib/scale";
import { criterionSplit, participationSplit, percentOf } from "@/lib/series";
import { DonutSummary, RAMP_GRADIENT, SIGNAL, StackedBar, TONE_COLOR, withSegmentColors } from "./charts";

type LessonEntry = { date: Date | string; participation?: string; criterionMet?: string };

const supportColor = (level: number) => TONE_COLOR[supportTone(level)];
const levelText = (level: number) => `${supportInfo(level).label} (${decimal(level)})`;

// Moldura para o SupportChart: a tabela sr-only dele não encolhe (tabela
// ignora width: 1px e overflow) e alargava a página a 320 px. A moldura vira
// o bloco de referência da tabela e corta só na horizontal; o pr-2 deixa
// inteiro o ponto do último registro, que passa da borda direita.
export function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="relative min-w-0 overflow-x-clip pr-2">{children}</div>;
}

export function SupportCells({ level, className }: { level: number; className: string }) {
  const value = supportInfo(level).level;
  return (
    <span aria-hidden className={className}>
      {[1, 2, 3, 4, 5].map((cell) => (
        <span key={cell} className={`h-2.5 flex-1 rounded-full ${cell <= value ? "hatch viz-grow-x" : ""}`} style={{ backgroundColor: cell <= value ? supportColor(value) : SIGNAL.track }} />
      ))}
    </span>
  );
}

export function SupportMeter({ level, showName = true }: { level: number; showName?: boolean }) {
  const info = supportInfo(level);
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
      <SupportCells level={level} className="flex w-14 shrink-0 gap-0.5" />
      <span className="min-w-0 text-xs text-ink">
        <span className="font-medium">{info.code}</span>
        <span className={showName ? "text-ink-soft" : "sr-only"}> · {info.label}</span>
      </span>
    </span>
  );
}

export function SupportChart({ points, start, target, label, height = 168 }: { points: ReadonlyArray<{ date: string; value: number }>; start?: number | null; target?: number | null; label: string; height?: number }) {
  if (points.length < 2) return <p className="text-sm text-ink-soft">Com dois registros ou mais, a evolução do apoio aparece aqui.</p>;
  const x = (index: number) => (index / (points.length - 1)) * 100;
  const y = (level: number) => (1 - supportOffset(level)) * 100;
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const middle = Math.floor((points.length - 1) / 2);
  return (
    <figure className="min-w-0">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
        <div className="flex flex-col justify-between text-right text-xs leading-none text-ink-soft" style={{ height }} aria-hidden>
          <span>0 · {supportInfo(0).code}</span><span>5 · {supportInfo(5).code}</span>
        </div>
        <div className="relative min-w-0" style={{ height }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={label}>
            {[0, 1, 2, 3, 4, 5].map((level) => <line key={level} x1={0} x2={100} y1={y(level)} y2={y(level)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
            <path d={`${line} L100,100 L0,100 Z`} fill="var(--signal-lime-soft)" className="viz-grow-y" />
            {typeof target === "number" ? <line x1={0} x2={100} y1={y(target)} y2={y(target)} stroke={SIGNAL.ink} strokeWidth={1.2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" /> : null}
            {typeof start === "number" ? <line x1={0} x2={100} y1={y(start)} y2={y(start)} stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" /> : null}
            <path d={line} fill="none" stroke={SIGNAL.ink} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="viz-wipe" />
          </svg>
          {points.map((point, index) => (
            <span key={index} aria-hidden title={`${point.date}: ${levelText(point.value)}`} className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-e1" style={{ left: `${x(index)}%`, top: `${y(point.value)}%`, backgroundColor: supportColor(point.value) }} />
          ))}
          {typeof target === "number" ? <span aria-hidden className="absolute right-0 -translate-y-full rounded-full bg-paper-raised px-1.5 text-xs font-medium text-ink" style={{ top: `${y(target)}%` }}>meta</span> : null}
        </div>
      </div>
      <div className="ml-[3.25rem] mt-1.5 flex justify-between text-xs text-ink-soft" aria-hidden>
        <span>{points[0].date}</span>{points.length > 2 ? <span className="max-sm:hidden">{points[middle].date}</span> : null}<span>{points[points.length - 1].date}</span>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-ink" /> Apoio registrado</span>
        {typeof target === "number" ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-2 border-dashed border-ink" /> Meta: {levelText(target)}</span> : null}
        {typeof start === "number" ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-2 border-dotted border-ink-soft" /> Início: {levelText(start)}</span> : null}
        <span>Subir é precisar de menos apoio.</span>
      </figcaption>
      {/* Tabela ignora width:1px; o bloco sr-only em volta impede que ela alargue a página a 320px. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">Data</th><th scope="col">Nível de apoio</th></tr></thead>
          <tbody>{points.map((point, index) => <tr key={index}><td>{point.date}</td><td>{levelText(point.value)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}

export const SCALE_MARKER = {
  initial: "rounded-full border-2 border-ink-strong bg-white",
  latest: "rounded-full bg-ink-strong",
  target: "rotate-45 rounded-[2px] border-2 border-ink-strong bg-white",
} as const;

export function SupportScale({ initial, latest, target }: { initial: number; latest: number; target: number }) {
  const position = (level: number) => `${supportOffset(level) * 100}%`;
  return (
    <div className="pt-6" aria-hidden>
      <div className="relative">
        <span className={`absolute bottom-[calc(100%+3px)] size-3.5 -translate-x-1/2 ${SCALE_MARKER.initial}`} style={{ left: position(initial) }} />
        <div className="h-3 rounded-full" style={{ backgroundImage: `var(--hatch), ${RAMP_GRADIENT}` }} />
        <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-ink-strong shadow-e1" style={{ left: position(latest) }} />
        <span className={`absolute top-[calc(100%+4px)] size-3 -translate-x-1/2 ${SCALE_MARKER.target}`} style={{ left: position(target) }} />
      </div>
      <div className="mt-6 flex justify-between text-xs text-ink-soft"><span>Mais apoio (5)</span><span>Independente (0)</span></div>
    </div>
  );
}

export function ParticipationDonut({ id, entries, size = 120 }: { id: string; entries: ReadonlyArray<LessonEntry>; size?: number }) {
  const segments = withSegmentColors(participationSplit(entries));
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <DonutSummary
      id={id}
      segments={segments}
      size={size}
      label={`Participação em ${plural(total, "registro", "registros")}`}
      center={`${percentOf(segments[0].value, total) ?? 0}%`}
      caption={<>toda a<br />atividade</>}
      empty="Ainda sem registro de participação."
    />
  );
}

export function CriterionBar({ entries }: { entries: ReadonlyArray<LessonEntry> }) {
  return <StackedBar segments={withSegmentColors(criterionSplit(entries))} empty="Ainda sem registro de resultado." />;
}
