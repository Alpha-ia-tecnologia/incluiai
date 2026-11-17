import type { ActivityCard } from "../activity-engine";
import type { AdaptationRule } from "../rules";
import { ACTIVITY_CONTEXTS, checkActivity, studentAdaptations, type ActivityContext } from "../pedagogy-rules.ts";
import { ACTIVITY_AGENT_SYSTEM, ACTIVITY_REVIEWER_SYSTEM, adaptationRulesText } from "./prompts.ts";
import { ActivityReviewSchema, AgentCardSchema, type AgentCard } from "./schemas.ts";
import { ACTIVITY_PIPELINE } from "./descriptors.ts";
import { runReviewedGraph, type ReviewedGraph } from "./reviewed-graph.ts";
import type { AgentModel } from "./types.ts";

type ActivityInput = {
  context: string;
  rules: AdaptationRule[];
  taskToleranceMinutes: number;
};

const ACTIVITY_GRAPH: ReviewedGraph<ActivityInput, ActivityContext, Record<ActivityContext, AgentCard>, null, string> = {
  pipeline: ACTIVITY_PIPELINE,
  parts: ACTIVITY_CONTEXTS,
  write: async (context, { input, revision }, model) => {
    const card = await model({
      agent: ACTIVITY_PIPELINE.writers[context], system: ACTIVITY_AGENT_SYSTEM[context], schema: AgentCardSchema, effort: "medium",
      prompt: `${input.context}\n\nRegras de adaptação obrigatórias:\n${adaptationRulesText(input.rules)}${revision}\n\nCrie a atividade.`,
    });
    return { draft: card, summary: revision ? `Refez "${card.title}" com as correções do revisor.` : `Propôs "${card.title}".` };
  },
  review: async ({ input, drafts }, model) => {
    const review = await model({
      agent: ACTIVITY_PIPELINE.reviewer, system: ACTIVITY_REVIEWER_SYSTEM, schema: ActivityReviewSchema, effort: "medium",
      prompt: `${input.context}\n\nRegras de adaptação obrigatórias:\n${adaptationRulesText(input.rules)}\n\nAtividades a revisar:\n${JSON.stringify(drafts)}`,
    });
    return Object.fromEntries(ACTIVITY_CONTEXTS.map((context) => {
      const verdict = review.avaliacoes.find((item) => item.context === context);
      return [context, verdict && !verdict.aprovado ? verdict.problemas : []];
    }));
  },
  check: (context, card, { input }) => checkActivity({ ...card, context }, input.taskToleranceMinutes),
  partLabel: (context) => ACTIVITY_PIPELINE.writers[context],
  approved: "Aprovou as três atividades.",
  finish: () => "Aplicou as regras de adaptação a cada atividade e deixou as sugestões pendentes de decisão do professor.",
};

export async function runActivityAgents(input: ActivityInput, model: AgentModel) {
  const result = await runReviewedGraph(ACTIVITY_GRAPH, input, model);
  const adaptations = studentAdaptations(input.rules).map((rule) => ({ text: rule.then, rule: rule.id }));
  const cards: ActivityCard[] = ACTIVITY_CONTEXTS.filter((context) => result.drafts[context]).map((context) => {
    const card = result.drafts[context]!;
    return {
      title: card.title.trim(),
      context,
      durationMinutes: Math.min(60, Math.max(3, Math.round(card.durationMinutes) || 10)),
      materials: card.materials.map((item) => item.trim()).filter(Boolean),
      steps: card.steps.map((item) => item.trim()).filter(Boolean),
      responseForm: card.responseForm,
      adaptations: context === "casa" ? adaptations.slice(0, 2) : adaptations,
      supportBelow: card.supportBelow,
      supportTarget: card.supportTarget,
      supportAbove: card.supportAbove,
      successCriterion: card.successCriterion,
      planB: card.planB,
      classParticipation: context === "sala_comum" ? card.classParticipation ?? undefined : undefined,
      reviewNotes: result.feedback[context] ?? [],
      source: "ia",
    };
  });
  if (cards.length !== 3) throw new Error("Os agentes não completaram as três atividades.");
  return { cards, trace: result.trace };
}
