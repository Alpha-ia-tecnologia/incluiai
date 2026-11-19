"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Character } from "@/components/character";
import { BUTTON_CLS } from "@/components/form-styles";
import { HEAD_PART } from "@/components/student-head-parts";
import { LAST_STEP, TRAIL_STEPS, getStudentNextStep, type StudentJourneyInput } from "@/lib/student-journey";

export function StudentJourney({ progress }: { progress: StudentJourneyInput }) {
  const pathname = usePathname();
  const base = `/estudantes/${progress.id}`;
  if (pathname !== base) return null;
  const next = getStudentNextStep(progress);

  const steps = TRAIL_STEPS.map((step) => ({
    step: step.step,
    label: step.label,
    href: `${base}/${step.path}`,
    complete: "done" in step && step.done(progress),
  }));

  return (
    <section aria-label="Próximo passo do acompanhamento" className="mb-6 rounded-2xl border border-line bg-brand-soft/70 p-4 sm:p-5 print:hidden">
      <div className="flex items-center gap-4">
        <Character variant="care" className="hidden w-20 sm:block" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-ink">Próximo passo: {next.label}</h2>
          <Link href={next.href} className={`${BUTTON_CLS.primary} mt-3`}>
            {next.step === LAST_STEP ? "Registrar aula" : "Continuar"} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
      <div className="@container mt-4 border-t border-brand/15 pt-3">
        <ol aria-label="Etapas do acompanhamento" className="grid grid-cols-3 gap-1 @xl:grid-cols-6">
          {steps.map((step) => {
            const current = step.step === next.step;
            return (
              <li key={step.href} className="min-w-0">
                <Link
                  href={step.href}
                  aria-current={current ? "step" : undefined}
                  className={`flex h-full min-h-11 flex-col items-center gap-1.5 rounded-2xl px-1.5 py-2 text-center text-sm leading-tight ${current ? "bg-paper-raised font-semibold text-brand-strong shadow-e1" : "text-ink-soft hover:bg-paper-raised hover:text-ink"}`}
                >
                  <span aria-hidden className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${step.complete ? "bg-brand text-white" : current ? "border-2 border-brand text-brand-strong" : "border border-brand/30"} ${current ? "ring-2 ring-brand/25 ring-offset-2 ring-offset-paper-raised" : ""}`}>
                    {step.complete ? <Check size={14} strokeWidth={3} /> : step.step}
                  </span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{step.label}</span>
                  {step.complete ? <span className="sr-only">: já tem informações salvas</span> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function StudentNextStepLink({ progress }: { progress: StudentJourneyInput }) {
  const pathname = usePathname();
  const base = `/estudantes/${progress.id}`;
  if (pathname === base) return null;
  const next = getStudentNextStep(progress);
  if (pathname === next.href) {
    return (
      <span className={`${HEAD_PART.detail} inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-paper-raised px-3 text-sm font-medium text-brand-strong`}>
        <Check size={14} aria-hidden /> Você está no próximo passo
      </span>
    );
  }
  return (
    <Link href={next.href} title={next.description} className={`${HEAD_PART.cta} ${BUTTON_CLS.primary} max-w-full shrink-0`}>
      <span className="sr-only">Próximo passo: </span>{next.label} <ArrowRight size={16} aria-hidden />
    </Link>
  );
}
