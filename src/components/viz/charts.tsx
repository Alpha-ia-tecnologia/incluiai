import type { ReactNode } from "react";
import type { Term, Tone } from "@/lib/scale";
import { percentOf } from "@/lib/series";

export const SIGNAL = {
  brand: "var(--brand)",
  lime: "var(--signal-lime)",
  yellow: "var(--signal-yellow)",
  orange: "var(--signal-orange)",
  cyan: "var(--accent-sky)",
  track: "var(--signal-track)",
  ink: "var(--ink-strong)",
};

export const TONE_COLOR: Record<Tone, string> = { good: SIGNAL.lime, mid: SIGNAL.yellow, alert: SIGNAL.orange, neutral: SIGNAL.track, info: SIGNAL.cyan };
export const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-signal-lime text-ink-strong",
  mid: "bg-signal-yellow text-ink-strong",
  alert: "bg-signal-orange text-ink-strong",
  neutral: "bg-signal-track text-ink-soft",
  info: "bg-accent-sky text-ink-strong",
};

export type ChartSegment = { key: string; label: string; value: number; color: string };

export const withSegmentColors = (rows: ReadonlyArray<{ key: string; label: string; value: number; tone: Tone }>): ChartSegment[] =>
  rows.map((row) => ({ key: row.key, label: row.label, value: row.value, color: TONE_COLOR[row.tone] }));
export const segmentsOf = (table: Readonly<Record<string, Term>>, count: (key: string) => number): ChartSegment[] =>
  Object.entries(table).map(([key, term]) => ({ key, label: term.label, value: count(key), color: TONE_COLOR[term.tone] }));

