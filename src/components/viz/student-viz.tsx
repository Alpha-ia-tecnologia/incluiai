import type { ReactNode } from "react";
import { AlertTriangle, Minus, TrendingDown, type LucideIcon } from "lucide-react";
import type { Trend } from "@/lib/scale";
import { HatchedDonut, Legend, SIGNAL, StackedBar, SupportScale } from "@/components/charts";
import { supportColor, withSegmentColors } from "@/components/data-viz";
import { criterionSplit, participationSplit, percentOf } from "@/lib/series";
import { supportInfo } from "@/lib/scale";

type LessonEntry = { date: Date | string; participation?: string; criterionMet?: string };

export const TREND_ICON: Record<Trend, LucideIcon> = { avancando: TrendingDown, estavel: Minus, atencao: AlertTriangle, sem_dados: Minus };

// Moldura para o SupportChart: a tabela sr-only dele não encolhe (tabela
// ignora width: 1px e overflow) e alargava a página a 320 px. A moldura vira
// o bloco de referência da tabela e corta só na horizontal; o pr-2 deixa
// inteiro o ponto do último registro, que passa da borda direita.
export function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="relative min-w-0 overflow-x-clip pr-2">{children}</div>;
}

export function SupportMeter({ level, showName = true }: { level: number; showName?: boolean }) {
  const info = supportInfo(level);
  const value = info.level;
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
      <span aria-hidden className="flex w-14 shrink-0 gap-0.5">
        {[1, 2, 3, 4, 5].map((cell) => (
          <span key={cell} className={`h-2.5 flex-1 rounded-full ${cell <= value ? "hatch viz-grow-x" : ""}`} style={{ backgroundColor: cell <= value ? supportColor(value) : SIGNAL.track }} />
        ))}
      </span>
      <span className="min-w-0 text-xs text-ink">
        <span className="font-medium">{info.code}</span>
        <span className={showName ? "text-ink-soft" : "sr-only"}> · {info.label}</span>
      </span>
    </span>
  );
}

export function ParticipationDonut({ id, entries, size = 120 }: { id: string; entries: ReadonlyArray<LessonEntry>; size?: number }) {
  const segments = withSegmentColors(participationSplit(entries));
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) return <p className="text-sm text-ink-soft">Ainda sem registro de participação.</p>;
  const full = percentOf(segments[0].value, total);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-5">
      <HatchedDonut id={id} segments={segments} size={size} thickness={Math.round(size / 7.5)} label={`Participação em ${total} ${total === 1 ? "registro" : "registros"}: ${segments.map((segment) => `${segment.label.toLowerCase()} ${segment.value}`).join(", ")}`}>
        <span className="font-display font-bold text-2xl leading-none tracking-tight text-ink tabular-nums">{full === null ? "—" : `${full}%`}</span>
        <span className="mt-1 text-xs leading-tight text-ink-soft">toda a<br />atividade</span>
      </HatchedDonut>
      <div className="min-w-0 flex-1 basis-40"><Legend segments={segments} /></div>
    </div>
  );
}

export function CriterionBar({ entries }: { entries: ReadonlyArray<LessonEntry> }) {
  return <StackedBar segments={withSegmentColors(criterionSplit(entries))} empty="Ainda sem registro de resultado." />;
}

const SCALE_MARKERS = [
  { label: "No início", marker: "rounded-full border-2 border-ink-strong bg-white", align: "" },
  { label: "Último registro", marker: "rounded-full bg-ink-strong", align: "text-center justify-center" },
  { label: "Meta", marker: "rotate-45 rounded-[2px] border-2 border-ink-strong bg-white", align: "text-right justify-end" },
] as const;

export function ObjectiveScale({ initial, latest, target, caption }: { initial: number; latest: number; target: number; caption?: string }) {
  const values = [initial, latest, target];
  return (
    <div className="min-w-0">
      <SupportScale initial={initial} latest={latest} target={target} />
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {SCALE_MARKERS.map((item, index) => {
          const info = supportInfo(values[index]);
          return (
            <div key={item.label} className={`min-w-0 ${item.align}`}>
              <dt className={`flex items-center gap-1.5 text-xs text-ink-soft ${item.align}`}><span aria-hidden className={`inline-block size-2.5 shrink-0 ${item.marker}`} />{item.label}</dt>
              <dd className="mt-1 font-display text-xl leading-none tracking-tight text-ink">{info.code}</dd>
              <dd className="mt-1 text-xs leading-tight text-ink-soft">{info.label}</dd>
            </div>
          );
        })}
      </dl>
      {caption ? <p className="mt-3 text-xs leading-relaxed text-ink-soft">{caption}</p> : null}
    </div>
  );
}
