import type { AreaKey } from "@/lib/assessment";

// Apoio médio por área na escala 0 (independente) a 5 (apoio físico total):
// a linha de base (círculo vazado) e a última aplicação (círculo cheio).
// O desenho é decorativo para o leitor de tela; os valores ficam no texto.
const decimal = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const position = (value: number) => `${(value / 5) * 100}%`;

export function AreaComparison({ rows }: { rows: { area: AreaKey; label: string; start: number | null; end: number | null; change: number | null }[] }) {
  const shown = rows.filter((row) => row.start !== null || row.end !== null);
  if (!shown.length) return <p className="text-sm text-ink-soft">Nenhuma área observada ainda.</p>;
  return (
    <ul className="grid min-w-0 gap-5">
      {shown.map((row) => (
        <li key={row.area} className="min-w-0">
          <p className="text-sm font-medium text-ink">{row.label}</p>
          <div aria-hidden className="relative mt-2 h-3 rounded-full bg-surface-muted">
            {row.start !== null ? <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-strong bg-white" style={{ left: position(row.start) }} /> : null}
            {row.end !== null ? <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-strong" style={{ left: position(row.end) }} /> : null}
          </div>
          <div aria-hidden className="mt-1 flex justify-between text-xs text-ink-soft"><span>Independente (0)</span><span>Mais apoio (5)</span></div>
          <p className="mt-1 text-sm text-ink-soft">
            {row.start !== null && row.end !== null && row.change !== null
              ? `Linha de base ${decimal(row.start)}, agora ${decimal(row.end)}: ${row.change > 0 ? `precisa de ${decimal(row.change)} ${row.change === 1 ? "nível" : "níveis"} de apoio a menos` : row.change < 0 ? `precisa de ${decimal(-row.change)} ${row.change === -1 ? "nível" : "níveis"} de apoio a mais` : "o apoio está igual"}.`
              : `Apoio médio: ${decimal((row.end ?? row.start) as number)}.`}
          </p>
        </li>
      ))}
    </ul>
  );
}
