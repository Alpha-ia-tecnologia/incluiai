import { RingStat } from "@/components/data-viz";
import { SIGNAL } from "@/components/charts";
import { percentOf } from "@/lib/series";

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
