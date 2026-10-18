import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { MonthState } from "@/lib/dashboard";

// Gráficos do painel em HTML e SVG, sem biblioteca, na linguagem do painel:
// texturas listradas, sinais lima (bom), amarelo (intermediário) e laranja
// (atenção). Rótulo e valor ficam sempre em texto, e nenhuma informação
// depende só da cor. Valor zero não desenha barra.

// Mesmos valores dos tokens --signal-* em globals.css.
export const SIGNAL = {
  lime: "#c4ee4b",
  yellow: "#f4e35a",
  orange: "#f4693a",
  cyan: "#93d7e4",
  track: "#ecebe7",
  ink: "#151515",
};
const HATCH = "repeating-linear-gradient(120deg, rgb(0 0 0 / 0.1) 0 1.5px, transparent 1.5px 5px)";
const GAUGE_STOPS: [number, string][] = [[0, "#e8503a"], [0.35, "#f39a3b"], [0.6, "#f2d24c"], [0.8, "#c4ee4b"], [1, "#98db4c"]];
const SCALE_GRADIENT = `linear-gradient(90deg, ${GAUGE_STOPS.map(([at, color]) => `${color} ${at * 100}%`).join(", ")})`;

export type ChartSegment = { key: string; label: string; value: number; color: string };

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function gaugeColor(t: number): string {
  const index = Math.max(1, GAUGE_STOPS.findIndex(([at]) => at >= t));
  const [fromAt, from] = GAUGE_STOPS[index - 1];
  const [toAt, to] = GAUGE_STOPS[index];
  const local = toAt === fromAt ? 0 : (t - fromAt) / (toAt - fromAt);
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
  return `rgb(${[1, 3, 5].map((offset) => Math.round(channel(from, offset) + (channel(to, offset) - channel(from, offset)) * local)).join(" ")})`;
}

export function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="hatch inline-block h-3 w-6 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

export function BarRow({ label, value, max, detail, color = SIGNAL.lime }: {
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
      <div className="h-2.5 overflow-hidden rounded-full bg-signal-track" aria-hidden>
        <div className="hatch viz-grow-x h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%`, backgroundColor: color }} />
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

// Distribuição 100% empilhada, listrada, com legenda em texto.
export function StackedBar({ segments, empty = "Sem registros no período." }: { segments: ChartSegment[]; empty?: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <div>
      <div className="flex h-3.5 gap-1" aria-hidden>
        {segments.map((segment) => segment.value > 0 ? (
          <div key={segment.key} className="hatch viz-grow-x h-full rounded-full" style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }} />
        ) : null)}
      </div>
      <div className="mt-4"><Legend segments={segments} /></div>
    </div>
  );
}

function HatchPattern({ id, color }: { id: string; color: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <rect width="6" height="6" fill={color} />
      <rect width="1.8" height="6" fill="#000" fillOpacity="0.1" />
    </pattern>
  );
}

