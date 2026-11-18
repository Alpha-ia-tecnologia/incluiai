import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import { MONTH_NAMES } from "@/lib/dates";
import type { MonthState } from "@/lib/dashboard";
import type { Tone } from "@/lib/scale";
import { StatusPill, rampColor } from "@/components/viz/charts";

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
            style={{ stroke: rampColor(pct / 100) }} strokeWidth={3.4} strokeLinecap="round"
            opacity={value !== null && pct <= value ? 1 : 0.22}
          />
        );
      })}
      {[0, ...zones, 100].map((pct) => {
        const { x, y } = point(pct, labelRadius);
        return <text key={pct} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-surface-ink-soft text-xs">{pct}</text>;
      })}
    </svg>
  );
}

export function TrendBadge({ delta, better, text }: { delta: number; better: "up" | "down"; text: string }) {
  const good = delta === 0 ? null : (delta < 0) === (better === "down");
  const Icon = delta === 0 ? Minus : delta < 0 ? ArrowDownRight : ArrowUpRight;
  const tone: Tone = good === null ? "neutral" : good ? "good" : "alert";
  return <StatusPill tone={tone}><Icon size={12} aria-hidden /> {text}</StatusPill>;
}

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
