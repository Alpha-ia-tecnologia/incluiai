// Referência pedagógica: Diretrizes DUA 3.0 (CAST) — engajamento, representação
// e ação e expressão. As perguntas da interface são uma tradução proposta.
import type { Term } from "../scale.ts";

export type DuaPrinciple = "engajamento" | "representacao" | "acao_expressao";
export const DUA_PRINCIPLES: readonly DuaPrinciple[] = ["engajamento", "representacao", "acao_expressao"];
export const PRINCIPLE_LABEL: Record<DuaPrinciple, string> = {
  engajamento: "Engajamento",
  representacao: "Representação",
  acao_expressao: "Ação e expressão",
};
export const PRINCIPLE_QUESTION: Record<DuaPrinciple, string> = {
  engajamento: "Como envolver e apoiar a participação?",
  representacao: "Como apresentar e tornar a informação compreensível?",
  acao_expressao: "Como permitir agir e demonstrar a aprendizagem?",
};
export const PRINCIPLE_EXAMPLES: Record<DuaPrinciple, readonly string[]> = {
  engajamento: ["Escolhas pertinentes", "Propósito claro", "Etapas previsíveis", "Colaboração", "Temas significativos"],
  representacao: ["Texto acessível", "Áudio", "Imagens", "Símbolos", "Objetos", "Demonstrações", "Esclarecimento de vocabulário"],
  acao_expressao: ["Fala", "Escrita", "Seleção de alternativas", "Organização de elementos", "Recursos digitais", "Comunicação alternativa"],
};

export type BarrierStatus = "prevista" | "observada" | "hipotese";
export const BARRIER_STATUSES: readonly BarrierStatus[] = ["prevista", "observada", "hipotese"];
export const BARRIER_STATUS_LABEL: Record<BarrierStatus, string> = {
  prevista: "Barreira prevista",
  observada: "Barreira observada",
  hipotese: "Hipótese a verificar",
};
export type BarrierCategory = "instrucoes" | "leitura" | "estimulos" | "material" | "tempo" | "resposta" | "outra";
export const BARRIER_CATEGORIES: readonly BarrierCategory[] = ["instrucoes", "leitura", "estimulos", "material", "tempo", "resposta", "outra"];
// Descrições ligadas à tarefa e ao contexto, nunca ao estudante (LBI 13.146/2015).
export const BARRIER_CATEGORY_LABEL: Record<BarrierCategory, string> = {
  instrucoes: "Instruções longas, apresentadas em uma única etapa",
  leitura: "Dependência exclusiva da leitura para compreender a proposta",
  estimulos: "Excesso de estímulos sonoros ou visuais",
  material: "Material difícil de manipular",
  tempo: "Tempo ou organização incompatíveis com os apoios necessários",
  resposta: "Exigência de uma única forma de resposta",
  outra: "Outra barreira da tarefa ou do contexto",
};

export type OriginKind = "professor" | "colaboracao" | "ia";
export type DuaOrigin = { kind: OriginKind; suggestionId?: string; blockId?: string };
export const ORIGIN_LABEL: Record<OriginKind, string> = {
  professor: "Professor(a)",
  colaboracao: "Colaboração profissional",
  ia: "Sugestão revisada",
};

export type DuaCriterion = { id: string; description: string };
export type DuaBarrier = { id: string; description: string; category: BarrierCategory; status: BarrierStatus; origin: DuaOrigin };
export type StrategyDetails = { what: string; purpose: string; when: string; how: string };
export type DuaStrategy = {
  id: string;
  description: string;
  principles: DuaPrinciple[];
  barrierIds: string[];
  criterionIds: string[];
  resources: string[];
  context: string;
  details: StrategyDetails;
  origin: DuaOrigin;
};
export type DuaContent = {
  title: string;
  objective: { learning: string; curriculum: string; bnccCodes: string[] };
  criteria: DuaCriterion[];
  context: { audience: string; organization: string; resources: string[]; notes: string };
  barriers: DuaBarrier[];
  strategies: DuaStrategy[];
  followUp: string;
};

