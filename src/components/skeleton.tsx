function SkeletonLine({ className = "w-full" }: { className?: string }) {
  return <span className={`skeleton-line skeleton-pulse ${className}`} />;
}

function SkeletonCard({ lines = 3, tall = false, className = "" }: { lines?: number; tall?: boolean; className?: string }) {
  return (
    <div className={`grid content-start gap-3 rounded-2xl bg-paper-raised p-5 ${tall ? "min-h-56" : ""} ${className}`}>
      <SkeletonLine className="w-2/5" />
      <span className="skeleton-line skeleton-pulse h-8 w-1/4 rounded-lg" />
      {Array.from({ length: Math.max(0, lines - 2) }, (_, index) => <SkeletonLine key={index} className={index % 2 ? "w-3/5" : "w-11/12"} />)}
    </div>
  );
}

function SkeletonBoard({ cards = 3, className = "" }: { cards?: number; className?: string }) {
  return (
    <div className={`grid gap-3 rounded-3xl bg-surface-muted p-3.5 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {Array.from({ length: cards }, (_, index) => <SkeletonCard key={index} lines={index === 0 ? 4 : 3} />)}
    </div>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true" className="grid gap-6">
        <div className="grid gap-3 rounded-3xl bg-navy p-6 sm:p-8">
          <span className="skeleton-line skeleton-pulse h-9 w-3/5 max-w-md rounded-lg bg-navy-line" />
          <span className="skeleton-line skeleton-pulse w-4/5 max-w-xl bg-navy-line" />
          <span className="skeleton-line skeleton-pulse w-2/3 max-w-lg bg-navy-line" />
        </div>
        <SkeletonBoard />
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard lines={4} className="border border-line" />
          <SkeletonCard lines={4} className="border border-line" />
        </div>
      </div>
    </div>
  );
}
