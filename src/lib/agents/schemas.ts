import { z } from "zod/v4";

// Saídas estruturadas dos agentes. Os esquemas evitam restrições numéricas
// (mínimo/máximo): os valores são ajustados depois, na etapa de finalização.

export const DIMENSION_KEYS = ["comunicacao", "leitura", "escrita", "matematica", "interacao", "autonomia", "regulacao"] as const;
export const CONTEXT_KEYS = ["sala_comum", "aee", "casa"] as const;
export type ActivityContext = (typeof CONTEXT_KEYS)[number];

// ---------- Plano individual (PPI) ----------
export const CaseAnalysisSchema = z.object({
  sintese: z.string().describe("Duas a quatro frases sobre como o estudante participa e aprende hoje."),
  potencialidades: z.array(z.string()),
  barreiras: z.array(z.string()).describe("Barreiras do ambiente escolar, não características do estudante."),
  prioridades: z.array(z.object({
    dimension: z.enum(DIMENSION_KEYS),
    justificativa: z.string(),
  })).describe("De 2 a 3 áreas para começar, da mais urgente para a menos urgente."),
  cuidados: z.array(z.string()).describe("Cuidados de regulação, sensoriais ou de comunicação que toda proposta deve respeitar."),
});
export type CaseAnalysis = z.infer<typeof CaseAnalysisSchema>;

export const ProposedObjectiveSchema = z.object({
  dimension: z.enum(DIMENSION_KEYS),
  action: z.string().describe("Verbo no futuro + o que fará, sem o nome. Ex.: identificará o próprio nome entre 5 opções"),
  condition: z.string().describe("Apoio ou condição. Ex.: com pista visual"),
  criterion: z.string().describe("Critério mensurável, sem a palavra 'em'. Ex.: 4 de 5 tentativas"),
  deadlineWeeks: z.number().int(),
  currentSupport: z.number().int().describe("Nível de apoio hoje, de 0 (independente) a 5 (apoio físico total)."),
  targetSupport: z.number().int().describe("Nível de apoio esperado ao fim do prazo; menor que o atual."),
  bnccCode: z.string().nullable(),
  rationale: z.string().describe("Por que este objetivo, em uma frase, ligado ao que o caso mostrou."),
});
export type ProposedObjective = z.infer<typeof ProposedObjectiveSchema>;

export const PlanProposalSchema = z.object({
  initialSituation: z.array(z.string()).describe("O que o estudante já consegue fazer, item a item."),
  commonRoomStrategies: z.array(z.string()),
  aeeStrategies: z.array(z.string()),
  accessibilityResources: z.array(z.string()),
  reviewWeeks: z.number().int().describe("Em quantas semanas a equipe deve revisar o plano."),
  objectives: z.array(ProposedObjectiveSchema).describe("De 2 a 3 objetivos observáveis."),
});
export type PlanProposal = z.infer<typeof PlanProposalSchema>;

export const ReviewSchema = z.object({
  aprovado: z.boolean(),
  problemas: z.array(z.object({
    alvo: z.string().describe("Onde está o problema. Ex.: objetivo 2, estratégias da sala comum, atividade aee"),
    problema: z.string(),
    correcao: z.string().describe("O que mudar, de forma concreta."),
  })),
});
export type Review = z.infer<typeof ReviewSchema>;

// ---------- Atividades ----------
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
    context: z.enum(CONTEXT_KEYS),
    aprovado: z.boolean(),
    problemas: z.array(z.string()).describe("Cada problema com a correção esperada."),
  })),
});
export type ActivityReview = z.infer<typeof ActivityReviewSchema>;

// Etapa registrada para mostrar ao professor como a proposta foi feita.
export type TraceStep = { agent: string; summary: string };