export const emptyDuaContent = (title = ""): DuaContent => ({
  title,
  objective: { learning: "", curriculum: "", bnccCodes: [] },
  criteria: [],
  context: { audience: "", organization: "", resources: [], notes: "" },
  barriers: [],
  strategies: [],
  followUp: "",
});

export const emptyStrategyDetails = (): StrategyDetails => ({ what: "", purpose: "", when: "", how: "" });

export function normalizeContent(value: Partial<DuaContent> | null | undefined): DuaContent {
  const base = emptyDuaContent();
  if (!value) return base;
  return {
    title: String(value.title ?? ""),
    objective: {
      learning: String(value.objective?.learning ?? ""),
      curriculum: String(value.objective?.curriculum ?? ""),
      bnccCodes: Array.isArray(value.objective?.bnccCodes) ? [...new Set(value.objective.bnccCodes.map((code) => String(code).toUpperCase()))].slice(0, 10) : [],
    },
    criteria: Array.isArray(value.criteria) ? value.criteria : [],
    context: {
      audience: String(value.context?.audience ?? ""),
      organization: String(value.context?.organization ?? ""),
      resources: Array.isArray(value.context?.resources) ? value.context.resources : [],
      notes: String(value.context?.notes ?? ""),
    },
    barriers: Array.isArray(value.barriers) ? value.barriers : [],
    strategies: Array.isArray(value.strategies)
      ? value.strategies.map((item) => ({ ...item, details: { ...emptyStrategyDetails(), ...(item.details ?? {}) }, resources: item.resources ?? [], barrierIds: item.barrierIds ?? [], criterionIds: item.criterionIds ?? [] }))
      : [],
    followUp: String(value.followUp ?? ""),
  };
}

export type ReviewState = "rascunho" | "em_revisao" | "validado";
export const REVIEW_STATE: Record<ReviewState, Term> = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  em_revisao: { label: "Em revisão", tone: "mid" },
  validado: { label: "Validado", tone: "good" },
};
export type ExecutionState = "planejada" | "em_andamento" | "concluida" | "cancelada";
export const EXECUTION_STATES: readonly ExecutionState[] = ["planejada", "em_andamento", "concluida", "cancelada"];
export const EXECUTION_STATE: Record<ExecutionState, Term> = {
  planejada: { label: "Planejada", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "info" },
  concluida: { label: "Concluída", tone: "good" },
  cancelada: { label: "Cancelada", tone: "mid" },
};
export const APPLICATION_STATE_CHANGED = "mudou a situação da aplicação";
export type AiState = "solicitado" | "em_processamento" | "aguardando_revisao" | "aceito" | "recusado" | "bloqueado" | "falhou";
export const AI_STATE: Record<AiState, Term> = {
  solicitado: { label: "Solicitado", tone: "neutral" },
  em_processamento: { label: "Em processamento", tone: "neutral" },
  aguardando_revisao: { label: "Aguardando revisão", tone: "mid" },
  aceito: { label: "Aceito", tone: "neutral" },
  recusado: { label: "Recusado", tone: "neutral" },
  bloqueado: { label: "Bloqueado", tone: "alert" },
  falhou: { label: "Falhou", tone: "alert" },
};
export type ApplicationContext = "sala_comum" | "aee";
export const APPLICATION_CONTEXTS: readonly ApplicationContext[] = ["sala_comum", "aee"];
export type Sharing = "privado" | "compartilhado";
export const SHARING: Record<Sharing, Term> = {
  privado: { label: "Só a equipe do planejamento", tone: "neutral" },
  compartilhado: { label: "Compartilhado com a equipe da escola", tone: "info" },
};

export type DuaProblem = { field: string; message: string };

const filled = (value: string | undefined | null) => Boolean(value && value.trim());

