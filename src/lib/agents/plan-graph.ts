import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { AgentModel } from "./model";
import { ANALYST_SYSTEM, PLANNER_SYSTEM, PLAN_REVIEWER_SYSTEM } from "./prompts";
import {
  CaseAnalysisSchema, DIMENSION_KEYS, PlanProposalSchema, ReviewSchema,
  type CaseAnalysis, type PlanProposal, type Review, type TraceStep,
} from "./schemas";

// Geração do PPI por agentes, orquestrada com LangGraph:
//
//   analista → planejador → revisor ─┬─ aprovado ou limite → finalizar → fim
//                   ↑                 └─ problemas → planejador (com correções)
//
// O revisor combina a avaliação do Claude com checagens determinísticas.

export const MAX_PLAN_REVIEWS = 2;

const replace = <T>() => Annotation<T>({ reducer: (_current: T, next: T) => next, default: () => null as T });

const PlanState = Annotation.Root({
  context: Annotation<string>(),
  analysis: replace<CaseAnalysis | null>(),
  proposal: replace<PlanProposal | null>(),
  review: replace<Review | null>(),
  reviews: Annotation<number>({ reducer: (_current, next) => next, default: () => 0 }),
  trace: Annotation<TraceStep[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
});
type PlanStateType = typeof PlanState.State;

const DIMENSION_LABELS: Record<string, string> = {
  comunicacao: "comunicação", leitura: "leitura", escrita: "escrita", matematica: "matemática",
  interacao: "interação", autonomia: "autonomia", regulacao: "regulação",
};
const CLINICAL_TERMS = /\b(diagn[óo]stico|laudo|cid[- ]?\d|medica[çc][ãa]o|patologia|transtorno|s[íi]ndrome|d[ée]ficit cognitivo)\b/i;

// Checagens que não dependem do modelo: garantem o formato da frase do objetivo.
export function checkPlanProposal(proposal: PlanProposal): Review["problemas"] {
  const problems: Review["problemas"] = [];
  if (proposal.objectives.length < 1 || proposal.objectives.length > 3) {
    problems.push({ alvo: "objetivos", problema: `A proposta tem ${proposal.objectives.length} objetivos.`, correcao: "Proponha de 2 a 3 objetivos." });
  }
  if (proposal.commonRoomStrategies.length === 0) {
    problems.push({ alvo: "estratégias da sala comum", problema: "Não há estratégias para a sala comum.", correcao: "Inclua estratégias que mantenham o estudante na aula com a turma." });
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
  const allText = [
    ...proposal.initialSituation, ...proposal.commonRoomStrategies, ...proposal.aeeStrategies,
    ...proposal.objectives.flatMap((objective) => [objective.action, objective.condition, objective.rationale]),
  ].join(" ");
  if (CLINICAL_TERMS.test(allText)) {
    problems.push({ alvo: "texto da proposta", problema: "Há linguagem clínica.", correcao: "Descreva o que o estudante faz e de que apoio precisa, sem termos clínicos." });
  }
  return problems;
}

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const cleanItems = (items: string[], limit: number) =>
  [...new Set(items.map((item) => item.replace(/;/g, ",").trim()).filter(Boolean))].slice(0, limit);

// Ajustes finais (sem IA): limites da escala, prazos e formato dos itens.
export function normalizePlanProposal(proposal: PlanProposal): PlanProposal {
  return {
    initialSituation: cleanItems(proposal.initialSituation, 8),
    commonRoomStrategies: cleanItems(proposal.commonRoomStrategies, 8),
    aeeStrategies: cleanItems(proposal.aeeStrategies, 8),
    accessibilityResources: cleanItems(proposal.accessibilityResources, 8),
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

export function buildPlanGraph(model: AgentModel) {
  return new StateGraph(PlanState)
    .addNode("analista", async (state: PlanStateType) => {
      const analysis = await model({
        agent: "Analista do caso", system: ANALYST_SYSTEM, schema: CaseAnalysisSchema, effort: "high",
        prompt: `Informações do estudante:\n\n${state.context}\n\nOrganize a análise do caso.`,
      });
      const priorities = analysis.prioridades.map((item) => DIMENSION_LABELS[item.dimension] ?? item.dimension).join(", ");
      return { analysis, trace: [{ agent: "Analista do caso", summary: `Leu o caso e priorizou: ${priorities || "sem prioridades definidas"}.` }] };
    })
    .addNode("planejador", async (state: PlanStateType) => {
      const corrections = state.review && !state.review.aprovado
        ? `\n\nA versão anterior foi devolvida pelo revisor. Corrija estes problemas:\n${state.review.problemas.map((item) => `- [${item.alvo}] ${item.problema} Correção: ${item.correcao}`).join("\n")}\n\nVersão anterior:\n${JSON.stringify(state.proposal)}`
        : "";
      const proposal = await model({
        agent: "Planejador do PPI", system: PLANNER_SYSTEM, schema: PlanProposalSchema, effort: "high",
        prompt: `Informações do estudante:\n\n${state.context}\n\nAnálise do caso:\n${JSON.stringify(state.analysis)}${corrections}\n\nProponha o plano.`,
      });
      const version = state.reviews + 1;
      return {
        proposal,
        trace: [{ agent: "Planejador do PPI", summary: version === 1 ? `Propôs ${proposal.objectives.length} objetivos e as estratégias do plano.` : `Corrigiu a proposta (versão ${version}) com base na revisão.` }],
      };
    })
    .addNode("revisor", async (state: PlanStateType) => {
      const proposal = state.proposal!;
      const review = await model({
        agent: "Revisor pedagógico", system: PLAN_REVIEWER_SYSTEM, schema: ReviewSchema, effort: "medium",
        prompt: `Informações do estudante:\n\n${state.context}\n\nAnálise do caso:\n${JSON.stringify(state.analysis)}\n\nProposta a revisar:\n${JSON.stringify(proposal)}`,
      });
      const problems = [...review.problemas, ...checkPlanProposal(proposal)];
      const approved = review.aprovado && problems.length === 0;
      return {
        review: { aprovado: approved, problemas: problems },
        reviews: state.reviews + 1,
        trace: [{ agent: "Revisor pedagógico", summary: approved ? "Aprovou a proposta." : `Devolveu a proposta com ${problems.length} ponto(s) a corrigir.` }],
      };
    })
    .addNode("finalizar", async (state: PlanStateType) => {
      const pending = state.review && !state.review.aprovado ? state.review.problemas : [];
      return {
        proposal: normalizePlanProposal(state.proposal!),
        trace: [{
          agent: "Finalização",
          summary: pending.length
            ? `Ajustou os valores do plano. Ponto(s) para o professor conferir: ${pending.map((item) => item.problema).join(" ")}`
            : "Ajustou os valores do plano e deixou a proposta pronta para a revisão do professor.",
        }],
      };
    })
    .addEdge(START, "analista")
    .addEdge("analista", "planejador")
    .addEdge("planejador", "revisor")
    .addConditionalEdges(
      "revisor",
      (state: PlanStateType) => (state.review?.aprovado || state.reviews >= MAX_PLAN_REVIEWS ? "finalizar" : "planejador"),
      ["finalizar", "planejador"],
    )
    .addEdge("finalizar", END)
    .compile();
}

export async function runPlanAgents(context: string, model: AgentModel) {
  const result = await buildPlanGraph(model).invoke({ context });
  return { proposal: result.proposal!, analysis: result.analysis!, trace: result.trace };
}