// Rosca listrada: trilho cinza e um arco por segmento, com o conteúdo no centro.
// Cada arco se preenche a partir do próprio início (viz-ring anima só o
// stroke-dasharray; o stroke-dashoffset que posiciona a parte fica parado). O
// giro de -90° está no <svg>, não nos arcos.
export function HatchedDonut({ id, segments, label, size = 152, thickness = 20, children }: {
  id: string;
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
  const gap = visible.length > 1 ? 4 : 0;
  const arcs = visible.map((segment, index) => ({
    segment,
    length: total ? (segment.value / total) * circumference : 0,
    start: visible.slice(0, index).reduce((sum, item) => sum + (total ? (item.value / total) * circumference : 0), 0),
  }));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={label}>
        <defs>
          <HatchPattern id={`${id}-trilho`} color={SIGNAL.track} />
          {visible.map((segment) => <HatchPattern key={segment.key} id={`${id}-${segment.key}`} color={segment.color} />)}
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${id}-trilho)`} strokeWidth={thickness} />
        {arcs.map(({ segment, length, start }) => (
          <circle
            key={segment.key}
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={`url(#${id}-${segment.key})`} strokeWidth={thickness}
            strokeDasharray={`${Math.max(length - gap, 0.5)} ${circumference}`}
            strokeDashoffset={-start}
            className="viz-ring"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// Medidor em meia-lua feito de listras em degradê (laranja → lima). As
// listras até o valor ficam cheias; as demais, apagadas. Os vãos marcam as
// faixas de 50% e 80%. Fica parado: não é um arco com traço, são listras soltas.
export function HatchedGauge({ value, label, zones = [50, 80] }: { value: number | null; label: string; zones?: number[] }) {
  const steps = 60;
  const [cx, cy, outer, inner, labelRadius] = [180, 180, 150, 114, 166];
  const point = (pct: number, radius: number) => {
    const angle = Math.PI * (1 - pct / 100);
    return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
  };
  const stripes = Array.from({ length: steps + 1 }, (_, index) => (index * 100) / steps)
    .filter((pct) => !zones.includes(Math.round(pct)));
  return (
    <svg viewBox="0 0 360 190" className="w-full" role="img" aria-label={label}>
      {stripes.map((pct) => {
        const from = point(pct, inner);
        const to = point(pct, outer);
        return (
          <line
            key={pct}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={gaugeColor(pct / 100)} strokeWidth={3.4} strokeLinecap="round"
            opacity={value !== null && pct <= value ? 1 : 0.22}
          />
        );
      })}
      {[0, ...zones, 100].map((pct) => {
        const { x, y } = point(pct, labelRadius);
        return <text key={pct} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-[var(--ink-soft)] text-xs">{pct}</text>;
      })}
    </svg>
  );
}

// Escala do nível de apoio (5 → 0), em degradê listrado. O início fica
// acima da barra, a meta abaixo e o último registro sobre ela, para os
// marcadores não se esconderem quando os valores são próximos.
export function SupportScale({ initial, latest, target }: { initial: number; latest: number; target: number }) {
  const position = (level: number) => `${((5 - Math.min(5, Math.max(0, level))) / 5) * 100}%`;
  return (
    <div className="pt-6" aria-hidden>
      <div className="relative">
        <span className="absolute bottom-[calc(100%+3px)] size-3.5 -translate-x-1/2 rounded-full border-2 border-ink-strong bg-white" style={{ left: position(initial) }} />
        <div className="h-3 rounded-full" style={{ backgroundImage: `${HATCH}, ${SCALE_GRADIENT}` }} />
        <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-ink-strong shadow-e1" style={{ left: position(latest) }} />
        <span className="absolute top-[calc(100%+4px)] size-3 -translate-x-1/2 rotate-45 rounded-[2px] border-2 border-ink-strong bg-white" style={{ left: position(target) }} />
      </div>
      <div className="mt-6 flex justify-between text-xs text-ink-soft"><span>Mais apoio (5)</span><span>Independente (0)</span></div>
    </div>
  );
}

// Colunas listradas para série temporal, com o valor acima de cada coluna.
// Valor e rótulo ficam posicionados sobre a coluna, fora da largura mínima do
// gráfico (13 semanas cabem a 320 px sem rolagem lateral). Para não se
// sobreporem, só uma coluna a cada passo mostra valor e rótulo: no máximo 6
// no celular e 13 a partir de sm (24 meses viram 6 e 12), contando a partir da
// mais recente. Todas as colunas têm o valor no title e no aria-label. Só a
// coluna cresce ao abrir; valor e rótulo já aparecem no lugar.
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
            <div className="hatch viz-grow-y h-full w-full rounded-t-lg rounded-b-sm" style={{ backgroundColor: row.value > 0 ? SIGNAL.lime : SIGNAL.track }} />
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
  const dot = state === "registro" ? <span className={`${base} border-[3px] border-[#e2f6a6] bg-signal-lime`} />
    : state === "sem_registro" ? <span className={`${base} bg-signal-orange text-ink-strong`}><X size={11} strokeWidth={3} /></span>
      : state === "aberto" ? <span className={`${base} border-2 border-dashed border-[#cfc9c0]`} />
        : state === "recesso" ? <span className={`${base} border border-line bg-paper`} />
          : <span className="mx-auto block size-1.5 rounded-full bg-line" />;
  return <span title={text} className="block">{dot}<span className="sr-only">{text}</span></span>;
}

// Meses × anos, como um histórico de pagamentos: lima = houve registro de
// aula; laranja com X = mês letivo sem nenhum registro.
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