export function validationProblems(content: DuaContent): DuaProblem[] {
  const problems: DuaProblem[] = [];
  if (!filled(content.title)) problems.push({ field: "title", message: "Dê um título à atividade." });
  if ((content.objective.learning || "").trim().length < 10) problems.push({ field: "objective.learning", message: "Descreva a aprendizagem pretendida (o que se pretende desenvolver ou compreender)." });
  if (!content.criteria.some((item) => filled(item.description))) problems.push({ field: "criteria", message: "Inclua ao menos um critério observável: o que permitirá ver a aprendizagem." });
  if (!content.barriers.some((item) => filled(item.description))) problems.push({ field: "barriers", message: "Registre a análise das barreiras: ao menos uma barreira prevista, observada ou hipótese a verificar." });
  if (!content.strategies.length) problems.push({ field: "strategies", message: "Selecione ao menos uma opção de acesso ou participação." });
  const barrierIds = new Set(content.barriers.map((item) => item.id));
  const criterionIds = new Set(content.criteria.map((item) => item.id));
  content.strategies.forEach((strategy, index) => {
    const label = `Opção ${index + 1}`;
    if (!filled(strategy.description)) problems.push({ field: `strategies.${index}.description`, message: `${label}: descreva a opção oferecida.` });
    if (!strategy.principles.length) problems.push({ field: `strategies.${index}.principles`, message: `${label}: indique o princípio relacionado.` });
    if (strategy.barrierIds.some((id) => !barrierIds.has(id))) problems.push({ field: `strategies.${index}.barrierIds`, message: `${label}: refere-se a uma barreira que não existe mais.` });
    if (strategy.criterionIds.some((id) => !criterionIds.has(id))) problems.push({ field: `strategies.${index}.criterionIds`, message: `${label}: refere-se a um critério que não existe mais.` });
  });
  return problems;
}

export const strategiesWithoutBarrier = (content: DuaContent) => content.strategies.filter((strategy) => !strategy.barrierIds.length);

export const suggestionBasis = (content: DuaContent) => ({
  objective: content.objective,
  criteria: content.criteria.map(({ id, description }) => ({ id, description })),
  barriers: content.barriers.map(({ id, description, category, status }) => ({ id, description, category, status })),
});

export const collectiveCopy = (content: DuaContent, title?: string): DuaContent => {
  const copy = normalizeContent(JSON.parse(JSON.stringify(content)) as DuaContent);
  return title ? { ...copy, title } : copy;
};

export type ProfileRef = { field: string; label: string; value: string; source: string; updatedAt: string | null; version: string };
export type PlanLink = { kind: "objetivo"; planId: string; objectiveId: string; description: string };
export type StudentVoiceKind = "interesse" | "recurso_util" | "forma_escolhida" | "dificuldade" | "avaliacao";
export const STUDENT_VOICE_KINDS: readonly StudentVoiceKind[] = ["interesse", "recurso_util", "forma_escolhida", "dificuldade", "avaliacao"];
export const STUDENT_VOICE_LABEL: Record<StudentVoiceKind, string> = {
  interesse: "Interesse relacionado à atividade",
  recurso_util: "Recurso que considera útil",
  forma_escolhida: "Forma de participação escolhida nesta situação",
  dificuldade: "Dificuldade percebida",
  avaliacao: "O que ajudou e o que precisa mudar",
};
export type VoiceOrigin = "estudante" | "familia" | "profissional";
export const VOICE_ORIGINS: readonly VoiceOrigin[] = ["estudante", "familia", "profissional"];
export const VOICE_ORIGIN_LABEL: Record<VoiceOrigin, string> = { estudante: "Dito ou mostrado pelo estudante", familia: "Contado pela família", profissional: "Percebido pelo profissional" };
export type StudentVoiceEntry = { id: string; kind: StudentVoiceKind; text: string; context: string; origin: VoiceOrigin; date: string };
export type IndividualObjective = { text: string; justification: string; objectiveId: string | null };
export type DuaSupportData = {
  barrier: { description: string; status: BarrierStatus };
  support: string;
  purpose: string;
  usageContext: string;
  profileRefs: ProfileRef[];
  planLinks: PlanLink[];
  studentVoice: StudentVoiceEntry[];
  individualObjective: IndividualObjective | null;
  origin: DuaOrigin;
};

