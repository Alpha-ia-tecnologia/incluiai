import { supportInfo } from "@/lib/scale";
import { SCALE_MARKER, SupportScale } from "@/components/viz/student-viz";

const MARKERS = [
  { label: "No início", marker: SCALE_MARKER.initial, align: "" },
  { label: "Último registro", marker: SCALE_MARKER.latest, align: "text-center justify-center" },
  { label: "Meta", marker: SCALE_MARKER.target, align: "text-right justify-end" },
] as const;

export function ObjectiveScale({ initial, latest, target, caption }: { initial: number; latest: number; target: number; caption?: string }) {
  const values = [initial, latest, target];
  return (
    <div className="min-w-0">
      <SupportScale initial={initial} latest={latest} target={target} />
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {MARKERS.map((item, index) => {
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
      {caption ? <p className="mt-3 text-sm leading-relaxed text-ink-soft">{caption}</p> : null}
    </div>
  );
}
