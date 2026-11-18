import type { DiaryEntry, Objective, Plan } from "@prisma/client";
import { splitItems } from "./format";
import type { Trend } from "./scale";
import { alertsFor, type StudentAlert } from "./student-alerts";
import { objectiveSupportTrend, trendMessage, type SupportTrend } from "./support-trend";

export interface ObjectiveInsight extends SupportTrend {
  objectiveId: string;
  trend: Trend;
  lastSupportLevels: number[];
  message: string;
}

export function objectiveTrend(objective: Objective, entries: DiaryEntry[]): ObjectiveInsight {
  const reading = objectiveSupportTrend(objective, entries);
  return { ...reading, objectiveId: objective.id, lastSupportLevels: reading.levels.slice(-4), message: trendMessage(reading, reading.lessons) };
}

export { ALERTS, PLAN_MISSING, type StudentAlert } from "./student-alerts";

export function studentAlerts(input: { plans: (Plan & { objectives: Objective[] })[]; entries: DiaryEntry[]; now?: Date }): StudentAlert[] {
  const plan = input.plans.find((item) => item.status === "ativo");
  const trends = (plan?.objectives ?? []).filter((objective) => objective.status === "ativo").map((objective) => ({ objectiveId: objective.id, trend: objectiveTrend(objective, input.entries).trend }));
  return alertsFor({ ...input, trends });
}

export function strategiesThatWorked(entries: DiaryEntry[]): string[] {
  const seen = new Set<string>();
  for (const e of entries) {
    for (const w of splitItems(e.whatWorked)) seen.add(w);
  }
  return [...seen].slice(0, 8);
}
