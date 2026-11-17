import { SIGNAL } from "@/components/charts";

export function UsageMeter({ value, max, color = SIGNAL.brand, track = "bg-signal-track", className = "" }: {
  value: number;
  max: number;
  color?: string;
  track?: string;
  className?: string;
}) {
  const width = value > 0 && max > 0 ? Math.max(4, Math.round((Math.min(value, max) / max) * 100)) : 0;
  return (
    <span aria-hidden className={`block h-2 min-w-0 overflow-hidden rounded-full ${track} ${className}`}>
      <span className="hatch viz-grow-x block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
    </span>
  );
}
