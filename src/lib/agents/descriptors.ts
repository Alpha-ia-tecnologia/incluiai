export const RULES_ENGINE = "Motor de regras";
export const AI_AGENTS = "Agentes de IA";
export const ANONYMIZATION = "Anonimização";
export const FINALIZATION = "Finalização";
export const AI_PROVIDER = "Provedor de IA";
export const ILLUSTRATION = "Ilustração";

const CONTEXT_AGENTS = { sala_comum: "Agente da sala comum", aee: "Agente do AEE", casa: "Agente da família" } as const;

export type Pipeline<Part extends string> = {
  preparer?: string;
  writers: Readonly<Record<Part, string>>;
  reviewer: string;
};

export const PLAN_PIPELINE = {
  preparer: "Analista do caso",
  writers: { paee: "Agente do PAEE", pei: "Agente do PEI", objetivos: "Planejador do PPI" },
  reviewer: "Revisor pedagógico",
} as const satisfies Pipeline<string>;

export const ACTIVITY_PIPELINE = {
  writers: CONTEXT_AGENTS,
  reviewer: "Revisor das atividades",
} as const satisfies Pipeline<string>;

export const MATERIAL_PIPELINE = {
  writers: { material: "Criador de materiais", ...CONTEXT_AGENTS },
  reviewer: "Revisor do material",
} as const satisfies Pipeline<string>;

export const DUA_PIPELINE = {
  preparer: "Analista das barreiras",
  writers: { engajamento: "Especialista em engajamento", representacao: "Especialista em representação", acao_expressao: "Especialista em ação e expressão" },
  reviewer: "Revisor das sugestões",
} as const satisfies Pipeline<string>;
