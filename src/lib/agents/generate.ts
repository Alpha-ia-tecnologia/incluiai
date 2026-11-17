import { db } from "../prisma";
import { AUDIT_ACTION, PLAN_PROPOSAL_DETAIL, recordChange } from "../audit";
import { assertCaseStudyConcluded } from "../records";
import type { SessionUser } from "../auth";
import { activityRow, generateActivityCards, type ActivityCard, type EngineInput } from "../activity-engine";
import { applicableRules } from "../rules";
import { runAiJob } from "./job";
import { activityContextText, loadPlanContext } from "./context";
import { normalizePlanProposal, runPlanAgents } from "./plan-graph";
import { proposePlanWithRules } from "./plan-rules";
import { runActivityAgents } from "./activity-graph";
import type { CaseAnalysis, PlanProposal } from "./schemas";
import type { AgentReport } from "./types";

export async function createPlanDraft(studentId: string, user: SessionUser, report?: AgentReport) {
  const prisma = await db();
  await assertCaseStudyConcluded(studentId);
  const { student, text, hasEnoughData } = await loadPlanContext(studentId);
  if (!hasEnoughData) {
    throw new Error("Faça o estudo de caso ou preencha Como aprende antes de pedir uma proposta.");
  }

  const { value, source, trace } = await runAiJob<{ proposal: PlanProposal; analysis: CaseAnalysis | null }>({
    task: "proposta de plano",
    madeByRules: "A proposta foi feita",
    scope: { student: studentId },
    student: studentId,
    report,
    run: (model) => runPlanAgents(text, model),
    rules: () => ({ proposal: normalizePlanProposal(proposePlanWithRules(student.profile, student.caseStudy)), analysis: null }),
  });
  const { proposal, analysis } = value;

  const data = {
    content: JSON.stringify(proposal),
    analysis: analysis ? JSON.stringify(analysis) : null,
    trace: JSON.stringify(trace),
    source,
    createdBy: user.name,
  };
  await prisma.planDraft.upsert({ where: { studentId }, create: { studentId, ...data }, update: { ...data, createdAt: new Date() } });
  await recordChange(user, studentId, AUDIT_ACTION.created, PLAN_PROPOSAL_DETAIL[source]);
  return { proposal, analysis, trace, source };
}

export async function buildActivityCards(input: EngineInput, report?: AgentReport): Promise<ActivityCard[]> {
  const { value } = await runAiJob<{ cards: ActivityCard[] }>({
    task: "atividades",
    scope: { student: input.student.id },
    student: input.student.id,
    report,
    run: async (model) => {
      const prisma = await db();
      const entries = await prisma.diaryEntry.findMany({ where: { studentId: input.student.id }, orderBy: { date: "asc" } });
      return runActivityAgents({
        context: activityContextText({ ...input, entries }),
        rules: applicableRules(input.profile),
        taskToleranceMinutes: input.profile.taskToleranceMinutes,
      }, model);
    },
    rules: () => ({ cards: generateActivityCards(input) }),
  });
  return value.cards;
}

export async function saveSuggestedActivities(studentId: string, objectiveId: string, cards: ActivityCard[]) {
  const prisma = await db();
  return prisma.activity.createManyAndReturn({
    select: { id: true, title: true, context: true },
    data: cards.map((card) => ({ studentId, objectiveId, ...activityRow(card) })),
  });
}