const totalOf = (segments: ReadonlyArray<ChartSegment>) => segments.reduce((sum, segment) => sum + segment.value, 0);

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`status-pill inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}>{children}</span>;
}

export function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="hatch inline-block h-3 w-6 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

export function Legend({ segments }: { segments: ChartSegment[] }) {
  const total = totalOf(segments);
  return (
    <ul className="space-y-2">
      {segments.map((segment) => (
        <li key={segment.key} className="flex items-center gap-2.5 text-sm text-ink">
          <Swatch color={segment.color} />
          <span className="flex-1">{segment.label}</span>
          <span className="text-xs tabular-nums text-ink-soft">{segment.value} · {percentOf(segment.value, total) ?? 0}%</span>
        </li>
      ))}
    </ul>
  );
}

export function Meter({ value, max, color = SIGNAL.brand, track = "bg-signal-track", thick = false, className = "" }: {
  value: number;
  max: number;
  color?: string;
  track?: string;
  thick?: boolean;
  className?: string;
}) {
  const width = value > 0 && max > 0 ? Math.max(6, Math.round((Math.min(value, max) / max) * 100)) : 0;
  return (
    <span aria-hidden className={`block ${thick ? "h-2.5" : "h-2"} min-w-0 overflow-hidden rounded-full ${track} ${className}`}>
      <span className="hatch viz-grow-x block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
    </span>
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
      {rows.map((row) => (
        <li key={row.key ?? row.label} className="text-sm">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-ink">{row.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-ink-soft">{row.value}{row.detail ? ` · ${row.detail}` : ""}</span>
          </div>
          <Meter value={row.value} max={top} color={color} thick />
        </li>
      ))}
    </ul>
  );
}

export function StackedBar({ segments, empty = "Sem registros no período." }: { segments: ChartSegment[]; empty?: string }) {
  const total = totalOf(segments);
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
  const total = totalOf(visible);
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

export function DonutSummary({ id, segments, label, caption, center, empty, size = 128 }: {
  id: string;
  segments: ChartSegment[];
  label: string;
  caption?: ReactNode;
  center?: ReactNode;
  empty: string;
  size?: number;
}) {
  const total = totalOf(segments);
  if (!total) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-5">
      <HatchedDonut id={id} segments={segments} label={`${label}: ${segments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`} size={size} thickness={Math.round(size / 7.5)}>
        <span className={`font-display font-bold ${size >= 128 ? "text-3xl" : "text-2xl"} leading-none tracking-tight text-ink tabular-nums`}>{center ?? total}</span>
        {caption ? <span className="mt-1 text-xs leading-tight text-ink-soft">{caption}</span> : null}
      </HatchedDonut>
      <div className="min-w-0 flex-1 basis-40"><Legend segments={segments} /></div>
    </div>
  );
}

export function RingStat({ id, value, label, size = 112, color = SIGNAL.brand, children }: { id: string; value: number | null; label: string; size?: number; color?: string; children?: ReactNode }) {
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <HatchedDonut id={id} size={size} thickness={Math.round(size / 8)} label={value === null ? `${label}: sem base para cálculo` : `${label}: ${pct}%`} segments={[{ key: "feito", label, value: pct, color }, { key: "falta", label: "restante", value: 100 - pct, color: SIGNAL.track }]}>
      {children ?? <span className="font-display font-bold text-2xl leading-none text-ink tabular-nums">{value === null ? "—" : `${pct}%`}</span>}
    </HatchedDonut>
  );
}

export function ShareRing({ id, part, whole, label, caption, color = SIGNAL.brand, size = 56 }: {
  id: string;
  part: number;
  whole: number;
  label: string;
  caption: string;
  color?: string;
  size?: number;
}) {
  const pct = percentOf(part, whole);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <RingStat id={id} value={pct} label={label} size={size} color={color}>
        <span aria-hidden className="text-xs font-medium tabular-nums text-ink">{pct === null ? "—" : `${pct}%`}</span>
      </RingStat>
      <p className="min-w-0 text-xs leading-relaxed text-ink-soft">{pct === null ? "Sem base para calcular o percentual." : caption}</p>
    </div>
  );
}

type Column = { label: string; title: string; value: number };

export function ColumnChart({ rows, label, compact = false }: { rows: ReadonlyArray<Column>; label: string; compact?: boolean }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const summary = `${label}: ${rows.map((row) => `${row.title}, ${row.value}`).join("; ")}`;
  const fill = (row: Column) => (row.value > 0 ? SIGNAL.brand : SIGNAL.track);
  if (compact) {
    return (
      <div className="min-w-0">
        <div className="flex h-14 items-end gap-1" role="img" aria-label={summary}>
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`} title={`${row.title}: ${row.value}`} className="hatch viz-grow-y min-w-0 flex-1 rounded-t-md rounded-b-sm" style={{ height: `${Math.max(row.value > 0 ? 12 : 6, (row.value / max) * 100)}%`, backgroundColor: fill(row) }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-soft" aria-hidden><span>{rows[0]?.label}</span><span>{rows.at(-1)?.label}</span></div>
      </div>
    );
  }
  const narrowStep = Math.ceil(rows.length / 6);
  const wideStep = Math.ceil(rows.length / 13);
  const hidden = (index: number) => {
    const fromEnd = rows.length - 1 - index;
    return `${fromEnd % narrowStep ? "max-sm:invisible" : ""} ${fromEnd % wideStep ? "sm:invisible" : ""}`;
  };
  return (
    <div className="flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label={summary}>
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end pb-[18px]" title={`${row.title}: ${row.value}`}>
          <div className="relative w-full max-w-10 transition-[height] duration-500" style={{ height: `${Math.max(row.value > 0 ? 6 : 2, (row.value / max) * 76)}%` }}>
            <span className={`absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap text-xs tabular-nums text-ink-soft ${hidden(index)}`}>{row.value}</span>
            <div className="hatch viz-grow-y h-full w-full rounded-t-lg rounded-b-sm" style={{ backgroundColor: fill(row) }} />
          </div>
          <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs leading-tight text-ink-soft ${hidden(index)}`}>{row.label}</span>
        </div>
      ))}
    </div>
  );
}

export type StackSeries = { key: string; label: string; color: string };
export type StackRow = { label: string; title: string; counts: Readonly<Record<string, number>> };

const stackSum = (row: StackRow, series: ReadonlyArray<StackSeries>) => series.reduce((sum, item) => sum + (row.counts[item.key] ?? 0), 0);

export function StackedColumns({ rows, series, label, empty = "Sem registros no período." }: {
  rows: ReadonlyArray<StackRow>;
  series: ReadonlyArray<StackSeries>;
  label: string;
  empty?: string;
}) {
  const totals = rows.map((row) => stackSum(row, series));
  const max = Math.max(0, ...totals);
  if (max === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  const describe = (row: StackRow) => series.map((item) => `${item.label.toLowerCase()}: ${row.counts[item.key] ?? 0}`).join(", ");
  return (
    <figure aria-label={label} className="min-w-0">
      <div aria-hidden className="flex h-44 min-w-0 items-stretch gap-1.5 sm:gap-3">
        {rows.map((row, index) => {
          const total = totals[index];
          return (
            <div key={`${row.title}-${index}`} title={`${row.title}: ${describe(row)}`} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-xs tabular-nums text-ink-soft">{total}</span>
                {total > 0 ? (
                  <div className="viz-grow-y flex w-full max-w-10 flex-col-reverse gap-[2px]" style={{ height: `${Math.max(8, (total / max) * 78)}%` }}>
                    {series.map((item) => {
                      const value = row.counts[item.key] ?? 0;
                      return value > 0 ? <div key={item.key} className="hatch min-h-[4px] w-full rounded-[4px] border border-black/5" style={{ flex: `${value} 1 0`, backgroundColor: item.color }} /> : null;
                    })}
                  </div>
                ) : <div className="h-[3px] w-full max-w-10 rounded-full bg-signal-track" />}
              </div>
              <span className="mt-1.5 text-xs leading-tight text-ink-soft">{row.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <ul aria-label={`${label}: total do período`} className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink">
          {series.map((item) => (
            <li key={item.key} className="inline-flex items-center gap-1.5">
              <Swatch color={item.color} />
              {item.label}
              <span className="tabular-nums text-ink-soft">{rows.reduce((sum, row) => sum + (row.counts[item.key] ?? 0), 0)}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* O bloco sr-only em volta impede que a tabela alargue a página a 320px. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr><th scope="col">Período</th>{series.map((item) => <th key={item.key} scope="col">{item.label}</th>)}<th scope="col">Total</th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.title}-${index}`}>
                <th scope="row">{row.title}</th>
                {series.map((item) => <td key={item.key}>{row.counts[item.key] ?? 0}</td>)}
                <td>{totals[index]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// Com non-scaling-stroke, o viz-draw (tracejado) cortava a linha no meio.
export function Sparkline({ values, label, domain, invert = false, color = SIGNAL.ink, height = 36 }: { values: ReadonlyArray<number>; label: string; domain?: [number, number]; invert?: boolean; color?: string; height?: number }) {
  if (values.length < 2) return <p className="text-xs text-ink-soft">Poucos registros para a linha.</p>;
  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  const span = max - min || 1;
  const x = (index: number) => (index / (values.length - 1)) * 100;
  const y = (value: number) => {
    const t = (value - min) / span;
    return (invert ? t : 1 - t) * 90 + 5;
  };
  const line = values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={label}>
        <path d={`${line} L100,100 L0,100 Z`} fill="var(--brand-soft)" className="viz-grow-y" />
        <path d={line} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="viz-wipe" />
      </svg>
      <span aria-hidden className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-e1" style={{ left: "100%", top: `${y(last)}%`, backgroundColor: color }} />
    </div>
  );
}

