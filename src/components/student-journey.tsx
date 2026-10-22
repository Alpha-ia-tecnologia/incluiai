"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Character } from "@/components/character";
import { primaryButtonCls } from "@/components/form-styles";
import { getStudentNextStep, type StudentJourneyInput } from "@/lib/student-journey";

// Um só próximo passo por tela: no Resumo, o cartão com as etapas; nas outras
// abas, o botão no cabeçalho da ficha (StudentNextStepLink).
export function StudentJourney({ progress }: { progress: StudentJourneyInput }) {
  const pathname = usePathname();
  const base = `/estudantes/${progress.id}`;
  if (pathname !== base) return null;
  const next = getStudentNextStep(progress);

  const steps = [
    { label: "Estudo de caso", href: `${base}/estudo-de-caso`, complete: progress.caseStudy === "concluido" },
    { label: "Conhecer", href: `${base}/perfil`, complete: progress.hasProfile },
    { label: "Planejar", href: `${base}/ppi`, complete: progress.hasPlan && progress.hasObjective },
    { label: "Preparar", href: `${base}/atividades`, complete: progress.hasPreparedActivity },
    { label: "Registrar", href: `${base}/diario`, complete: progress.hasDiary },
    { label: "Ver evolução", href: `${base}/linha-do-tempo`, complete: false },
  ];

  return (
    <section aria-label="Próximo passo do acompanhamento" className="mb-6 rounded-2xl border border-line bg-brand-soft/70 p-4 sm:p-5 print:hidden">
      <div className="flex items-center gap-4">
        <Character variant="care" className="hidden w-20 sm:block" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand-strong">Próximo passo sugerido</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{next.label}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{next.description}</p>
          <Link href={next.href} className={`${primaryButtonCls} mt-3`}>
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

// Botão do próximo passo no cabeçalho da ficha. Some no Resumo (que tem o
// cartão completo) e, na própria seção do passo, vira só um aviso.
export function StudentNextStepLink({ progress }: { progress: StudentJourneyInput }) {
  const pathname = usePathname();
  const base = `/estudantes/${progress.id}`;
  if (pathname === base) return null;
  const next = getStudentNextStep(progress);
  if (pathname === next.href) {
    return (
      <span className="student-head-detail inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-paper-raised px-3 text-xs font-medium text-brand-strong">
        <Check size={14} aria-hidden /> Você está no próximo passo
      </span>
    );
  }
  return (
    <Link href={next.href} title={next.description} className={`student-head-cta ${primaryButtonCls} max-w-full shrink-0`}>
      <span className="sr-only">Próximo passo: </span>{next.label} <ArrowRight size={16} aria-hidden />
    </Link>
  );
}
