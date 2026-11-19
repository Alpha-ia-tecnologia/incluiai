import { plural } from "@/lib/format";
import { supportInfo, supportOffset } from "@/lib/scale";
import { criterionSplit, participationSplit, percentOf } from "@/lib/series";
import { DonutSummary, SIGNAL, StackedBar, withSegmentColors } from "./charts";

type LessonEntry = { date: Date | string; participation?: string; criterionMet?: string };

export function SupportCells({ level, className }: { level: number; className: string }) {
  const value = supportInfo(level).level;
  return (
    <span aria-hidden className={className}>
      {[1, 2, 3, 4, 5].map((cell) => (
        <span key={cell} className={`h-2.5 flex-1 rounded-full ${cell <= value ? "hatch viz-grow-x" : ""}`} style={{ backgroundColor: cell <= value ? SIGNAL.brand : SIGNAL.track }} />
      ))}
    </span>
  );
}

export function SupportMeter({ level, showName = true }: { level: number; showName?: boolean }) {
  const info = supportInfo(level);
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
      <SupportCells level={level} className="flex w-14 shrink-0 gap-0.5" />
      <span className="min-w-0 text-sm text-ink">
        <span className="font-medium">{info.code}</span>
        <span className={showName ? "text-ink-soft" : "sr-only"}> · {info.label}</span>
      </span>
    </span>
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
        <div className="hatch h-3 rounded-full bg-signal-track" />
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
