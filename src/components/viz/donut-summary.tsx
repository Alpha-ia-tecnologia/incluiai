import type { ReactNode } from "react";
import { HatchedDonut, Legend, type ChartSegment } from "@/components/charts";

// Rosca listrada com o total no centro e a legenda ao lado (cada parte com
// número e percentual em texto), no padrão do Painel de indicadores. O rótulo
// da rosca repete as partes para o leitor de tela. Sem nenhum valor, não há
// base para percentual: mostra só o texto de vazio, nunca uma rosca com 0%.

export function DonutSummary({ id, segments, label, caption, center, empty, size = 128 }: {
  id: string;
  segments: ChartSegment[];
  label: string;
  caption?: string;
  center?: ReactNode;
  empty: string;
  size?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-5">
      <HatchedDonut id={id} segments={segments} label={`${label}: ${segments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`} size={size} thickness={Math.round(size / 7.5)}>
        <span className="font-display text-3xl leading-none tracking-tight text-ink tabular-nums">{center ?? total}</span>
        {caption ? <span className="mt-1 text-xs leading-tight text-ink-soft">{caption}</span> : null}
      </HatchedDonut>
      <div className="min-w-0 flex-1 basis-40"><Legend segments={segments} /></div>
    </div>
  );
}
