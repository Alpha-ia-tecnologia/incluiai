import { z } from "zod/v4";
import { ACTIVITY_CONTEXTS, OBJECTIVES_PER_PLAN } from "../pedagogy-rules.ts";
import { SUPPORT_LEVELS } from "../scale.ts";

export const DIMENSION_KEYS = ["comunicacao", "leitura", "escrita", "matematica", "interacao", "autonomia", "regulacao"] as const;
const objectiveCount = `De ${OBJECTIVES_PER_PLAN.min} a ${OBJECTIVES_PER_PLAN.max}`;
const supportEnds = `de 0 (${SUPPORT_LEVELS[0].label.toLowerCase()}) a 5 (${SUPPORT_LEVELS[5].label.toLowerCase()})`;

export const CaseAnalysisSchema = z.object({
  sintese: z.string().describe("Duas a quatro frases sobre como o estudante participa e aprende hoje."),
  potencialidades: z.array(z.string()),
  barreiras: z.array(z.string()).describe("Barreiras do ambiente escolar, não características do estudante."),
  prioridades: z.array(z.object({
    dimension: z.enum(DIMENSION_KEYS),
    justificativa: z.string(),
  })).describe(`${objectiveCount} áreas para começar, da mais urgente para a menos urgente.`),
  cuidados: z.array(z.string()).describe("Cuidados de regulação, sensoriais ou de comunicação que toda proposta deve respeitar."),
});
export type CaseAnalysis = z.infer<typeof CaseAnalysisSchema>;

export const ProposedObjectiveSchema = z.object({
  dimension: z.enum(DIMENSION_KEYS),
  action: z.string().describe("Verbo no futuro + o que fará, sem o nome. Ex.: identificará o próprio nome entre 5 opções"),
  condition: z.string().describe("Apoio ou condição. Ex.: com pista visual"),
  criterion: z.string().describe("Critério mensurável, sem a palavra 'em'. Ex.: 4 de 5 tentativas"),
  deadlineWeeks: z.number().int(),
  currentSupport: z.number().int().describe(`Nível de apoio hoje, ${supportEnds}.`),
  targetSupport: z.number().int().describe("Nível de apoio esperado ao fim do prazo; menor que o atual."),
  bnccCode: z.string().nullable(),
  rationale: z.string().describe("Por que este objetivo, em uma frase, ligado ao que o caso mostrou."),
});

// O plano reúne o PAEE e o PEI (Portaria MEC nº 421/2026, arts. 10 e 11) e os
// objetivos.
export const PaeeProposalSchema = z.object({
  accessibilityResources: z.array(z.string()).describe("Art. 10, I: materiais e recursos de acessibilidade para o estudante participar."),
  assistiveTech: z.array(z.string()).describe("Art. 10, II: tecnologia assistiva e comunicação alternativa. Lista vazia se o caso não permite avaliar."),
  supportStaff: z.array(z.string()).describe("Art. 10, III: profissional de apoio escolar, intérprete de Libras, guia-intérprete. Lista vazia se o caso não permite avaliar."),
  networkDemands: z.array(z.string()).describe("Art. 10, IV: formação da equipe e articulação com a rede de proteção social."),
});
export type PaeeProposal = z.infer<typeof PaeeProposalSchema>;

export const PeiProposalSchema = z.object({
  aeeServices: z.array(z.string()).describe("Art. 11, I: tipos de atendimento do AEE, com os nomes do Censo Escolar, exatamente como na lista recebida."),
  aeeStrategies: z.array(z.string()).describe("Art. 11, I: atividades no AEE."),
  commonRoomStrategies: z.array(z.string()).describe("Art. 11, I e II: o que muda na classe comum para o estudante aprender com a turma."),
  assessmentAccessibility: z.array(z.string()).describe("Art. 11, II: recursos de acessibilidade na avaliação."),
  monitoring: z.array(z.string()).describe("Art. 11, III: como a equipe acompanha o plano."),
  familyFeedback: z.array(z.string()).describe("Art. 11, IV: como e quando a família recebe a devolutiva."),
});
export type PeiProposal = z.infer<typeof PeiProposalSchema>;

export const ObjectivesProposalSchema = z.object({
  initialSituation: z.array(z.string()).describe("O que o estudante já consegue fazer, item a item."),
  reviewWeeks: z.number().int().describe("Em quantas semanas a equipe deve revisar o plano."),
  objectives: z.array(ProposedObjectiveSchema).describe(`${objectiveCount} objetivos observáveis.`),
});
export type ObjectivesProposal = z.infer<typeof ObjectivesProposalSchema>;

const laterList = () => z.array(z.string()).default([]);
export const PlanProposalSchema = z.object({
  initialSituation: z.array(z.string()),
  commonRoomStrategies: z.array(z.string()),
  aeeStrategies: z.array(z.string()),
  accessibilityResources: z.array(z.string()),
  assistiveTech: laterList(),
  supportStaff: laterList(),
  networkDemands: laterList(),
  aeeServices: laterList(),
  assessmentAccessibility: laterList(),
  monitoring: laterList(),
  familyFeedback: laterList(),
  reviewWeeks: z.number().int(),
  objectives: z.array(ProposedObjectiveSchema),
});
export type PlanProposal = z.infer<typeof PlanProposalSchema>;

const PlanProblemSchema = z.object({
  alvo: z.string().describe("Onde está o problema. Ex.: objetivo 2, estratégias da sala comum, atividade aee"),
  problema: z.string(),
  correcao: z.string().describe("O que mudar, de forma concreta."),
});
export type PlanProblem = z.infer<typeof PlanProblemSchema>;

export const PLAN_PARTS = ["paee", "pei", "objetivos"] as const;
export type PlanPart = (typeof PLAN_PARTS)[number];
export const PlanReviewSchema = z.object({
  avaliacoes: z.array(z.object({
    parte: z.enum(PLAN_PARTS),
    aprovado: z.boolean(),
    problemas: z.array(PlanProblemSchema),
  })).describe("Uma avaliação para cada parte: paee, pei e objetivos."),
});

export const AgentCardSchema = z.object({
  title: z.string(),
  durationMinutes: z.number().int(),
  materials: z.array(z.string()),
  steps: z.array(z.string()).describe("Frases de uma ação cada, na ordem de execução."),
  responseForm: z.string(),
  supportBelow: z.string().describe("Como oferecer mais apoio se o estudante não conseguir."),
  supportTarget: z.string().describe("O que se espera no nível de apoio alvo."),
  supportAbove: z.string().describe("Como reduzir o apoio quando o estudante conseguir."),
  successCriterion: z.string(),
  planB: z.string(),
  classParticipation: z.string().nullable().describe("Como a turma participa junto. Obrigatório na sala comum; nulo nos demais."),
});
export type AgentCard = z.infer<typeof AgentCardSchema>;

export const ActivityReviewSchema = z.object({
  avaliacoes: z.array(z.object({
    context: z.enum(ACTIVITY_CONTEXTS),
    aprovado: z.boolean(),
    problemas: z.array(z.string()).describe("Cada problema com a correção esperada."),
  })),
});

