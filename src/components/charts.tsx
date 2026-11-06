import type { ReactNode } from "react";
import { Minus } from "lucide-react";
import type { MonthState } from "@/lib/dashboard";
import { SUPPORT_LEVELS } from "@/lib/scale";

// Gráficos do painel em HTML e SVG, sem biblioteca, nas cores do app: dados em
// lilás, bom em verde, intermediário em âmbar, baixo em coral (tokens --chart-*
// em globals.css). Rótulo e valor ficam sempre em texto, e nenhuma informação
// depende só da cor. Valor zero não desenha barra.

export const CHART = {
  data: "var(--chart-data)",
  good: "var(--chart-good)",
  mid: "var(--chart-mid)",
  low: "var(--chart-low)",
  track: "var(--chart-track)",
};

export type ChartSegment = { key: string; label: string; value: number; color: string };

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />;
}

export function BarRow({ label, value, max, detail, color = CHART.data }: {
  label: string;
  value: number;
  max: number;
  detail?: string;
  color?: string;
}) {
  const width = value > 0 && max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;
  return (
    <div className="text-sm">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-ink">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-ink-soft">{value}{detail ? ` · ${detail}` : ""}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: CHART.track }} aria-hidden>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function BarList({ rows, empty = "Sem dados no período.", color, max }: {
  rows: { key?: string; label: string; value: number; detail?: string }[];
  empty?: string;
  color?: string;
  max?: number;
}) {
  if (!rows.length || rows.every((row) => row.value === 0)) return <p className="text-sm text-ink-soft">{empty}</p>;
  const top = max ?? Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="space-y-3">
      {rows.map((row) => <li key={row.key ?? row.label}><BarRow label={row.label} value={row.value} detail={row.detail} max={top} color={color} /></li>)}
    </ul>
  );
}

export function Legend({ segments }: { segments: ChartSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <ul className="space-y-2">
      {segments.map((segment) => (
        <li key={segment.key} className="flex items-center gap-2.5 text-sm text-ink">
          <Swatch color={segment.color} />
          <span className="flex-1">{segment.label}</span>
          <span className="text-xs tabular-nums text-ink-soft">{segment.value} · {percent(segment.value, total)}%</span>
        </li>
      ))}
    </ul>
  );
}

// Distribuição 100% empilhada, com legenda em texto.
export function StackedBar({ segments, empty = "Sem registros no período." }: { segments: ChartSegment[]; empty?: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <div>
      <div className="flex h-3 gap-1" aria-hidden>
        {segments.map((segment) => segment.value > 0 ? (
          <div key={segment.key} className="h-full rounded-full" style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }} />
        ) : null)}
      </div>
      <div className="mt-4"><Legend segments={segments} /></div>
    </div>
  );
}

