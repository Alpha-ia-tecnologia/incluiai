"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Character } from "@/components/character";
import { BUTTON_CLS } from "@/components/form-styles";
import { HEAD_PART } from "@/components/student-head-parts";
import { JOURNEY_STEPS, LAST_STEP, getStudentNextStep, type StudentJourneyInput } from "@/lib/student-journey";

export function StudentJourney({ progress }: { progress: StudentJourneyInput }) {
  const pathname = usePathname();
  const base = `/estudantes/${progress.id}`;
  if (pathname !== base) return null;
  const next = getStudentNextStep(progress);

  const steps = [
    ...JOURNEY_STEPS.map((step) => ({ label: step.action, href: `${base}/${step.path}`, complete: step.done(progress) })),
    { label: "Ver evolução", href: `${base}/linha-do-tempo`, complete: false },
  ];

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
      <ol aria-label="Etapas do acompanhamento" className="mt-4 flex flex-wrap gap-2 border-t border-brand/15 pt-3">
        {steps.map((step, index) => (
          <li key={step.href}>
            <Link href={step.href} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-xs ${index + 1 === next.step ? "bg-paper-raised font-semibold text-brand-strong" : "text-ink-soft hover:bg-paper-raised"}`}>
              <span aria-hidden className={`inline-flex size-5 items-center justify-center rounded-full ${step.complete ? "bg-brand text-white" : "border border-brand/30"}`}>
                {step.complete ? <Check size={12} /> : index + 1}
              </span>
              {step.label}
              {step.complete ? <span className="sr-only">: já tem informações salvas</span> : null}
            </Link>
          </li>
        ))}
      </ol>
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
      <span className={`${HEAD_PART.detail} inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-paper-raised px-3 text-xs font-medium text-brand-strong`}>
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
