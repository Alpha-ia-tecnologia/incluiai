import { supportInfo } from "@/lib/scale";
import { SupportCells } from "@/components/viz/student-viz";

export function SupportBars({ rows }: { rows: ReadonlyArray<{ label: string; level: number }> }) {
  return (
    <ul className="grid min-w-0 gap-2.5">
      {rows.map((row) => {
        const info = supportInfo(row.level);
        return (
          <li key={row.label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto]">
            <span className="min-w-0 text-ink">{row.label}</span>
            <SupportCells level={row.level} className="col-span-2 row-start-2 flex gap-1 sm:col-span-1 sm:row-start-auto lg:col-span-2 lg:row-start-2" />
            <span className="text-right text-xs tabular-nums text-ink-soft"><span className="font-medium text-ink">{info.code}</span><span className="max-sm:sr-only"> · {info.label}</span></span>
          </li>
        );
      })}
    </ul>
  );
}
