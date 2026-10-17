import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ActivityCard } from "../activity-engine";
import type { AdaptationRule } from "../rules";
import type { AgentModel } from "./model";
import { ACTIVITY_AGENT_SYSTEM, ACTIVITY_REVIEWER_SYSTEM } from "./prompts";
import {
  ActivityReviewSchema, AgentCardSchema, CONTEXT_KEYS,
  type ActivityContext, type AgentCard, type TraceStep,
} from "./schemas";

// Geração de atividades por agentes, orquestrada com LangGraph:
//
//        ┌→ sala_comum ┐
//   início → aee ───────→ revisor ─┬─ tudo aprovado ou limite → finalizar → fim
//        └→ casa ──────┘    ↑      └─ reprovadas → refaz só essas, em paralelo
//
// Os três especialistas trabalham em paralelo; o revisor combina a avaliação
// do Claude com checagens determinísticas das regras da plataforma.

export const MAX_ACTIVITY_RETRIES = 1;

export type ActivityGraphInput = {
  context: string;
  rules: AdaptationRule[];
  taskToleranceMinutes: number;
};

const AGENT_NAMES: Record<ActivityContext, string> = {
  sala_comum: "Agente da sala comum",
  aee: "Agente do AEE",
  casa: "Agente da família",
};

const ActivityState = Annotation.Root({
  context: Annotation<string>(),
  rules: Annotation<AdaptationRule[]>(),
  taskToleranceMinutes: Annotation<number>(),
  // Os especialistas escrevem em paralelo: cada um acrescenta sua atividade.
  cards: Annotation<Partial<Record<ActivityContext, AgentCard>>>({ reducer: (current, next) => ({ ...current, ...next }), default: () => ({}) }),
  feedback: Annotation<Partial<Record<ActivityContext, string[]>>>({ reducer: (_current, next) => next, default: () => ({}) }),
  redo: Annotation<ActivityContext[]>({ reducer: (_current, next) => next, default: () => [] }),
  rounds: Annotation<number>({ reducer: (_current, next) => next, default: () => 0 }),
  trace: Annotation<TraceStep[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
});
type ActivityStateType = typeof ActivityState.State;

function rulesText(rules: AdaptationRule[]) {
  return rules.map((rule) => `- [${rule.id}] ${rule.then}`).join("\n");
}

// Checagens que não dependem do modelo.
export function checkCard(context: ActivityContext, card: AgentCard, toleranceMinutes: number): string[] {
  const problems: string[] = [];
  const limit = context === "casa" ? Math.min(10, toleranceMinutes || 10) : toleranceMinutes || 25;
  if (card.durationMinutes > limit) {
    problems.push(`A duração (${card.durationMinutes} min) passa do limite de ${limit} min. Reduza a atividade.`);
  }
  if (card.steps.length < 3 || card.steps.length > 6) {
    problems.push(`A atividade tem ${card.steps.length} passos. Use de 3 a 6 passos.`);
  }
  const longSteps = card.steps.filter((step) => step.split(/\s+/).length > 30);
  if (longSteps.length) problems.push("Há passos longos demais. Escreva uma ação por passo.");
  if (context === "sala_comum" && !card.classParticipation?.trim()) {
    problems.push("Falta descrever como a turma participa junto (classParticipation).");
  }
  if (context === "casa" && /\b(compr(ar|e|ado)|loja|papelaria)\b/i.test(card.materials.join(" "))) {
    problems.push("Em casa, use apenas objetos que a família já tem, sem compras.");
  }
  return problems;
}

function cardAgent(model: AgentModel, context: ActivityContext) {
  return async (state: ActivityStateType) => {
    const previous = state.cards[context];
    const feedback = state.feedback[context];
    const revision = feedback?.length && previous
      ? `\n\nSua atividade anterior foi devolvida pelo revisor. Corrija:\n${feedback.map((item) => `- ${item}`).join("\n")}\n\nAtividade anterior:\n${JSON.stringify(previous)}`
      : "";
    const card = await model({
      agent: AGENT_NAMES[context], system: ACTIVITY_AGENT_SYSTEM[context], schema: AgentCardSchema, effort: "medium",
      prompt: `${state.context}\n\nRegras de adaptação obrigatórias:\n${rulesText(state.rules) || "- Nenhuma regra específica."}${revision}\n\nCrie a atividade.`,
    });
    return {
      cards: { [context]: card },
      trace: [{ agent: AGENT_NAMES[context], summary: revision ? `Refez "${card.title}" com as correções do revisor.` : `Propôs "${card.title}".` }],
    };
  };
}

function finalizeCards(state: ActivityStateType): ActivityCard[] {
  const adaptations = state.rules
    .filter((rule) => rule.id !== "R00-ANTISSEGREGACAO")
    .map((rule) => ({ text: rule.then, rule: rule.id }));
  return CONTEXT_KEYS.filter((context) => state.cards[context]).map((context) => {
    const card = state.cards[context]!;
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
      // Problemas que continuaram depois da correção: o professor confere.
      reviewNotes: state.feedback[context] ?? [],
      source: "ia" as const,
    };
  });
}

