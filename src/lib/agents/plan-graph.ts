import { ACCESSIBILITY_RESOURCE_OPTIONS, AEE_STRATEGY_OPTIONS, COMMON_ROOM_STRATEGY_OPTIONS } from "../form-options.ts";
import {
  AEE_SERVICE_OPTIONS, ASSESSMENT_ACCESSIBILITY_OPTIONS, ASSISTIVE_TECH_OPTIONS, FAMILY_FEEDBACK_OPTIONS, MONITORING_OPTIONS,
  NETWORK_DEMAND_OPTIONS, SUPPORT_STAFF_OPTIONS, canonicalItems, outsideOptions,
} from "../plan-documents.ts";
import { OBJECTIVES_PER_PLAN, OBJECTIVE_DEADLINE_WEEKS, hasClinicalTerm } from "../pedagogy-rules.ts";
import { DIMENSIONS } from "../scale.ts";
import { ANALYST_SYSTEM, PAEE_SYSTEM, PEI_SYSTEM, PLANNER_SYSTEM, PLAN_REVIEWER_SYSTEM } from "./prompts.ts";
import {
  CaseAnalysisSchema, DIMENSION_KEYS, ObjectivesProposalSchema, PLAN_PARTS, PaeeProposalSchema, PeiProposalSchema, PlanReviewSchema,
  type CaseAnalysis, type ObjectivesProposal, type PaeeProposal, type PeiProposal, type PlanPart, type PlanProblem, type PlanProposal,
} from "./schemas.ts";
import type { AgentModel } from "./types.ts";
import { PLAN_PIPELINE } from "./descriptors.ts";
import { runReviewedGraph, type ReviewedGraph } from "./reviewed-graph.ts";

// O agente do PAEE propõe os quatro itens do art. 10 da Portaria MEC nº 421/2026,
// o agente do PEI os do art. 11 (com os nomes do Censo Escolar).

const PART_LABEL: Record<PlanPart, string> = { paee: "PAEE", pei: "PEI", objetivos: "objetivos" };
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


export function checkPaee(paee: PaeeProposal): PlanProblem[] {
  const problems: PlanProblem[] = [];
  const unknown = outsideOptions(paee.supportStaff, SUPPORT_STAFF_OPTIONS);
  if (unknown.length) problems.push({ alvo: "PAEE: profissional de apoio", problema: `"${unknown.join('", "')}" não está na lista de profissionais.`, correcao: `Use só: ${SUPPORT_STAFF_OPTIONS.join("; ")}.` });
  if (hasClinicalTerm(Object.values(paee).flat().join(" "))) problems.push({ alvo: "PAEE", ...CLINICAL_PROBLEM });
  return problems;
}

export function checkPei(pei: PeiProposal): PlanProblem[] {
  const problems: PlanProblem[] = [];
  const unknown = outsideOptions(pei.aeeServices, AEE_SERVICE_OPTIONS);
  if (unknown.length) problems.push({ alvo: "PEI: atendimentos do AEE", problema: `"${unknown.join('", "')}" não é um tipo de atendimento do Censo Escolar.`, correcao: `Use só os nomes da lista: ${AEE_SERVICE_OPTIONS.join("; ")}.` });
  if (!pei.commonRoomStrategies.some((item) => item.trim())) problems.push({ alvo: "PEI: classe comum", problema: "Não há estratégias para a classe comum.", correcao: "Inclua estratégias que mantenham o estudante na aula com a turma." });
  if (!pei.monitoring.some((item) => item.trim())) problems.push({ alvo: "PEI: acompanhamento", problema: "Não diz como o plano será acompanhado.", correcao: "Proponha uma ou duas formas de acompanhar o plano." });
  if (!pei.familyFeedback.some((item) => item.trim())) problems.push({ alvo: "PEI: devolutiva", problema: "Não diz como a família recebe a devolutiva.", correcao: "Proponha como e quando a família recebe a devolutiva." });
  if (hasClinicalTerm(Object.values(pei).flat().join(" "))) problems.push({ alvo: "PEI", ...CLINICAL_PROBLEM });
  return problems;
}

export function checkObjectives(proposal: ObjectivesProposal): PlanProblem[] {
  const problems: PlanProblem[] = [];
  if (proposal.objectives.length < OBJECTIVES_PER_PLAN.min || proposal.objectives.length > OBJECTIVES_PER_PLAN.max) {
    problems.push({ alvo: "objetivos", problema: `A proposta tem ${proposal.objectives.length} objetivos.`, correcao: `Proponha de ${OBJECTIVES_PER_PLAN.min} a ${OBJECTIVES_PER_PLAN.max} objetivos.` });
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
  if (hasClinicalTerm(allText)) problems.push({ alvo: "objetivos", ...CLINICAL_PROBLEM });
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
    objectives: proposal.objectives.slice(0, OBJECTIVES_PER_PLAN.max).map((objective) => {
      const currentSupport = clamp(objective.currentSupport, 0, 5, 3);
      const target = clamp(objective.targetSupport, 0, 5, currentSupport - 1);
      const action = objective.action.trim().replace(/[.;]+$/, "");
      return {
        ...objective,
        dimension: DIMENSION_KEYS.includes(objective.dimension) ? objective.dimension : "comunicacao",
        action: action.charAt(0).toLowerCase() + action.slice(1),
        condition: objective.condition.trim().replace(/[.;]+$/, ""),
        criterion: objective.criterion.trim().replace(/^em\s+/i, "").replace(/[.;]+$/, ""),
        deadlineWeeks: clamp(objective.deadlineWeeks, OBJECTIVE_DEADLINE_WEEKS.min, OBJECTIVE_DEADLINE_WEEKS.max, 8),
        currentSupport,
        targetSupport: target < currentSupport ? target : Math.max(0, currentSupport - 1),
        bnccCode: objective.bnccCode?.trim() || null,
      };
    }),
  };
}

