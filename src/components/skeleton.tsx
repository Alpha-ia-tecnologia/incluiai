// Carregando: o formato da tela que vai abrir aparece na hora, em cinza, com um
// pulso lento (parado para quem pede menos movimento). Nada de números inventados.
// Leitores de tela ouvem só "Carregando…".

export function SkeletonLine({ className = "w-full" }: { className?: string }) {
  return <span className={`skeleton-line skeleton-pulse ${className}`} />;
}

export function SkeletonCard({ lines = 3, tall = false, className = "" }: { lines?: number; tall?: boolean; className?: string }) {
  return (
    <div className={`grid content-start gap-3 rounded-2xl bg-paper-raised p-5 ${tall ? "min-h-56" : ""} ${className}`}>
      <SkeletonLine className="w-2/5" />
      <span className="skeleton-line skeleton-pulse h-8 w-1/4 rounded-lg" />
      {Array.from({ length: Math.max(0, lines - 2) }, (_, index) => <SkeletonLine key={index} className={index % 2 ? "w-3/5" : "w-11/12"} />)}
    </div>
  );
}

// Quadro cinza com cartões claros, como os quadros de dados da plataforma.
export function SkeletonBoard({ cards = 3, className = "" }: { cards?: number; className?: string }) {
  return (
    <div className={`grid gap-3 rounded-3xl bg-surface-muted p-3.5 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {Array.from({ length: cards }, (_, index) => <SkeletonCard key={index} lines={index === 0 ? 4 : 3} />)}
    </div>
  );
}

// Tela inteira carregando. kind = o formato da área: "page" (título e quadro),
// "hero" (faixa azul-clara, quadro) ou "tab" (só o conteúdo de uma aba).
export function LoadingScreen({ label = "Carregando a página", kind = "page" }: { label?: string; kind?: "page" | "hero" | "tab" }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true" className="grid gap-6">
        {kind === "hero" ? (
          <div className="grid gap-3 rounded-3xl bg-brand-soft/70 p-6 sm:p-8">
            <span className="skeleton-line skeleton-pulse h-9 w-3/5 max-w-md rounded-lg bg-paper-raised/70" />
            <span className="skeleton-line skeleton-pulse w-4/5 max-w-xl bg-paper-raised/70" />
            <span className="skeleton-line skeleton-pulse w-2/3 max-w-lg bg-paper-raised/70" />
          </div>
        ) : (
          <div className="grid gap-3">
            <span className={`skeleton-line skeleton-pulse rounded-lg ${kind === "tab" ? "h-7 w-2/5" : "h-10 w-1/2"} max-w-md`} />
            <SkeletonLine className="w-3/4 max-w-xl" />
          </div>
        )}
        <SkeletonBoard />
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard lines={4} className="border border-line" />
          <SkeletonCard lines={4} className="border border-line" />
        </div>
      </div>
    </div>
  );
}