// Rosca: trilho e um arco por segmento, com o conteúdo no centro.
export function Donut({ segments, label, size = 152, thickness = 18, children }: {
  segments: ChartSegment[];
  label: string;
  size?: number;
  thickness?: number;
  children?: ReactNode;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  const gap = visible.length > 1 ? 3 : 0;
  const arcs = visible.map((segment, index) => ({
    segment,
    length: total ? (segment.value / total) * circumference : 0,
    start: visible.slice(0, index).reduce((sum, item) => sum + (total ? (item.value / total) * circumference : 0), 0),
  }));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" style={{ stroke: CHART.track }} strokeWidth={thickness} />
        {arcs.map(({ segment, length, start }) => (
          <circle
            key={segment.key}
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            style={{ stroke: segment.color }} strokeWidth={thickness}
            strokeDasharray={`${Math.max(length - gap, 0.5)} ${circumference}`}
            strokeDashoffset={-start}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// Medidor em meia-lua: trilho e um arco contínuo até o valor, com as marcas
// de 0, 50, 80 e 100%.
export function Gauge({ value, label, zones = [50, 80] }: { value: number | null; label: string; zones?: number[] }) {
  const [cx, cy, radius, labelRadius] = [180, 172, 132, 160];
  const point = (pct: number, r: number) => {
    const angle = Math.PI * (1 - pct / 100);
    return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  };
  const arc = (to: number) => {
    const end = point(to, radius);
    return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  };
  const shown = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <svg viewBox="0 0 360 190" className="w-full" role="img" aria-label={label}>
      <path d={arc(100)} fill="none" style={{ stroke: CHART.track }} strokeWidth={22} strokeLinecap="round" />
      {shown > 0 ? <path d={arc(shown)} fill="none" style={{ stroke: CHART.data }} strokeWidth={22} strokeLinecap="round" /> : null}
      {[0, ...zones, 100].map((pct) => {
        const { x, y } = point(pct, labelRadius);
        return <text key={pct} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-[var(--ink-soft)] text-[12px]">{pct}</text>;
      })}
    </svg>
  );
}

// Escala do nível de apoio (5 → 0) em trilho neutro, com os seis níveis
// marcados: precisar de apoio não é pintado como ruim. O início fica acima da
// barra, a meta abaixo e o último registro sobre ela.
export function SupportScale({ initial, latest, target }: { initial: number; latest: number; target: number }) {
  const position = (level: number) => `${((5 - Math.min(5, Math.max(0, level))) / 5) * 100}%`;
  return (
    <div className="pt-6" aria-hidden>
      <div className="relative">
        <span className="absolute bottom-[calc(100%+3px)] size-3.5 -translate-x-1/2 rounded-full border-2 border-ink bg-paper-raised" style={{ left: position(initial) }} />
        <div className="relative h-2.5 rounded-full" style={{ backgroundColor: CHART.track }}>
          {SUPPORT_LEVELS.map((level) => <span key={level.level} className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink-soft/40" style={{ left: position(level.level) }} />)}
        </div>
        <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-paper-raised shadow-e1" style={{ left: position(latest), backgroundColor: CHART.data }} />
        <span className="absolute top-[calc(100%+4px)] size-3 -translate-x-1/2 rotate-45 rounded-[2px] border-2 border-ink bg-paper-raised" style={{ left: position(target) }} />
      </div>
      <div className="mt-6 flex justify-between text-xs text-ink-soft"><span>Apoio físico total</span><span>Independente</span></div>
    </div>
  );
}

// Colunas para série temporal, com o valor acima de cada coluna. Valor e
// rótulo ficam posicionados sobre a coluna, fora da largura mínima do gráfico
// (13 semanas cabem a 320 px sem rolagem lateral). Para não se sobreporem, só
// uma coluna a cada passo mostra valor e rótulo: no máximo 6 no celular e 13 a
// partir de sm (24 meses viram 6 e 12), contando a partir da mais recente.
// Todas as colunas têm o valor no title e no aria-label.
export function ColumnChart({ rows, caption }: { rows: { label: string; title: string; value: number }[]; caption: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const narrowStep = Math.ceil(rows.length / 6);
  const wideStep = Math.ceil(rows.length / 13);
  const hidden = (index: number) => {
    const fromEnd = rows.length - 1 - index;
    return `${fromEnd % narrowStep ? "max-sm:invisible" : ""} ${fromEnd % wideStep ? "sm:invisible" : ""}`;
  };
  return (
    <div className="flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label={`${caption}: ${rows.map((row) => `${row.title}, ${row.value}`).join("; ")}`}>
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end pb-[18px]" title={`${row.title}: ${row.value}`}>
          <div className="relative w-full max-w-10 transition-[height] duration-500" style={{ height: `${Math.max(row.value > 0 ? 6 : 2, (row.value / max) * 76)}%` }}>
            <span className={`absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap text-xs tabular-nums text-ink-soft ${hidden(index)}`}>{row.value}</span>
            <div className="h-full w-full rounded-t-md rounded-b-sm" style={{ backgroundColor: row.value > 0 ? CHART.data : CHART.track }} />
          </div>
          <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs leading-tight text-ink-soft ${hidden(index)}`}>{row.label}</span>
        </div>
      ))}
    </div>
  );
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
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
  const dot = state === "registro" ? <span className={base} style={{ backgroundColor: CHART.good }} />
    : state === "sem_registro" ? <span className={`${base} border-2`} style={{ borderColor: CHART.mid, color: CHART.mid }}><Minus size={11} strokeWidth={3} /></span>
      : state === "aberto" ? <span className={`${base} border-2 border-dashed border-line`} />
        : state === "recesso" ? <span className={`${base} border border-line bg-paper`} />
          : <span className="mx-auto block size-1.5 rounded-full bg-line" />;
  return <span title={text} className="block">{dot}<span className="sr-only">{text}</span></span>;
}

// Meses × anos: verde = houve registro de aula; contorno âmbar com traço =
// mês letivo sem nenhum registro.
export function MonthGrid({ years }: { years: { year: number; months: { month: number; records: number; state: MonthState }[] }[] }) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-y-1.5 text-center">
      <caption className="sr-only">Registros de aula por mês e ano</caption>
      <thead>
        <tr>
          <th scope="col" className="w-11"><span className="sr-only">Ano</span></th>
          {MONTHS.map((month) => <th key={month} scope="col" className="pb-1 text-xs font-medium text-ink"><abbr title={month} className="no-underline">{month[0].toUpperCase()}</abbr></th>)}
        </tr>
      </thead>
      <tbody>
        {years.map(({ year, months }) => (
          <tr key={year}>
            <th scope="row" className="text-left text-xs font-normal tabular-nums text-ink-soft">{year}</th>
            {months.map((month) => <td key={month.month}><MonthDot state={month.state} records={month.records} label={`${MONTHS[month.month - 1]} de ${year}`} /></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