export function DotStrip({ items, label, legend }: { items: ReadonlyArray<{ key: string; title: string; tone: Tone }>; label: string; legend?: ReadonlyArray<{ tone: Tone; label: string }> }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <ol className="flex flex-wrap gap-1.5" aria-label={label}>
        {items.map((item) => (
          <li key={item.key} title={item.title} className="size-4 rounded-[5px] border border-black/5 hatch" style={{ backgroundColor: TONE_COLOR[item.tone] }}>
            <span className="sr-only">{item.title}</span>
          </li>
        ))}
      </ol>
      {legend ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft" aria-hidden>
          {legend.map((item) => <li key={item.label} className="inline-flex items-center gap-1.5"><span className="hatch size-2.5 rounded-[3px]" style={{ backgroundColor: TONE_COLOR[item.tone] }} />{item.label}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

export function CountChips({ items, tone = "good", unit = "x" }: { items: ReadonlyArray<{ label: string; value?: number }>; tone?: Tone; unit?: string }) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item.label} className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${tone === "good" ? "bg-signal-lime-soft text-ink" : "bg-surface-muted text-ink"}`}>
          <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
          {typeof item.value === "number" ? <span className="rounded-full bg-paper-raised px-1.5 text-xs tabular-nums text-ink-soft">{item.value}{unit}</span> : null}
        </li>
      ))}
    </ul>
  );
}
