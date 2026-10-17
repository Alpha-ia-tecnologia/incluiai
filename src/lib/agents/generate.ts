import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { assertCaseStudyConcluded } from "../records";
import type { SessionUser } from "../auth";
import { generateActivityCards, type ActivityCard, type EngineInput } from "../activity-engine";
import { applicableRules } from "../rules";
import { AgentOutputError, createAgentModel, isAIEnabled } from "./model";
import { DeepSeekAPIError } from "./deepseek";
import { recordDeepSeekUse } from "./audit";
import { loadAnonymizer } from "./anonymize";
import { activityContextText, loadPlanContext } from "./context";
import { normalizePlanProposal, runPlanAgents } from "./plan-graph";
import { proposePlanWithRules } from "./plan-rules";
import { runActivityAgents } from "./activity-graph";
import type { CaseAnalysis, PlanProposal, TraceStep } from "./schemas";
import type { AgentModel, AgentProgress } from "./types";

export type AgentReport = (progress: AgentProgress) => void;

// Avisa quem pediu (a tela do assistente) quando cada agente começa e termina.
// Os formulários chamam sem `report` e nada muda para eles.
function reporting(model: AgentModel, report?: AgentReport): AgentModel {
  if (!report) return model;
  return async (request) => {
    report({ agent: request.agent, phase: "start" });
    try {
      const result = await model(request);
      report({ agent: request.agent, phase: "end" });
      return result;
    } catch (error) {
      report({ agent: request.agent, phase: "fail" });
      throw error;
    }
  };
}

// Geração de propostas, usada pelos formulários e pelo assistente. A IA
// (agentes com LangGraph) entra quando há chave; o motor de regras responde
// quando ela está desligada ou falha. Nada aqui vira plano ou atividade
// aplicada: tudo nasce como proposta para a decisão do professor.

export function describeAgentError(error: unknown) {
  if (error instanceof AgentOutputError) return error.message;
  if (error instanceof DeepSeekAPIError) return error.message;
  if (error instanceof Anthropic.RateLimitError) return "limite de uso da API atingido";
  if (error instanceof Anthropic.AuthenticationError) return "chave da API inválida";
  if (error instanceof Anthropic.APIConnectionError) return "sem conexão com a API";
  if (error instanceof Anthropic.APIError) return `erro ${error.status} da API`;
  return "erro inesperado";
}

// Prepara uma proposta de PPI e a guarda como rascunho em PlanDraft.
export async function createPlanDraft(studentId: string, user: SessionUser, report?: AgentReport) {
  // A proposta de plano (IA ou regras) também exige o estudo de caso concluído (CA02).
  await assertCaseStudyConcluded(studentId);
  const { student, text, hasEnoughData } = await loadPlanContext(studentId);
  if (!hasEnoughData) {
    throw new Error("Faça o estudo de caso ou preencha Como aprende antes de pedir uma proposta.");
  }

  let proposal: PlanProposal | null = null;
  let analysis: CaseAnalysis | null = null;
  let trace: TraceStep[] = [];
  let source: "ia" | "regras" = "regras";

  if (isAIEnabled()) {
    const anonymizer = await loadAnonymizer(studentId);
    const agents = createAgentModel(anonymizer);
    try {
      const result = await runPlanAgents(text, reporting(agents.model, report));
      ({ proposal, analysis, trace } = result);
      const note = anonymizer.summary();
      trace = [{ agent: "Anonimização", summary: note ?? "Nenhuma informação pessoal encontrada nos textos enviados à IA." }, ...trace];
      source = "ia";
    } catch (error) {
      console.error("[agentes] geração do plano falhou:", error);
      report?.({ agent: "Motor de regras", phase: "start" });
      trace = [{ agent: "Agentes de IA", summary: `Indisponíveis no momento (${describeAgentError(error)}). A proposta foi feita pelo motor de regras.` }];
    }
    await recordDeepSeekUse(studentId, agents.deepseekAgents(), trace);
  } else {
    report?.({ agent: "Motor de regras", phase: "start" });
    trace = [{ agent: "Motor de regras", summary: "A IA está desligada nesta instalação. A proposta foi feita pelas regras da plataforma." }];
  }
  if (!proposal) {
    proposal = normalizePlanProposal(proposePlanWithRules(student.profile, student.caseStudy));
  }

  const data = {
    content: JSON.stringify(proposal),
    analysis: analysis ? JSON.stringify(analysis) : null,
    trace: JSON.stringify(trace),
    source,
    createdBy: user.name,
  };
  await prisma.planDraft.upsert({ where: { studentId }, create: { studentId, ...data }, update: { ...data, createdAt: new Date() } });
  await prisma.accessLog.create({
    data: { studentId, actor: user.name, role: user.role, action: "criou", detail: source === "ia" ? "Proposta de plano (agentes de IA)" : "Proposta de plano (regras)" },
  });
  return { proposal, analysis, trace, source };
}

// Os 3 cartões (sala comum / AEE / casa) para um objetivo.
export async function buildActivityCards(input: EngineInput, report?: AgentReport): Promise<ActivityCard[]> {
  if (isAIEnabled()) {
    const anonymizer = await loadAnonymizer(input.student.id);
    const agents = createAgentModel(anonymizer);
    try {
      const entries = await prisma.diaryEntry.findMany({ where: { studentId: input.student.id }, orderBy: { date: "asc" } });
      const { cards } = await runActivityAgents({
        context: activityContextText({ ...input, entries }),
        rules: applicableRules(input.profile),
        taskToleranceMinutes: input.profile.taskToleranceMinutes,
      }, reporting(agents.model, report));
      const note = anonymizer.summary();
      if (note) console.info(`[agentes] ${note}`);
      return cards;
    } catch (error) {
      console.error("[agentes] geração de atividades falhou; usando o motor de regras:", error);
    } finally {
      await recordDeepSeekUse(input.student.id, agents.deepseekAgents());
    }
  }
  report?.({ agent: "Motor de regras", phase: "start" });
  return generateActivityCards(input);
}

// Guarda os cartões como "sugerida": a decisão continua com o professor.
export async function saveSuggestedActivities(studentId: string, objectiveId: string, cards: ActivityCard[]) {
  return prisma.activity.createManyAndReturn({
    select: { id: true, title: true, context: true },
    data: cards.map((c) => ({
      studentId,
      objectiveId,
      title: c.title,
      context: c.context,
      durationMinutes: c.durationMinutes,
      materials: JSON.stringify(c.materials),
      steps: JSON.stringify(c.steps),
      responseForm: c.responseForm,
      adaptations: JSON.stringify(c.adaptations),
      supportBelow: c.supportBelow,
      supportTarget: c.supportTarget,
      supportAbove: c.supportAbove,
      successCriterion: c.successCriterion,
      planB: c.planB,
      classParticipation: c.classParticipation ?? null,
      reviewNotes: c.reviewNotes?.length ? JSON.stringify(c.reviewNotes) : null,
      status: "sugerida",
      source: c.source,
    })),
  });
}
