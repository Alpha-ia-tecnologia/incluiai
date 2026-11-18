import "server-only";
import { db } from "./prisma";
import { assertStudentTeam, type SessionUser } from "./auth";
import { AUDIT_ACTION, PLAN_PROPOSAL_DETAIL, recordChange } from "./audit";
import { assertCaseStudyConcluded } from "./records";
import { invalidateStudent } from "./invalidate";
import { UserError } from "./user-error";
import { runAiJob } from "./agents/job";
import { loadPlanContext } from "./agents/context";
import { normalizePlanProposal, runPlanAgents } from "./agents/plan-graph";
import { proposePlanWithRules } from "./agents/plan-rules";
import type { CaseAnalysis, PlanProposal } from "./agents/schemas";
import type { AgentReport } from "./agents/types";

export async function proposePlan(user: SessionUser, studentId: string, report?: AgentReport) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  await assertCaseStudyConcluded(studentId);
  const { student, text, hasEnoughData } = await loadPlanContext(studentId);
  if (!hasEnoughData) {
    throw new UserError("Faça o estudo de caso ou preencha Como aprende antes de pedir uma proposta.");
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
  invalidateStudent(studentId);
  return { proposal, trace, source };
}
