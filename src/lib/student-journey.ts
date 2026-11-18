import type { Prisma } from "@prisma/client";
import { PREPARED_ACTIVITY_STATUSES } from "./scale.ts";

type JourneyFacts = {
  caseStudy: "rascunho" | "concluido" | null;
  hasProfile: boolean;
  hasPlan: boolean;
  hasObjective: boolean;
  hasPreparedActivity: boolean;
  hasDiary: boolean;
};
export type StudentJourneyInput = JourneyFacts & { id: string };

// Cada passo tem um nome só, o mesmo nas abas, no Resumo, em Minha jornada, na
// Ajuda e no Painel; um botão pode usar o verbo ("Registrar aula").
export const JOURNEY_STEPS = [
  { key: "estudo", step: 1, label: "Estudo de caso", path: "estudo-de-caso", done: (facts: JourneyFacts) => facts.caseStudy === "concluido" },
  { key: "plano", step: 2, label: "Plano", path: "ppi", done: (facts: JourneyFacts) => facts.hasPlan && facts.hasObjective },
  { key: "perfil", step: 3, label: "Como aprende", path: "perfil", done: (facts: JourneyFacts) => facts.hasProfile },
  { key: "atividade", step: 4, label: "Atividade", path: "atividades", done: (facts: JourneyFacts) => facts.hasPreparedActivity },
  { key: "registro", step: 5, label: "Registro", path: "diario", done: (facts: JourneyFacts) => facts.hasDiary },
] as const;
type JourneyStep = (typeof JOURNEY_STEPS)[number];
export const LAST_STEP = JOURNEY_STEPS.length;
// Evolução fecha a trilha sem se concluir: é onde a equipe vê o que mudou.
export const EVOLUTION_STEP = { key: "evolucao", step: LAST_STEP + 1, label: "Evolução", path: "linha-do-tempo" } as const;
export const TRAIL_STEPS = [...JOURNEY_STEPS, EVOLUTION_STEP] as const;
export const STEP = Object.fromEntries(JOURNEY_STEPS.map((step) => [step.key, step.step])) as Record<JourneyStep["key"], number>;

export const JOURNEY_SELECT = {
  caseStudy: { select: { status: true } },
  profile: { select: { id: true } },
  plans: { where: { status: "ativo" }, orderBy: { createdAt: "desc" }, take: 1, select: { status: true, objectives: { where: { status: "ativo" }, take: 1, select: { status: true } } } },
  activities: { where: { status: { in: PREPARED_ACTIVITY_STATUSES } }, take: 1, select: { status: true } },
  diaryEntries: { take: 1, select: { id: true } },
} satisfies Prisma.StudentSelect;

type JourneyRow = {
  caseStudy: { status: string } | null;
  profile: unknown;
  plans: ReadonlyArray<{ status: string; objectives: ReadonlyArray<{ status: string }> }>;
  activities: ReadonlyArray<{ status: string }>;
  diaryEntries: ReadonlyArray<unknown>;
};

export function journeyFacts(row: JourneyRow): JourneyFacts {
  const plan = row.plans.find((item) => item.status === "ativo");
  return {
    caseStudy: row.caseStudy?.status === "concluido" || row.caseStudy?.status === "rascunho" ? row.caseStudy.status : null,
    hasProfile: Boolean(row.profile),
    hasPlan: Boolean(plan),
    hasObjective: Boolean(plan?.objectives.some((objective) => objective.status === "ativo")),
    hasPreparedActivity: row.activities.some((activity) => PREPARED_ACTIVITY_STATUSES.includes(activity.status)),
    hasDiary: row.diaryEntries.length > 0,
  };
}

export const nextStepOf = (row: JourneyRow & { id: string }) => getStudentNextStep({ id: row.id, ...journeyFacts(row) });

export type StudentNextStep = {
  href: string;
  label: string;
  description: string;
  step: number;
};

export function getStudentNextStep(input: StudentJourneyInput): StudentNextStep {
  const base = `/estudantes/${input.id}`;

  if (!input.hasPlan && input.caseStudy !== "concluido") {
    return {
      href: `${base}/estudo-de-caso`,
      label: input.caseStudy === "rascunho" ? "Concluir o estudo de caso" : "Fazer o estudo de caso",
      description: input.caseStudy === "rascunho"
        ? "Complete o essencial e registre a síntese: o estudo concluído respalda a declaração no Censo Escolar."
        : "Registre o essencial do caso: ele respalda a declaração no Censo Escolar e abre o plano de ensino.",
      step: STEP.estudo,
    };
  }
  if (!input.hasPlan) {
    return {
      href: `${base}/ppi`,
      label: "Criar o plano de ensino",
      description: "Registre o PAEE e o PEI e escolha o que trabalhar com este estudante.",
      step: STEP.plano,
    };
  }
  if (!input.hasObjective) {
    return {
      href: `${base}/ppi`,
      label: "Definir um objetivo",
      description: "Adicione ao plano uma aprendizagem que você quer acompanhar.",
      step: STEP.plano,
    };
  }
  if (!input.hasProfile) {
    return {
      href: `${base}/perfil`,
      label: "Contar como aprende",
      description: "Antes de preparar atividades, conte como ele se comunica, do que gosta e quais apoios ajudam.",
      step: STEP.perfil,
    };
  }
  if (!input.hasPreparedActivity) {
    return {
      href: `${base}/atividades`,
      label: "Preparar uma atividade",
      description: "Veja as sugestões e aceite uma atividade para usar com o estudante.",
      step: STEP.atividade,
    };
  }
  return {
    href: `${base}/diario`,
    label: "Registrar como foi a aula",
    description: input.hasDiary
      ? "A cada aula, faça um novo registro para acompanhar o que está funcionando."
      : "Depois da atividade, conte como foi a participação e qual apoio foi necessário.",
    step: STEP.registro,
  };
}
