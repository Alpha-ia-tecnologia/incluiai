import { Check } from "lucide-react";

// Linha do tempo de versões em etapas, da mais antiga à mais recente: na
// horizontal a partir de sm e na vertical no celular (sem rolagem lateral a
// 320 px). Estado e datas vêm sempre escritos; o marcador só reforça o texto:
// validada = cheia e listrada com ✓, em revisão = contorno amarelo com o
// número, rascunho = contorno tracejado com o número. Cada etapa leva ao
// cartão da versão (alvo de 44 px).

export type VersionStep = {
  version: number;
  href: string;
  kind: "validado" | "em_revisao" | "rascunho";
  stateLabel: string;
  dates: ReadonlyArray<string>;
  current: boolean;
};

const MARKER: Record<VersionStep["kind"], string> = {
  validado: "hatch bg-signal-lime text-ink-strong",
  em_revisao: "border-2 border-signal-yellow bg-signal-yellow-soft text-ink-strong",
  rascunho: "border-2 border-dashed border-line bg-paper-raised text-ink-soft",
};

export function VersionSteps({ steps, label }: { steps: ReadonlyArray<VersionStep>; label: string }) {
  if (!steps.length) return null;
  return (
    <div className="min-w-0 sm:overflow-x-auto">
      <ol aria-label={label} className="grid min-w-0 gap-3 sm:auto-cols-[minmax(8.5rem,1fr)] sm:grid-flow-col sm:gap-0">
        {steps.map((step, index) => {
          const last = index === steps.length - 1;
          return (
            <li key={step.version} aria-current={step.current ? "step" : undefined} className="relative min-w-0">
              {!last ? (
                <>
                  <span aria-hidden className="absolute -bottom-3 left-[21px] top-[42px] border-l-2 border-dashed border-line sm:hidden" />
                  <span aria-hidden className="absolute left-[calc(50%+24px)] right-[calc(-50%+24px)] top-[21px] hidden border-t-2 border-dashed border-line sm:block" />
                </>
              ) : null}
              <a href={step.href} className="flex min-h-11 min-w-0 items-start gap-3 rounded-2xl p-1 transition-colors hover:bg-surface-muted sm:flex-col sm:items-center sm:px-2 sm:text-center">
                <span aria-hidden className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${MARKER[step.kind]}`}>
                  {step.kind === "validado" ? <Check size={17} strokeWidth={3} /> : step.version}
                </span>
                <span className="min-w-0 pb-1">
                  <span className="block text-sm font-medium leading-snug text-ink">Versão {step.version}{step.current ? <span className="font-normal text-ink-soft"> · atual</span> : null}</span>
                  <span className={`mt-0.5 block text-xs ${step.kind === "validado" ? "font-medium text-ink" : "text-ink-soft"}`}>{step.stateLabel}</span>
                  {step.dates.map((date) => <span key={date} className="mt-0.5 block text-xs leading-snug text-ink-soft">{date}</span>)}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