type PlanDrafts = { paee: PaeeProposal; pei: PeiProposal; objetivos: ObjectivesProposal };

const base = (context: string, analysis: CaseAnalysis) => `Informações do estudante:\n\n${context}\n\nAnálise do caso:\n${JSON.stringify(analysis)}`;

const PLAN_GRAPH: ReviewedGraph<string, PlanPart, PlanDrafts, CaseAnalysis, PlanProblem> = {
  pipeline: PLAN_PIPELINE,
  parts: PLAN_PARTS,
  prepare: async (context, model) => {
    const analysis = await model({
      agent: PLAN_PIPELINE.preparer, system: ANALYST_SYSTEM, schema: CaseAnalysisSchema, effort: "high",
      prompt: `Informações do estudante:\n\n${context}\n\nOrganize a análise do caso.`,
    });
    const priorities = analysis.prioridades.map((item) => DIMENSIONS[item.dimension]?.toLowerCase() ?? item.dimension).join(", ");
    return { prepared: analysis, summary: `Leu o caso e priorizou: ${priorities || "sem prioridades definidas"}.` };
  },
  write: async (part, { input, prepared, revision }, model) => {
    const common = base(input, prepared);
    if (part === "paee") {
      const paee = await model({
        agent: PLAN_PIPELINE.writers.paee, system: PAEE_SYSTEM, schema: PaeeProposalSchema, effort: "medium",
        prompt: `${common}\n\nOpções de cada campo:\n${PAEE_OPTIONS}${revision}\n\nProponha o PAEE.`,
      });
      const filled = [paee.accessibilityResources, paee.assistiveTech, paee.supportStaff, paee.networkDemands].filter((items) => items.length).length;
      return { draft: paee as PlanDrafts[typeof part], summary: revision ? "Corrigiu o PAEE com base na revisão." : `Propôs o PAEE: ${filled} de 4 itens avaliados a partir do caso.` };
    }
    if (part === "pei") {
      const pei = await model({
        agent: PLAN_PIPELINE.writers.pei, system: PEI_SYSTEM, schema: PeiProposalSchema, effort: "medium",
        prompt: `${common}\n\nOpções de cada campo:\n${PEI_OPTIONS}${revision}\n\nProponha o PEI.`,
      });
      return { draft: pei as PlanDrafts[typeof part], summary: revision ? "Corrigiu o PEI com base na revisão." : `Propôs o PEI: ${pei.aeeServices.length} tipo(s) de atendimento do AEE, atividades, avaliação, acompanhamento e devolutiva.` };
    }
    const objectives = await model({
      agent: PLAN_PIPELINE.writers.objetivos, system: PLANNER_SYSTEM, schema: ObjectivesProposalSchema, effort: "high",
      prompt: `${common}${revision}\n\nProponha a situação inicial, o prazo de revisão e os objetivos.`,
    });
    return { draft: objectives as PlanDrafts[typeof part], summary: revision ? "Corrigiu os objetivos com base na revisão." : `Propôs ${objectives.objectives.length} objetivos.` };
  },
  review: async ({ input, prepared, drafts }, model) => {
    const review = await model({
      agent: PLAN_PIPELINE.reviewer, system: PLAN_REVIEWER_SYSTEM, schema: PlanReviewSchema, effort: "medium",
      prompt: `${base(input, prepared)}\n\nOpções de cada campo:\n${PAEE_OPTIONS}\n${PEI_OPTIONS}\n\nProposta a revisar:\n${JSON.stringify({ paee: drafts.paee, pei: drafts.pei, objetivos: drafts.objetivos })}`,
    });
    return Object.fromEntries(PLAN_PARTS.map((part) => [part, review.avaliacoes.filter((item) => item.parte === part && !item.aprovado).flatMap((item) => item.problemas)]));
  },
  check: (part, draft) => (part === "paee" ? checkPaee(draft as PaeeProposal) : part === "pei" ? checkPei(draft as PeiProposal) : checkObjectives(draft as ObjectivesProposal)),
  problemLine: (item) => `[${item.alvo}] ${item.problema} Correção: ${item.correcao}`,
  partLabel: (part) => PART_LABEL[part],
  approved: "Aprovou o PAEE, o PEI e os objetivos.",
  finish: (feedback) => {
    const pending = PLAN_PARTS.flatMap((part) => feedback[part] ?? []);
    return pending.length
      ? `Juntou o PAEE, o PEI e os objetivos e ajustou os valores. Ponto(s) para o professor conferir: ${pending.map((item) => item.problema).join(" ")}`
      : "Juntou o PAEE, o PEI e os objetivos, conferiu os nomes com as listas do formulário e deixou a proposta pronta para a revisão do professor.";
  },
};

export async function runPlanAgents(context: string, model: AgentModel) {
  const result = await runReviewedGraph(PLAN_GRAPH, context, model);
  const { paee, pei, objetivos } = result.drafts;
  if (!result.prepared || !paee || !pei || !objetivos) throw new Error("Os agentes não completaram o PAEE, o PEI e os objetivos.");
  const proposal = normalizePlanProposal({ ...paee, ...pei, ...objetivos });
  return { proposal, analysis: result.prepared, trace: result.trace };
}
