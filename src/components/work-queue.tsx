import Link from "next/link";
import { ArrowRight, ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import { QUEUE_VISIBLE, type Queue, type QueueItem } from "@/lib/work-queue-core";

export function WorkQueue({ queue }: { queue: Queue }) {
  if (!queue.recent.length && !queue.due.length) {
    return (
      <p data-queue="em-dia" className="mt-8 flex items-center gap-2 text-base text-ink">
        <CircleCheck size={18} aria-hidden className="shrink-0 text-brand" /> Tudo em dia.
      </p>
    );
  }
  return (
    <>
      <QueueSection id="desde-ontem" title="Desde ontem" items={queue.recent} />
      <QueueSection id="vence-em-breve" title="Vence em breve" items={queue.due} />
    </>
  );
}

function QueueSection({ id, title, items }: { id: string; title: string; items: QueueItem[] }) {
  if (!items.length) return null;
  const rest = items.slice(QUEUE_VISIBLE);
  return (
    <section aria-labelledby={`${id}-titulo`} data-queue={id} className="mt-8">
      <h2 id={`${id}-titulo`} className="mb-3 text-xl font-medium">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised">
        <QueueList items={items.slice(0, QUEUE_VISIBLE)} />
        {rest.length ? (
          <details className="group border-t border-line">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-brand-strong focus-visible:outline-offset-[-3px]! sm:px-5 [&::-webkit-details-marker]:hidden">
              <ChevronDown size={16} aria-hidden className="shrink-0 group-open:rotate-180 motion-safe:transition-transform" />
              <span className="group-open:hidden">Mostrar mais {rest.length}</span>
              <span className="hidden group-open:inline">Mostrar menos</span>
            </summary>
            <QueueList items={rest} className="border-t border-line" />
          </details>
        ) : null}
      </div>
    </section>
  );
}

function QueueList({ items, className = "" }: { items: QueueItem[]; className?: string }) {
  return (
    <ul className={`divide-y divide-line ${className}`}>
      {items.map((item) => <li key={item.key}><QueueRow item={item} /></li>)}
    </ul>
  );
}

const ROW_LAYOUT = {
  data: { grid: "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]", text: "col-start-1 row-start-2 sm:col-start-2 sm:row-start-1", arrow: "col-start-2 row-span-2 sm:col-start-3 sm:row-span-1" },
  numero: { grid: "grid-cols-[4rem_minmax(0,1fr)_auto]", text: "col-start-2 row-start-1", arrow: "col-start-3" },
};

function QueueRow({ item }: { item: QueueItem }) {
  const layout = ROW_LAYOUT[item.count === null ? "data" : "numero"];
  const marker = item.crossed ? "bg-coral-soft text-coral" : "bg-surface-muted text-ink-soft";
  return (
    <Link
      href={item.href}
      data-queue-kind={item.kind}
      data-crossed={item.crossed ? "" : undefined}
      className={`group grid min-h-16 items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-brand-soft/60 focus-visible:outline-offset-[-3px]! sm:px-5 ${layout.grid}`}
    >
      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 justify-self-start rounded-full px-2.5 py-1 font-medium tabular-nums ${item.count === null ? "text-xs" : "text-sm"} ${marker}`}>
        {item.crossed ? <CircleAlert size={13} aria-hidden className="shrink-0" /> : null}
        {item.count ?? item.when}
      </span>
      <span className={`min-w-0 ${layout.text}`}>
        <span className="block text-base font-medium leading-snug text-ink">{item.title}</span>
        {item.subject || item.detail ? (
          <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-ink-soft">
            {item.subject ? <span className="text-ink">{item.subject}</span> : null}
            {item.subject && item.detail ? " · " : null}
            {item.detail}
          </span>
        ) : null}
      </span>
      <ArrowRight size={18} aria-hidden className={`row-start-1 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-brand-strong motion-reduce:transition-none ${layout.arrow}`} />
    </Link>
  );
}
