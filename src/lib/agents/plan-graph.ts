import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ACCESSIBILITY_RESOURCE_OPTIONS, AEE_STRATEGY_OPTIONS, COMMON_ROOM_STRATEGY_OPTIONS } from "../form-options.ts";
import {
  AEE_SERVICE_OPTIONS, ASSESSMENT_ACCESSIBILITY_OPTIONS, ASSISTIVE_TECH_OPTIONS, FAMILY_FEEDBACK_OPTIONS, MONITORING_OPTIONS,
  NETWORK_DEMAND_OPTIONS, SUPPORT_STAFF_OPTIONS, canonicalItems,
} from "../plan-documents.ts";
import { ANALYST_SYSTEM, PAEE_SYSTEM, PEI_SYSTEM, PLANNER_SYSTEM, PLAN_REVIEWER_SYSTEM } from "./prompts.ts";
import {
  CaseAnalysisSchema, DIMENSION_KEYS, ObjectivesProposalSchema, PLAN_PARTS, PaeeProposalSchema, PeiProposalSchema, PlanReviewSchema,
  type CaseAnalysis, type ObjectivesProposal, type PaeeProposal, type PeiProposal, type PlanPart, type PlanProposal, type Review, type TraceStep,
} from "./schemas.ts";
import { firstAgentError, type AgentModel } from "./types.ts";

// O agente do PAEE propõe os quatro itens do art. 10 da Portaria MEC nº 421/2026,
// o agente do PEI os do art. 11 (com os nomes do Censo Escolar).

export const MAX_PLAN_REVIEWS = 2;

export const PLAN_AGENT_NAMES = {
  analista: "Analista do caso",
  paee: "Agente do PAEE",
  pei: "Agente do PEI",
  objetivos: "Planejador do PPI",
  revisor: "Revisor pedagógico",
} as const;

type Problem = Review["problemas"][number];

const replace = <T>() => Annotation<T>({ reducer: (_current: T, next: T) => next, default: () => null as T });

