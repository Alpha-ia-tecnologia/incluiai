import { SIGNAL } from "@/components/charts";
import { supportInfo } from "@/lib/scale";

// Trilha do apoio de um objetivo, de "mais apoio" (5) a "independente" (0).
// O círculo escuro marca o apoio atual (o registrado no plano) e o losango, a
// meta; as casas entre os dois são o caminho que falta. Os dois níveis vêm
// escritos com o nome, então o desenho só reforça o texto. Menos apoio é avanço.

const LEVELS = [5, 4, 3, 2, 1, 0];
const center = (level: number) => `${((5 - level + 0.5) / 6) * 100}%`;

export function SupportTrack({ current, target }: { current: number; target: number }) {
  const today = Math.min(5, Math.max(0, Math.round(current)));
  const goal = Math.min(5, Math.max(0, Math.round(target)));
  const reached = today <= goal;
  return (
    <div className="min-w-0">
      <div aria-hidden className="relative pb-1 pt-1">
        <div className="grid grid-cols-6 gap-[2px]">
          {LEVELS.map((level) => {
            const onPath = !reached && level < today && level >= goal;
            return <span key={level} className={`h-3 rounded-[4px] ${onPath ? "hatch viz-grow-x" : ""}`} style={{ backgroundColor: onPath ? "var(--signal-lime-soft)" : SIGNAL.track }} />;
          })}
        </div>
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-ink-strong shadow-e1" style={{ left: center(today) }} />
        {!reached ? <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-ink-strong bg-white" style={{ left: center(goal) }} /> : null}
      </div>
      <div aria-hidden className="mt-1 flex justify-between text-xs text-ink-soft"><span>Mais apoio</span><span>Independente</span></div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-ink-strong" /> Apoio atual: {supportInfo(today).label}</span>
        {reached ? <span className="text-ink-soft">O apoio atual já está na meta do plano.</span>
          : <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rotate-45 rounded-[2px] border-2 border-ink-strong" /> Meta: {supportInfo(goal).label}</span>}
      </p>
    </div>
  );
}
