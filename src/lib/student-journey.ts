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
export function getStudentNextStep(input: StudentJourneyInput): StudentNextStep {
  const base = `/estudantes/${input.id}`;

  // O estudo de caso abre o acompanhamento. Estudantes que já têm o perfil
  // preenchido seguem a rotina; o estudo continua disponível na jornada.
  if (!input.hasProfile && input.caseStudy !== "concluido") {
    return {
      href: `${base}/estudo-de-caso`,
      label: input.caseStudy === "rascunho" ? "Concluir o estudo de caso" : "Fazer o estudo de caso",
      description: input.caseStudy === "rascunho"
        ? "Complete o que falta e registre a síntese do caso."
        : "Ouça a família, a escola e o estudante para entender as necessidades antes de planejar.",
      step: 1,
    };
  }
  if (!input.hasProfile) {
    return {
      href: `${base}/perfil`,
      label: "Conhecer o estudante",
      description: "Conte como ele se comunica, do que gosta e quais apoios ajudam a aprender.",
      step: 2,
    };
  }
  if (!input.hasPlan) {
    return {
      href: `${base}/ppi`,
      label: "Criar o plano de ensino",
      description: "Escolha o que trabalhar com este estudante e quando revisar o plano.",
      step: 3,
    };
  }
  if (!input.hasObjective) {
    return {
      href: `${base}/ppi`,
      label: "Definir um objetivo",
      description: "Adicione ao plano uma aprendizagem que você quer acompanhar.",
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