export function supportProblems(data: Pick<DuaSupportData, "support" | "purpose" | "individualObjective">): DuaProblem[] {
  const problems: DuaProblem[] = [];
  if (!filled(data.support)) problems.push({ field: "support", message: "Descreva o recurso ou a intervenção planejada." });
  if (!filled(data.purpose)) problems.push({ field: "purpose", message: "Diga a finalidade do apoio nesta atividade." });
  const objective = data.individualObjective;
  if (objective && filled(objective.text)) {
    if (!filled(objective.justification)) problems.push({ field: "individualObjective.justification", message: "Um objetivo individual diferente precisa de justificativa." });
    if (!objective.objectiveId) problems.push({ field: "individualObjective.objectiveId", message: "Ligue o objetivo individual a um objetivo do Plano de ensino do estudante." });
  }
  return problems;
}

export type CriterionStatus = "demonstrado" | "parcial" | "ainda_nao_demonstrado" | "sem_oportunidade" | "nao_registrado";
export const CRITERION_STATUSES: readonly CriterionStatus[] = ["demonstrado", "parcial", "ainda_nao_demonstrado", "sem_oportunidade", "nao_registrado"];
export const CRITERION_STATUS: Record<CriterionStatus, Term> = {
  demonstrado: { label: "Demonstrou", tone: "good" },
  parcial: { label: "Demonstrou em parte", tone: "mid" },
  ainda_nao_demonstrado: { label: "Ainda não demonstrou", tone: "alert" },
  sem_oportunidade: { label: "Não houve oportunidade de observar", tone: "neutral" },
  nao_registrado: { label: "Ainda não registrado", tone: "neutral" },
};
const OBSERVED: ReadonlySet<CriterionStatus> = new Set(["demonstrado", "parcial", "ainda_nao_demonstrado"]);
export const isObserved = (status: CriterionStatus) => OBSERVED.has(status);

export type EvidenceObservation = "observado" | "sem_oportunidade" | "nao_registrado";
export const OBSERVATION: Record<EvidenceObservation, Term> = {
  observado: { label: "Observado", tone: "good" },
  sem_oportunidade: CRITERION_STATUS.sem_oportunidade,
  nao_registrado: CRITERION_STATUS.nao_registrado,
};
export const isDocumented = (evidence: { observation: string } | undefined) => evidence !== undefined && evidence.observation !== "nao_registrado";

export type ApplicationResult = "sim" | "parcial" | "nao";
export const RESULT_STATUS: Record<ApplicationResult, CriterionStatus> = { sim: "demonstrado", parcial: "parcial", nao: "ainda_nao_demonstrado" };

export function resultFromCriteria(criteria: ReadonlyArray<{ status: CriterionStatus }>): ApplicationResult | null {
  const observed = criteria.filter((item) => isObserved(item.status));
  if (!observed.length) return null;
  if (observed.every((item) => item.status === "demonstrado")) return "sim";
  if (observed.some((item) => item.status === "demonstrado" || item.status === "parcial")) return "parcial";
  return "nao";
}

export function observationOf(criteria: ReadonlyArray<{ status: CriterionStatus }>): EvidenceObservation {
  if (criteria.some((item) => isObserved(item.status))) return "observado";
  return criteria.some((item) => item.status === "sem_oportunidade") ? "sem_oportunidade" : "nao_registrado";
}

export type FollowUpSuggestion = { text: string; basis: string; pending: string };
export type FollowUpEvidence = {
  criteria: ReadonlyArray<{ status: CriterionStatus }>;
  remainingBarriers: string;
  supportProvided: string;
  studentChoice: string;
  date: string;
  activity: string;
};

