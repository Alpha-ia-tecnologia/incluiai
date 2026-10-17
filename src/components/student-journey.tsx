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
    <section aria-label="Próximo passo do acompanhamento" className="mb-5 rounded-[22px] border border-line bg-brand-soft/70 p-4 sm:p-5 print:hidden">
      <div className="flex items-center gap-4">
        <Character variant="care" className="hidden w-20 sm:block" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand-strong">Próximo passo sugerido</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{next.label}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{next.description}</p>
          <Link href={next.href} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong">
            {next.step === 5 ? "Registrar aula" : "Continuar"} <ArrowRight size={16} aria-hidden />
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
