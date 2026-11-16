export type StudentJourneyInput = {
  id: string;
  caseStudy: "rascunho" | "concluido" | null;
  hasProfile: boolean;
  hasPlan: boolean;
  hasObjective: boolean;
  hasPreparedActivity: boolean;
  hasDiary: boolean;
};

export type StudentNextStep = {
  href: string;
  label: string;
  description: string;
  step: number;
};

// A sugestão orienta a rotina; as outras seções continuam disponíveis.
// A ordem segue o essencial primeiro: o estudo de caso (que respalda a declaração
// no Censo Escolar e abre o plano), o plano de ensino e só então Como aprende,
// que serve para preparar atividades e materiais. Os números das etapas são os
// de JOURNEY_STEPS (src/lib/dashboard.ts).
export function getStudentNextStep(input: StudentJourneyInput): StudentNextStep {
  const base = `/estudantes/${input.id}`;

  // O plano só abre com o estudo de caso concluído. Quem já tem plano (fichas
  // anteriores ao estudo de caso) segue a rotina; o estudo continua disponível.
  if (!input.hasPlan && input.caseStudy !== "concluido") {
    return {
      href: `${base}/estudo-de-caso`,
      label: input.caseStudy === "rascunho" ? "Concluir o estudo de caso" : "Fazer o estudo de caso",
      description: input.caseStudy === "rascunho"
        ? "Complete o essencial e registre a síntese: o estudo concluído respalda a declaração no Censo Escolar."
        : "Registre o essencial do caso: ele respalda a declaração no Censo Escolar e abre o plano de ensino.",
      step: 1,
    };
  }
  if (!input.hasPlan) {
    return {
      href: `${base}/ppi`,
      label: "Criar o plano de ensino",
      description: "Registre o PAEE e o PEI e escolha o que trabalhar com este estudante.",
      step: 2,
    };
  }
  if (!input.hasObjective) {
    return {
      href: `${base}/ppi`,
      label: "Definir um objetivo",
      description: "Adicione ao plano uma aprendizagem que você quer acompanhar.",
      step: 2,
    };
  }
  if (!input.hasProfile) {
    return {
      href: `${base}/perfil`,
      label: "Conhecer o estudante",
      description: "Antes de preparar atividades, conte como ele se comunica, do que gosta e quais apoios ajudam.",
      step: 3,
    };
  }
  if (!input.hasPreparedActivity) {
    return {
      href: `${base}/atividades`,
      label: "Preparar uma atividade",
      description: "Veja as sugestões e aceite uma atividade para usar com o estudante.",
      step: 4,
    };
  }
  return {
    href: `${base}/diario`,
    label: "Registrar como foi a aula",
    description: input.hasDiary
      ? "A cada aula, faça um novo registro para acompanhar o que está funcionando."
      : "Depois da atividade, conte como foi a participação e qual apoio foi necessário.",
    step: 5,
  };
}
