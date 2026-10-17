import type { ReactNode } from "react";

// Linha do tempo vertical (conquistas, relatórios), com o mesmo traço
// tracejado dos capítulos da jornada. Cada item tem a data em texto; o
// marcador é decorativo e o estado, quando houver, vem escrito em `badge`.

export type TimelineItem = {
  key: string;
  date: string;
  title: ReactNode;
  body?: ReactNode;
  badge?: ReactNode;
  marker: ReactNode;
  markerClassName?: string;
};

export function Timeline({ items, label }: { items: ReadonlyArray<TimelineItem>; label: string }) {
  return (
    <ol aria-label={label} className="min-w-0">
      {items.map((item, index) => (
        <li key={item.key} className="relative flex min-w-0 gap-3 pb-5 last:pb-0">
          {index < items.length - 1 ? <span aria-hidden className="absolute bottom-0 left-[17px] top-10 border-l-2 border-dashed border-line" /> : null}
          <span aria-hidden className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ${item.markerClassName ?? "bg-surface-muted text-ink-soft"}`}>{item.marker}</span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="text-xs tabular-nums text-ink-soft">{item.date}</p>
              {item.badge}
            </div>
            <div className="mt-0.5 break-words text-sm font-medium leading-snug text-ink">{item.title}</div>
            {item.body ? <div className="mt-1 min-w-0 break-words text-sm leading-relaxed text-ink-soft">{item.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
