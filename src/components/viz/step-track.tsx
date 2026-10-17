import { SIGNAL } from "@/components/charts";

// Linha compacta de etapas (ex.: as 5 etapas do acompanhamento do estudante).
// Etapa feita = cheia e listrada; etapa atual = contorno escuro; as demais =
// trilho. A textura e o contorno separam os estados além da cor, e o texto
// "Etapa N de 5" diz a posição sem depender do desenho.

export type StepItem = { label: string; done: boolean };

export function StepTrack({ steps, current, note }: { steps: ReadonlyArray<StepItem>; current: number; note?: string }) {
  const here = steps[current - 1];
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="font-medium text-ink">Etapa {current} de {steps.length}</span>
        <span className="min-w-0 text-ink-soft">{note ?? here?.label}</span>
      </p>
      <ol className="mt-1.5 flex gap-1" aria-label="Etapas do acompanhamento">
        {steps.map((step, index) => {
          const isCurrent = index + 1 === current;
          const state = step.done ? "feita" : isCurrent ? "etapa atual" : "ainda não feita";
          return (
            <li
              key={step.label}
              title={`${index + 1}. ${step.label}: ${state}`}
              className={`h-2.5 min-w-0 flex-1 rounded-full ${step.done ? "hatch" : ""} ${isCurrent ? "ring-2 ring-ink-strong ring-offset-1 ring-offset-paper-raised" : ""}`}
              style={{ backgroundColor: step.done ? SIGNAL.lime : isCurrent ? "var(--signal-lime-soft)" : SIGNAL.track }}
            >
              <span className="sr-only">{index + 1}. {step.label}: {state}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
