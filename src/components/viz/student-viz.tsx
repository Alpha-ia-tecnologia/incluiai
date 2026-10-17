import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { HatchedDonut, Legend, SIGNAL, StackedBar, SupportScale } from "@/components/charts";
import { supportColor, withSegmentColors, type Tone } from "@/components/data-viz";
import { criterionSplit, participationSplit, percentOf, type Trend } from "@/lib/series";
import { supportInfo } from "@/lib/scale";

// Peças de visualização das páginas do estudante, no padrão do Painel de
// indicadores (src/components/data-viz.tsx). Nível de apoio: 0 (independente)
// a 5 (apoio físico total); menos apoio é avanço. Todo valor aparece também
// em texto, e nenhuma informação depende só da cor.

type LessonEntry = { date: Date | string; participation?: string; criterionMet?: string };

export const TREND_TONE: Record<Trend, Tone> = { avancando: "good", estavel: "info", atencao: "alert", sem_dados: "neutral" };

// Moldura para o SupportChart: a tabela sr-only dele não encolhe (tabela
// ignora width: 1px e overflow) e alargava a página a 320 px. A moldura vira
// o bloco de referência da tabela e corta só na horizontal; o pr-2 deixa
// inteiro o ponto do último registro, que passa da borda direita.
export function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="relative min-w-0 overflow-x-clip pr-2">{children}</div>;
}

// Medidor compacto do nível de apoio: cinco casas (nenhuma preenchida =
// independente), com o código e o nome em texto ao lado.
export function SupportMeter({ level, showName = true }: { level: number; showName?: boolean }) {
  const value = Math.round(Math.min(5, Math.max(0, level)));
  const info = supportInfo(value);
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
      <span aria-hidden className="flex w-14 shrink-0 gap-0.5">
        {[1, 2, 3, 4, 5].map((cell) => (
          <span key={cell} className={`h-2.5 flex-1 rounded-full ${cell <= value ? "hatch" : ""}`} style={{ backgroundColor: cell <= value ? supportColor(value) : SIGNAL.track }} />
        ))}
      </span>
      <span className="min-w-0 text-xs text-ink">
        <span className="font-medium">{info.code}</span>
        <span className={showName ? "text-ink-soft" : "sr-only"}> · {info.label}</span>
      </span>
    </span>
  );
}

// Sequência dos últimos níveis de apoio (do mais antigo ao mais recente).
export function SupportSteps({ levels, label }: { levels: ReadonlyArray<number>; label: string }) {
  return (
    <ol aria-label={label} className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-2">
      {levels.map((level, index) => (
        <li key={index} className="inline-flex items-center gap-1.5">
          {index ? <ArrowRight size={12} aria-hidden className="text-ink-soft" /> : null}
          <SupportMeter level={level} showName={false} />
        </li>
      ))}
    </ol>
  );
}

// Pílulas só com texto, que quebram linha em vez de cortar o nome (o
// CountChips corta com reticências, e aqui o nome é toda a informação).
export function TextChips({ items }: { items: ReadonlyArray<string> }) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5">
      {items.map((item) => <li key={item} className="max-w-full break-words rounded-full bg-signal-lime-soft px-3 py-1.5 text-xs font-medium text-ink">{item}</li>)}
    </ul>
  );
}

// Rosca da participação nas aulas, com a legenda em números.
export function ParticipationDonut({ id, entries, size = 120 }: { id: string; entries: ReadonlyArray<LessonEntry>; size?: number }) {
  const segments = withSegmentColors(participationSplit(entries));
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) return <p className="text-sm text-ink-soft">Ainda sem registro de participação.</p>;
  const full = percentOf(segments[0].value, total);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-5">
      <HatchedDonut id={id} segments={segments} size={size} thickness={Math.round(size / 7.5)} label={`Participação em ${total} ${total === 1 ? "registro" : "registros"}: ${segments.map((segment) => `${segment.label.toLowerCase()} ${segment.value}`).join(", ")}`}>
        <span className="font-display text-[26px] leading-none tracking-tight text-ink tabular-nums">{full === null ? "—" : `${full}%`}</span>
        <span className="mt-1 text-[11px] leading-tight text-ink-soft">toda a<br />atividade</span>
      </HatchedDonut>
      <div className="min-w-0 flex-1 basis-40"><Legend segments={segments} /></div>
    </div>
  );
}

// Divisão do resultado esperado (critério do objetivo) nos registros.
export function CriterionBar({ entries }: { entries: ReadonlyArray<LessonEntry> }) {
  return <StackedBar segments={withSegmentColors(criterionSplit(entries))} empty="Ainda sem registro de resultado." />;
}

const SCALE_MARKERS = [
  { label: "No início", marker: "rounded-full border-2 border-ink-strong bg-white", align: "" },
  { label: "Último registro", marker: "rounded-full bg-ink-strong", align: "text-center justify-center" },
  { label: "Meta", marker: "rotate-45 rounded-[2px] border-2 border-ink-strong bg-white", align: "text-right justify-end" },
] as const;

// Escala do apoio de um objetivo (início, último registro e meta). A escala
// é decorativa para o leitor de tela; os três valores ficam em texto abaixo.
export function ObjectiveScale({ initial, latest, target, caption }: { initial: number; latest: number; target: number; caption?: string }) {
  const values = [initial, latest, target];
  return (
    <div className="min-w-0">
      <SupportScale initial={initial} latest={latest} target={target} />
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {SCALE_MARKERS.map((item, index) => {
          const info = supportInfo(values[index]);
          return (
            <div key={item.label} className={`min-w-0 ${item.align}`}>
              <dt className={`flex items-center gap-1.5 text-xs text-ink-soft ${item.align}`}><span aria-hidden className={`inline-block size-2.5 shrink-0 ${item.marker}`} />{item.label}</dt>
              <dd className="mt-1 font-display text-xl leading-none tracking-tight text-ink">{info.code}</dd>
              <dd className="mt-1 text-[11px] leading-tight text-ink-soft">{info.label}</dd>
            </div>
          );
        })}
      </dl>
      {caption ? <p className="mt-3 text-xs leading-relaxed text-ink-soft">{caption}</p> : null}
    </div>
  );
}
