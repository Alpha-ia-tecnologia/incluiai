"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Character } from "@/components/character";
import { getStudentNextStep, type StudentJourneyInput } from "@/lib/student-journey";

export function StudentJourney({ progress }: { progress: StudentJourneyInput }) {
  const pathname = usePathname();
  const base = `/estudantes/${progress.id}`;
  const next = getStudentNextStep(progress);
  const isOverview = pathname === base;
  const isNextSection = pathname === next.href;

  if (!isOverview) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-soft/70 px-4 py-3 text-sm print:hidden">
        <p className="text-ink-soft">
          {isNextSection ? <><span className="font-medium text-ink">Você está no próximo passo.</span> {next.description}</> : "Continue no seu ritmo. Próximo passo sugerido:"}
        </p>
        {!isNextSection ? (
          <Link href={next.href} className="inline-flex min-h-11 items-center gap-2 font-medium text-brand-strong underline underline-offset-4">
            {next.label} <ArrowRight size={15} aria-hidden />
          </Link>
        ) : null}
      </div>
    );
  }

  const steps = [
    { label: "Estudo de caso", href: `${base}/estudo-de-caso`, complete: progress.caseStudy === "concluido" },
    { label: "Conhecer", href: `${base}/perfil`, complete: progress.hasProfile },
    { label: "Planejar", href: `${base}/ppi`, complete: progress.hasPlan && progress.hasObjective },
    { label: "Preparar", href: `${base}/atividades`, complete: progress.hasPreparedActivity },
    { label: "Registrar", href: `${base}/diario`, complete: progress.hasDiary },
    { label: "Ver evolução", href: `${base}/linha-do-tempo`, complete: false },
  ];

  return (
    <section aria-label="Próximo passo do acompanhamento" className="mb-5 rounded-xl border border-line bg-brand-soft/70 p-4 sm:p-5 print:hidden">
      <div className="flex items-center gap-4">
        <Character variant="care" className="hidden w-20 sm:block" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink">Próximo passo: {next.label}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{next.description}</p>
          <Link href={next.href} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
            {next.step === 5 ? "Registrar aula" : "Continuar"} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
      <ol aria-label="Etapas do acompanhamento" className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-3">
        {steps.map((step, index) => (
          <li key={step.href}>
            <Link href={step.href} aria-current={index + 1 === next.step ? "step" : undefined} className={`inline-flex min-h-11 items-center gap-2 py-2 text-sm underline-offset-4 hover:underline ${index + 1 === next.step ? "font-bold text-ink" : "text-ink-soft"}`}>
              <span aria-hidden className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${step.complete ? "bg-ink text-paper-yellow" : index + 1 === next.step ? "border-[3px] border-tack bg-paper-raised text-ink" : "border-[1.5px] border-ink bg-paper-raised text-ink"}`}>
                {step.complete ? <Check size={13} strokeWidth={3.2} /> : index + 1}
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
