import { db } from "../prisma";
import { activityRow, generateActivityCards, type ActivityCard, type EngineInput } from "../activity-engine";
import { applicableRules } from "../rules";
import { runAiJob } from "./job";
import { activityContextText } from "./context";
import { runActivityAgents } from "./activity-graph";
import type { AgentReport } from "./types";

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