export function buildActivityGraph(model: AgentModel) {
  return new StateGraph(ActivityState)
    .addNode("sala_comum", cardAgent(model, "sala_comum"))
    .addNode("aee", cardAgent(model, "aee"))
    .addNode("casa", cardAgent(model, "casa"))
    .addNode("revisor", async (state: ActivityStateType) => {
      const review = await model({
        agent: "Revisor das atividades", system: ACTIVITY_REVIEWER_SYSTEM, schema: ActivityReviewSchema, effort: "medium",
        prompt: `${state.context}\n\nRegras de adaptação obrigatórias:\n${rulesText(state.rules) || "- Nenhuma regra específica."}\n\nAtividades a revisar:\n${JSON.stringify(state.cards)}`,
      });
      const feedback: Partial<Record<ActivityContext, string[]>> = {};
      for (const context of CONTEXT_KEYS) {
        const card = state.cards[context];
        if (!card) continue;
        const fromModel = review.avaliacoes.find((item) => item.context === context);
        const problems = [
          ...(fromModel && !fromModel.aprovado ? fromModel.problemas : []),
          ...checkCard(context, card, state.taskToleranceMinutes),
        ];
        if (problems.length) feedback[context] = problems;
      }
      const rejected = CONTEXT_KEYS.filter((context) => feedback[context]?.length);
      const canRetry = state.rounds < MAX_ACTIVITY_RETRIES;
      return {
        feedback,
        redo: canRetry ? rejected : [],
        rounds: state.rounds + 1,
        trace: [{
          agent: "Revisor das atividades",
          summary: rejected.length === 0
            ? "Aprovou as três atividades."
            : canRetry
              ? `Devolveu ${rejected.length} atividade(s) para correção: ${rejected.map((context) => AGENT_NAMES[context]).join(", ")}.`
              : `Ainda há pontos a conferir em ${rejected.length} atividade(s); o professor decide na revisão.`,
        }],
      };
    })
    .addNode("finalizar", async () => ({
      trace: [{ agent: "Finalização", summary: "Aplicou as regras de adaptação a cada atividade e deixou as sugestões pendentes de decisão do professor." }],
    }))
    .addEdge(START, "sala_comum")
    .addEdge(START, "aee")
    .addEdge(START, "casa")
    .addEdge("sala_comum", "revisor")
    .addEdge("aee", "revisor")
    .addEdge("casa", "revisor")
    .addConditionalEdges(
      "revisor",
      (state: ActivityStateType) => (state.redo.length ? state.redo : "finalizar"),
      ["sala_comum", "aee", "casa", "finalizar"],
    )
    .addEdge("finalizar", END)
    .compile();
}

export async function runActivityAgents(input: ActivityGraphInput, model: AgentModel) {
  const result = await buildActivityGraph(model).invoke(input);
  const cards = finalizeCards(result);
  if (cards.length !== 3) throw new Error("Os agentes não completaram as três atividades.");
  return { cards, trace: result.trace };
}
