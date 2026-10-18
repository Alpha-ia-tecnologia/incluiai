import { Swatch } from "@/components/charts";

// Colunas empilhadas e listradas (ex.: atendimentos do mês por situação), no
// padrão do Painel de indicadores. O total fica acima de cada coluna, a
// legenda nomeia as partes com o total do período e a tabela oculta dá cada
// número ao leitor de tela: o desenho nunca é a única forma de ler o dado.
// Parte com zero não é desenhada; período todo vazio vira texto.

export type StackSeries = { key: string; label: string; color: string };
export type StackRow = { label: string; title: string; counts: Readonly<Record<string, number>> };

const sumOf = (row: StackRow, series: ReadonlyArray<StackSeries>) => series.reduce((sum, item) => sum + (row.counts[item.key] ?? 0), 0);

export function StackedColumns({ rows, series, caption, empty = "Sem registros no período." }: {
  rows: ReadonlyArray<StackRow>;
  series: ReadonlyArray<StackSeries>;
  caption: string;
  empty?: string;
}) {
  const totals = rows.map((row) => sumOf(row, series));
  const max = Math.max(0, ...totals);
  if (max === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  const describe = (row: StackRow) => series.map((item) => `${item.label.toLowerCase()}: ${row.counts[item.key] ?? 0}`).join(", ");
  return (
    <figure aria-label={caption} className="min-w-0">
      <div aria-hidden className="flex h-44 min-w-0 items-stretch gap-1.5 sm:gap-3">
        {rows.map((row, index) => {
          const total = totals[index];
          return (
            <div key={`${row.title}-${index}`} title={`${row.title}: ${describe(row)}`} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-xs tabular-nums text-ink-soft">{total}</span>
                {total > 0 ? (
                  // 78% no máximo: o total acima da coluna mais alta continua visível.
                  // A pilha inteira cresce uma vez; o total acima já aparece no lugar.
                  <div className="viz-grow-y flex w-full max-w-10 flex-col-reverse gap-[2px]" style={{ height: `${Math.max(8, (total / max) * 78)}%` }}>
                    {series.map((item) => {
                      const value = row.counts[item.key] ?? 0;
                      return value > 0 ? <div key={item.key} className="hatch min-h-[4px] w-full rounded-[4px] border border-black/5" style={{ flex: `${value} 1 0`, backgroundColor: item.color }} /> : null;
                    })}
                  </div>
                ) : <div className="h-[3px] w-full max-w-10 rounded-full bg-signal-track" />}
              </div>
              <span className="mt-1.5 text-xs leading-tight text-ink-soft">{row.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <ul aria-label={`${caption}: total do período`} className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink">
          {series.map((item) => (
            <li key={item.key} className="inline-flex items-center gap-1.5">
              <Swatch color={item.color} />
              {item.label}
              <span className="tabular-nums text-ink-soft">{rows.reduce((sum, row) => sum + (row.counts[item.key] ?? 0), 0)}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* O bloco sr-only em volta impede que a tabela alargue a página a 320px. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr><th scope="col">Período</th>{series.map((item) => <th key={item.key} scope="col">{item.label}</th>)}<th scope="col">Total</th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.title}-${index}`}>
                <th scope="row">{row.title}</th>
                {series.map((item) => <td key={item.key}>{row.counts[item.key] ?? 0}</td>)}
                <td>{totals[index]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
