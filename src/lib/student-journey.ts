export type StudentJourneyInput = {
  id: string;
  caseStudy: "rascunho" | "concluido" | null;
  hasProfile: boolean;
  hasPlan: boolean;
  hasObjective: boolean;
  hasPreparedActivity: boolean;
  hasDiary: boolean;
  // Sala comum e profissional de apoio: quem conduz o estudo de caso é o AEE,
  // então ele não vira o próximo passo dessas pessoas.
  caseStudyLedByOthers?: boolean;
};

export type StudentNextStep = {
  href: string;
  label: string;
  description: string;
  // Versão curta, para caber no cartão do Início sem cortar a frase.
  short: string;
  step: number;
};

// A sugestão orienta a rotina; as outras seções continuam disponíveis.
export function getStudentNextStep(input: StudentJourneyInput): StudentNextStep {
  const base = `/estudantes/${input.id}`;

  // O estudo de caso abre o acompanhamento. Estudantes que já têm o perfil
  // preenchido seguem a rotina; o estudo continua disponível na jornada.
  if (!input.hasProfile && input.caseStudy !== "concluido" && !input.caseStudyLedByOthers) {
    return {
      href: `${base}/estudo-de-caso`,
      label: input.caseStudy === "rascunho" ? "Concluir o estudo de caso" : "Fazer o estudo de caso",
      description: input.caseStudy === "rascunho"
        ? "Complete o que falta e registre a síntese do caso."
        : "Ouça a família, a escola e o estudante para entender as necessidades antes de planejar.",
      short: input.caseStudy === "rascunho" ? "Complete o que falta e registre a síntese." : "Ouça família, escola e estudante antes de planejar.",
      step: 1,
    };
  }
  if (!input.hasProfile) {
    return {
      href: `${base}/perfil`,
      label: "Conhecer o estudante",
      description: "Conte como ele se comunica, do que gosta e quais apoios ajudam a aprender.",
      short: "Conte como se comunica e o que ajuda a aprender.",
      step: 2,
    };
  }
  if (!input.hasPlan) {
    return {
      href: `${base}/ppi`,
      label: "Criar o plano individual",
      description: "Escolha o que trabalhar com este estudante e quando revisar o plano.",
      short: "Escolha o que trabalhar e quando revisar.",
      step: 3,
    };
  }
  if (!input.hasObjective) {
    return {
      href: `${base}/ppi`,
      label: "Definir um objetivo",
      description: "Adicione ao plano uma aprendizagem que você quer acompanhar.",
      short: "Adicione uma aprendizagem para acompanhar.",
      step: 3,
    };
  }
  if (!input.hasPreparedActivity) {
    return {
      href: `${base}/atividades`,
      label: "Preparar uma atividade",
      description: "Veja as sugestões e aceite uma atividade para usar com o estudante.",
      short: "Veja as sugestões e escolha uma atividade.",
      step: 4,
    };
  }
  return {
    href: `${base}/diario`,
    label: "Registrar como foi a aula",
    description: input.hasDiary
      ? "A cada aula, faça um novo registro para acompanhar o que está funcionando."
      : "Depois da atividade, conte como foi a participação e qual apoio foi necessário.",
    short: input.hasDiary ? "Um registro por aula mostra o que funciona." : "Conte como foi a participação e o apoio.",
    step: 5,
  };
}