export function followUpSuggestions(evidence: readonly FollowUpEvidence[], plannedSupports: readonly { support: string }[] = []): FollowUpSuggestion[] {
  const out: FollowUpSuggestion[] = [];
  const add = (item: FollowUpSuggestion) => { if (!out.some((existing) => existing.text === item.text)) out.push(item); };
  for (const item of evidence) {
    const statuses = item.criteria.map((criterion) => criterion.status);
    if (statuses.includes("sem_oportunidade")) add({ text: "Oferecer uma oportunidade adicional de resposta.", basis: `${item.activity} (${item.date}): não houve oportunidade de observar um critério.`, pending: "Observar o critério numa nova oportunidade." });
    if (statuses.includes("nao_registrado")) add({ text: "Completar o registro da aplicação.", basis: `${item.activity} (${item.date}): critério ainda não registrado.`, pending: "Registrar o que foi observado, ou que não houve oportunidade." });
    if (statuses.includes("ainda_nao_demonstrado") || statuses.includes("parcial")) add({ text: "Retomar a atividade com outra forma de apresentação.", basis: `${item.activity} (${item.date}): critério ainda não demonstrado por completo.`, pending: "Verificar se a nova apresentação muda a resposta observada." });
    if (filled(item.remainingBarriers)) add({ text: "Revisar a clareza das instruções e as barreiras que permaneceram.", basis: `${item.activity} (${item.date}): barreiras registradas — ${item.remainingBarriers.trim()}.`, pending: "Confirmar se a barreira é da tarefa, do material ou da organização." });
    if (!filled(item.supportProvided) && plannedSupports.length) add({ text: "Verificar se o recurso previsto estava disponível.", basis: `${item.activity} (${item.date}): apoio planejado sem registro de uso.`, pending: "Registrar o apoio efetivamente disponibilizado." });
    if (!filled(item.studentChoice)) add({ text: "Consultar o estudante sobre a estratégia utilizada.", basis: `${item.activity} (${item.date}): sem registro da escolha ou manifestação do estudante.`, pending: "Registrar o que o estudante disse ou mostrou sobre o que ajudou." });
  }
  if (plannedSupports.length && evidence.some((item) => item.criteria.some((criterion) => criterion.status === "ainda_nao_demonstrado"))) {
    add({ text: "Discutir o apoio com o profissional do AEE.", basis: "Há apoio individual planejado e critério ainda não demonstrado.", pending: "Decidir em conjunto se o apoio continua, muda ou se soma a outro." });
  }
  return out.slice(0, 6);
}

export type AiBlockDecision = "pendente" | "aceito" | "editado" | "recusado";
export const AI_BLOCK_DECISION: Record<AiBlockDecision, Term> = {
  pendente: { label: "Aguardando decisão", tone: "neutral" },
  aceito: { label: "Aceito sem alteração", tone: "good" },
  editado: { label: "Aceito com edição", tone: "info" },
  recusado: { label: "Recusado", tone: "neutral" },
};
export type AiBlock = {
  id: string;
  objectiveConsidered: string;
  barrierConsidered: { barrierId: string | null; hypothesis: string | null; text: string };
  strategy: string;
  principles: DuaPrinciple[];
  justification: string;
  resources: string[];
  suggestedEvidence: string;
  pendingInformation: string[];
  criterionProposal: string | null;
  flags: { changesObjective: boolean; changesCriterion: boolean; individual: boolean; problems: string[]; blocked: boolean };
  decision: AiBlockDecision;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  reason: string | null;
};
export type AiCheck = { name: string; passed: boolean; detail: string };
export type AiPurpose = "opcoes" | "apoio_individual";
export const MAX_AI_BLOCKS = 5;
export const AI_SUGGESTION_LABEL = "Sugestão para revisão";

export function suggestionStateAfter(blocks: ReadonlyArray<Pick<AiBlock, "decision">>): AiState {
  if (blocks.some((block) => block.decision === "pendente")) return "aguardando_revisao";
  return blocks.some((block) => block.decision === "aceito" || block.decision === "editado") ? "aceito" : "recusado";
}