const PlanState = Annotation.Root({
  context: Annotation<string>(),
  analysis: replace<CaseAnalysis | null>(),
  // Canais com nome diferente dos nós ("paee", "pei"): o LangGraph não aceita o mesmo nome nos dois.
  paeeDraft: replace<PaeeProposal | null>(),
  peiDraft: replace<PeiProposal | null>(),
  objectives: replace<ObjectivesProposal | null>(),
  feedback: Annotation<Partial<Record<PlanPart, Problem[]>>>({ reducer: (_current, next) => next, default: () => ({}) }),
  redo: Annotation<PlanPart[]>({ reducer: (_current, next) => next, default: () => [] }),
  reviews: Annotation<number>({ reducer: (_current, next) => next, default: () => 0 }),
  trace: Annotation<TraceStep[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
});
type PlanStateType = typeof PlanState.State;

const DIMENSION_LABELS: Record<string, string> = {
  comunicacao: "comunicação", leitura: "leitura", escrita: "escrita", matematica: "matemática",
  interacao: "interação", autonomia: "autonomia", regulacao: "regulação",
};
const PART_LABEL: Record<PlanPart, string> = { paee: "PAEE", pei: "PEI", objetivos: "objetivos" };
const CLINICAL_TERMS = /\b(diagn[óo]stico|laudo|cid[- ]?\d|medica[çc][ãa]o|patologia|transtorno|s[íi]ndrome|d[ée]ficit cognitivo)\b/i;
const CLINICAL_PROBLEM = { problema: "Há linguagem clínica.", correcao: "Descreva o que o estudante faz e de que apoio precisa, sem termos clínicos." };

const optionLines = (fields: [string, readonly string[]][]) => fields.map(([field, options]) => `- ${field}: ${options.join("; ")}`).join("\n");
const PAEE_OPTIONS = optionLines([
  ["accessibilityResources", ACCESSIBILITY_RESOURCE_OPTIONS], ["assistiveTech", ASSISTIVE_TECH_OPTIONS],
  ["supportStaff", SUPPORT_STAFF_OPTIONS], ["networkDemands", NETWORK_DEMAND_OPTIONS],
]);
const PEI_OPTIONS = optionLines([
  ["aeeServices", AEE_SERVICE_OPTIONS], ["aeeStrategies", AEE_STRATEGY_OPTIONS], ["commonRoomStrategies", COMMON_ROOM_STRATEGY_OPTIONS],
  ["assessmentAccessibility", ASSESSMENT_ACCESSIBILITY_OPTIONS], ["monitoring", MONITORING_OPTIONS], ["familyFeedback", FAMILY_FEEDBACK_OPTIONS],
]);

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const outside = (items: string[], options: readonly string[]) => items.filter((item) => item.trim() && !options.some((option) => fold(option) === fold(item)));

export function checkPaee(paee: PaeeProposal): Problem[] {
  const problems: Problem[] = [];
  const unknown = outside(paee.supportStaff, SUPPORT_STAFF_OPTIONS);
  if (unknown.length) problems.push({ alvo: "PAEE: profissional de apoio", problema: `"${unknown.join('", "')}" não está na lista de profissionais.`, correcao: `Use só: ${SUPPORT_STAFF_OPTIONS.join("; ")}.` });
  if (CLINICAL_TERMS.test(Object.values(paee).flat().join(" "))) problems.push({ alvo: "PAEE", ...CLINICAL_PROBLEM });
  return problems;
}

export function checkPei(pei: PeiProposal): Problem[] {
  const problems: Problem[] = [];
  const unknown = outside(pei.aeeServices, AEE_SERVICE_OPTIONS);
  if (unknown.length) problems.push({ alvo: "PEI: atendimentos do AEE", problema: `"${unknown.join('", "')}" não é um tipo de atendimento do Censo Escolar.`, correcao: `Use só os nomes da lista: ${AEE_SERVICE_OPTIONS.join("; ")}.` });
  if (!pei.commonRoomStrategies.some((item) => item.trim())) problems.push({ alvo: "PEI: classe comum", problema: "Não há estratégias para a classe comum.", correcao: "Inclua estratégias que mantenham o estudante na aula com a turma." });
  if (!pei.monitoring.some((item) => item.trim())) problems.push({ alvo: "PEI: acompanhamento", problema: "Não diz como o plano será acompanhado.", correcao: "Proponha uma ou duas formas de acompanhar o plano." });
  if (!pei.familyFeedback.some((item) => item.trim())) problems.push({ alvo: "PEI: devolutiva", problema: "Não diz como a família recebe a devolutiva.", correcao: "Proponha como e quando a família recebe a devolutiva." });
  if (CLINICAL_TERMS.test(Object.values(pei).flat().join(" "))) problems.push({ alvo: "PEI", ...CLINICAL_PROBLEM });
  return problems;
}

export function checkObjectives(proposal: ObjectivesProposal): Problem[] {
  const problems: Problem[] = [];
  if (proposal.objectives.length < 1 || proposal.objectives.length > 3) {
    problems.push({ alvo: "objetivos", problema: `A proposta tem ${proposal.objectives.length} objetivos.`, correcao: "Proponha de 2 a 3 objetivos." });
  }
  proposal.objectives.forEach((objective, index) => {
    const alvo = `objetivo ${index + 1}`;
    // Lookahead em vez de \b: no JavaScript, \b não trata letras acentuadas como letras.
    if (!/^[a-zà-ú]+(á|ão)(?=\s|$)/i.test(objective.action.trim())) {
      problems.push({ alvo, problema: `A ação "${objective.action}" não começa com verbo no futuro.`, correcao: "Comece com verbo no futuro, sem o nome. Ex.: identificará..." });
    }
    if (!/\d/.test(objective.criterion)) {
      problems.push({ alvo, problema: `O critério "${objective.criterion}" não é mensurável.`, correcao: "Use números. Ex.: 4 de 5 tentativas." });
    }
    if (objective.targetSupport >= objective.currentSupport) {
      problems.push({ alvo, problema: "O apoio esperado não é menor que o atual.", correcao: "Defina um apoio esperado menor que o atual." });
    }
  });
  const allText = [...proposal.initialSituation, ...proposal.objectives.flatMap((objective) => [objective.action, objective.condition, objective.rationale])].join(" ");
  if (CLINICAL_TERMS.test(allText)) problems.push({ alvo: "objetivos", ...CLINICAL_PROBLEM });
  return problems;
}

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const cleanItems = (items: string[], limit: number) =>
  [...new Set(items.map((item) => item.replace(/;/g, ",").trim()).filter(Boolean))].slice(0, limit);

export function normalizePlanProposal(proposal: PlanProposal): PlanProposal {
  return {
    initialSituation: cleanItems(proposal.initialSituation, 8),
    commonRoomStrategies: canonicalItems(proposal.commonRoomStrategies, COMMON_ROOM_STRATEGY_OPTIONS),
    aeeStrategies: canonicalItems(proposal.aeeStrategies, AEE_STRATEGY_OPTIONS),
    accessibilityResources: canonicalItems(proposal.accessibilityResources, ACCESSIBILITY_RESOURCE_OPTIONS),
    assistiveTech: canonicalItems(proposal.assistiveTech ?? [], ASSISTIVE_TECH_OPTIONS),
    supportStaff: canonicalItems(proposal.supportStaff ?? [], SUPPORT_STAFF_OPTIONS, { strict: true }),
    networkDemands: canonicalItems(proposal.networkDemands ?? [], NETWORK_DEMAND_OPTIONS),
    aeeServices: canonicalItems(proposal.aeeServices ?? [], AEE_SERVICE_OPTIONS, { strict: true, limit: AEE_SERVICE_OPTIONS.length }),
    assessmentAccessibility: canonicalItems(proposal.assessmentAccessibility ?? [], ASSESSMENT_ACCESSIBILITY_OPTIONS),
    monitoring: canonicalItems(proposal.monitoring ?? [], MONITORING_OPTIONS, { limit: 4 }),
    familyFeedback: canonicalItems(proposal.familyFeedback ?? [], FAMILY_FEEDBACK_OPTIONS, { limit: 4 }),
    reviewWeeks: clamp(proposal.reviewWeeks, 4, 26, 12),
    objectives: proposal.objectives.slice(0, 3).map((objective) => {
      const currentSupport = clamp(objective.currentSupport, 0, 5, 3);
      const target = clamp(objective.targetSupport, 0, 5, currentSupport - 1);
      const action = objective.action.trim().replace(/[.;]+$/, "");
      return {
        ...objective,
        dimension: DIMENSION_KEYS.includes(objective.dimension) ? objective.dimension : "comunicacao",
        action: action.charAt(0).toLowerCase() + action.slice(1),
        condition: objective.condition.trim().replace(/[.;]+$/, ""),
        criterion: objective.criterion.trim().replace(/^em\s+/i, "").replace(/[.;]+$/, ""),
        deadlineWeeks: clamp(objective.deadlineWeeks, 2, 24, 8),
        currentSupport,
        targetSupport: target < currentSupport ? target : Math.max(0, currentSupport - 1),
        bnccCode: objective.bnccCode?.trim() || null,
      };
    }),
  };
}

const base = (state: PlanStateType) => `Informações do estudante:\n\n${state.context}\n\nAnálise do caso:\n${JSON.stringify(state.analysis)}`;
const problemLines = (problems: Problem[]) => problems.map((item) => `- [${item.alvo}] ${item.problema} Correção: ${item.correcao}`).join("\n");

function corrections(state: PlanStateType, part: PlanPart, previous: unknown) {
  const problems = state.feedback[part];
  return problems?.length && previous
    ? `\n\nA versão anterior foi devolvida pelo revisor. Corrija estes problemas:\n${problemLines(problems)}\n\nVersão anterior:\n${JSON.stringify(previous)}`
    : "";
}

export function buildPlanGraph(model: AgentModel) {
  return new StateGraph(PlanState)
    .addNode("analista", async (state: PlanStateType) => {
      const analysis = await model({
        agent: PLAN_AGENT_NAMES.analista, system: ANALYST_SYSTEM, schema: CaseAnalysisSchema, effort: "high",
        prompt: `Informações do estudante:\n\n${state.context}\n\nOrganize a análise do caso.`,
      });
      const priorities = analysis.prioridades.map((item) => DIMENSION_LABELS[item.dimension] ?? item.dimension).join(", ");
      return { analysis, trace: [{ agent: PLAN_AGENT_NAMES.analista, summary: `Leu o caso e priorizou: ${priorities || "sem prioridades definidas"}.` }] };
    })
    .addNode("paee", async (state: PlanStateType) => {
      const revision = corrections(state, "paee", state.paeeDraft);
      const paee = await model({
        agent: PLAN_AGENT_NAMES.paee, system: PAEE_SYSTEM, schema: PaeeProposalSchema, effort: "medium",
        prompt: `${base(state)}\n\nOpções de cada campo:\n${PAEE_OPTIONS}${revision}\n\nProponha o PAEE.`,
      });
      const filled = [paee.accessibilityResources, paee.assistiveTech, paee.supportStaff, paee.networkDemands].filter((items) => items.length).length;
      return { paeeDraft: paee, trace: [{ agent: PLAN_AGENT_NAMES.paee, summary: revision ? "Corrigiu o PAEE com base na revisão." : `Propôs o PAEE: ${filled} de 4 itens avaliados a partir do caso.` }] };
    })
    .addNode("pei", async (state: PlanStateType) => {
      const revision = corrections(state, "pei", state.peiDraft);
      const pei = await model({
        agent: PLAN_AGENT_NAMES.pei, system: PEI_SYSTEM, schema: PeiProposalSchema, effort: "medium",
        prompt: `${base(state)}\n\nOpções de cada campo:\n${PEI_OPTIONS}${revision}\n\nProponha o PEI.`,
      });
      return { peiDraft: pei, trace: [{ agent: PLAN_AGENT_NAMES.pei, summary: revision ? "Corrigiu o PEI com base na revisão." : `Propôs o PEI: ${pei.aeeServices.length} tipo(s) de atendimento do AEE, atividades, avaliação, acompanhamento e devolutiva.` }] };
    })
    .addNode("objetivos", async (state: PlanStateType) => {
      const revision = corrections(state, "objetivos", state.objectives);
      const objectives = await model({
        agent: PLAN_AGENT_NAMES.objetivos, system: PLANNER_SYSTEM, schema: ObjectivesProposalSchema, effort: "high",
        prompt: `${base(state)}${revision}\n\nProponha a situação inicial, o prazo de revisão e os objetivos.`,
      });
      return { objectives, trace: [{ agent: PLAN_AGENT_NAMES.objetivos, summary: revision ? "Corrigiu os objetivos com base na revisão." : `Propôs ${objectives.objectives.length} objetivos.` }] };
    })
    .addNode("revisor", async (state: PlanStateType) => {
      const paee = state.paeeDraft!;
      const pei = state.peiDraft!;
      const objectives = state.objectives!;
      const review = await model({
        agent: PLAN_AGENT_NAMES.revisor, system: PLAN_REVIEWER_SYSTEM, schema: PlanReviewSchema, effort: "medium",
        prompt: `${base(state)}\n\nOpções de cada campo:\n${PAEE_OPTIONS}\n${PEI_OPTIONS}\n\nProposta a revisar:\n${JSON.stringify({ paee, pei, objetivos: objectives })}`,
      });
      const fromModel = (part: PlanPart) => review.avaliacoes.filter((item) => item.parte === part && !item.aprovado).flatMap((item) => item.problemas);
      const checks: Record<PlanPart, Problem[]> = { paee: checkPaee(paee), pei: checkPei(pei), objetivos: checkObjectives(objectives) };
      const feedback: Partial<Record<PlanPart, Problem[]>> = {};
      for (const part of PLAN_PARTS) {
        const problems = [...fromModel(part), ...checks[part]];
        if (problems.length) feedback[part] = problems;
      }
      const rejected = PLAN_PARTS.filter((part) => feedback[part]?.length);
      const reviews = state.reviews + 1;
      const canRetry = reviews < MAX_PLAN_REVIEWS;
      const names = rejected.map((part) => PART_LABEL[part]).join(", ");
      return {
        feedback,
        redo: canRetry ? rejected : [],
        reviews,
        trace: [{
          agent: PLAN_AGENT_NAMES.revisor,
          summary: rejected.length === 0
            ? "Aprovou o PAEE, o PEI e os objetivos."
            : canRetry
              ? `Devolveu para correção: ${names}.`
              : `Ainda há pontos a conferir em: ${names}.`,
        }],
      };
    })
    .addNode("finalizar", async (state: PlanStateType) => {
      const pending = PLAN_PARTS.flatMap((part) => state.feedback[part] ?? []);
      return {
        trace: [{
          agent: "Finalização",
          summary: pending.length
            ? `Juntou o PAEE, o PEI e os objetivos e ajustou os valores. Ponto(s) para o professor conferir: ${pending.map((item) => item.problema).join(" ")}`
            : "Juntou o PAEE, o PEI e os objetivos, conferiu os nomes com as listas do formulário e deixou a proposta pronta para a revisão do professor.",
        }],
      };
    })
    .addEdge(START, "analista")
    .addEdge("analista", "paee")
    .addEdge("analista", "pei")
    .addEdge("analista", "objetivos")
    .addEdge("paee", "revisor")
    .addEdge("pei", "revisor")
    .addEdge("objetivos", "revisor")
    .addConditionalEdges("revisor", (state: PlanStateType) => (state.redo.length ? state.redo : "finalizar"), ["paee", "pei", "objetivos", "finalizar"])
    .addEdge("finalizar", END)
    .compile();
}

export async function runPlanAgents(context: string, model: AgentModel) {
  const result = await buildPlanGraph(model).invoke({ context }).catch((error: unknown) => { throw firstAgentError(error); });
  if (!result.analysis || !result.paeeDraft || !result.peiDraft || !result.objectives) throw new Error("Os agentes não completaram o PAEE, o PEI e os objetivos.");
  const proposal = normalizePlanProposal({ ...result.paeeDraft, ...result.peiDraft, ...result.objectives });
  return { proposal, analysis: result.analysis, trace: result.trace };
}