export type MaterialFormat = "roteiro_passos" | "fonte_ampliada" | "rotina_visual" | "prancha_comunicacao" | "alertas_sensoriais" | "anexo";
export const MATERIAL_FORMATS: readonly MaterialFormat[] = ["roteiro_passos", "fonte_ampliada", "rotina_visual", "prancha_comunicacao", "alertas_sensoriais", "anexo"];
export const MATERIAL_FORMAT_LABEL: Record<MaterialFormat, string> = {
  roteiro_passos: "Roteiro em passos curtos",
  fonte_ampliada: "Roteiro com fonte ampliada",
  rotina_visual: "Rotina visual da atividade",
  prancha_comunicacao: "Prancha de comunicação",
  alertas_sensoriais: "Alertas sensoriais",
  anexo: "Material da biblioteca anexado",
};
export const MATERIAL_ACCESSIBILITY: Record<MaterialFormat, readonly string[]> = {
  roteiro_passos: ["Uma ação por passo", "Linguagem direta", "Texto selecionável"],
  fonte_ampliada: ["Fonte ampliada", "Espaçamento maior", "Texto selecionável"],
  rotina_visual: ["Etapas numeradas", "Início e encerramento marcados", "Texto selecionável"],
  prancha_comunicacao: ["Cartões com palavra-chave", "Respostas por apontamento", "Texto selecionável"],
  alertas_sensoriais: ["Cuidados com o ambiente", "Avisos antes de mudanças", "Texto selecionável"],
  anexo: ["Conforme o material da biblioteca"],
};
export type MaterialScope = "coletivo" | "individual";
export type MaterialSection = { heading: string; items: string[] };
export const DRAFT_NOTICE = "RASCUNHO — material ainda não validado para uso pedagógico";

export function buildActivityScript(content: DuaContent, format: MaterialFormat): MaterialSection[] {
  const text = (value: string) => value.trim();
  const sections: MaterialSection[] = [
    { heading: "Para que serve esta atividade", items: [text(content.objective.learning)].filter(Boolean) },
    { heading: "Como vamos fazer", items: content.strategies.filter((item) => item.principles.includes("engajamento") || item.principles.includes("representacao")).map((item) => text(item.description)).filter(Boolean) },
    { heading: "Como você pode mostrar o que aprendeu", items: content.strategies.filter((item) => item.principles.includes("acao_expressao")).map((item) => text(item.description)).filter(Boolean) },
    { heading: "O que vamos observar", items: content.criteria.map((item) => text(item.description)).filter(Boolean) },
  ];
  if (format === "alertas_sensoriais") sections.push({ heading: "Cuidados com o ambiente", items: content.barriers.filter((item) => item.category === "estimulos").map((item) => text(item.description)).filter(Boolean) });
  if (format === "rotina_visual") sections.splice(1, 0, { heading: "Etapas", items: ["Início", ...content.strategies.slice(0, 4).map((item, index) => `${index + 1}. ${text(item.description)}`), "Encerramento"] });
  if (format === "prancha_comunicacao") {
    const words = [...new Set(content.strategies.flatMap((item) => item.resources).map(text).filter(Boolean))].slice(0, 8);
    sections.push({ heading: "Cartões da prancha", items: [...words, "Sim", "Não", "Preciso de ajuda", "Terminei"] });
  }
  return sections.filter((section) => section.items.length);
}

export function buildSupportScript(content: DuaContent, format: MaterialFormat, support: Pick<DuaSupportData, "support" | "usageContext">): MaterialSection[] {
  const sections = buildActivityScript(content, format);
  const items = [support.support.trim(), support.usageContext.trim() ? `Quando usar: ${support.usageContext.trim()}` : ""].filter(Boolean);
  return items.length ? [...sections, { heading: "Meu apoio nesta atividade", items }] : sections;
}

export type DuaIndicator = { key: string; label: string; definition: string; unit: string; numerator: number; denominator: number; value: number | null };
export const ratio = (numerator: number, denominator: number) => (denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null);
export const NO_BASE_TEXT = "Sem base para cálculo no período";
