import type { DiaryEntry, Objective, Plan } from "@prisma/client";
import { splitItems } from "./format";
import type { Trend } from "./scale";
import { alertsFor, type StudentAlert } from "./student-alerts";

export interface ObjectiveInsight {
  objectiveId: string;
  trend: Trend;
  lastSupportLevels: number[];
  message: string;
}

export function objectiveTrend(objective: Objective, entries: DiaryEntry[]): ObjectiveInsight {
  const related = entries
    .filter((e) => e.objectiveId === objective.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (related.length === 0) {
    return {
      objectiveId: objective.id,
      trend: "sem_dados",
      lastSupportLevels: [],
      message: "Sem registros ainda. Aplique uma atividade e registre em 3 toques.",
    };
  }

  const last = related.slice(-4);
  const levels = last.map((e) => e.supportLevel);
  const first = levels[0];
  const latest = levels[levels.length - 1];

  if (latest < first || latest <= objective.targetSupport) {
    return {
      objectiveId: objective.id,
      trend: "avancando",
      lastSupportLevels: levels,
      message: "Nível de apoio em redução. Considere subir um degrau (menos apoio ou mais itens).",
    };
  }

  const noProgress = levels.length >= 3 && levels.every((l) => l >= first);
  if (noProgress) {
    return {
      objectiveId: objective.id,
      trend: "atencao",
      lastSupportLevels: levels,
      message: "3 ciclos sem avanço. Talvez o próximo passo esteja grande demais: quer fracionar o objetivo?",
    };
  }

  return {
    objectiveId: objective.id,
    trend: "estavel",
    lastSupportLevels: levels,
    message: "Desempenho estável. Mantenha o nível de apoio atual e varie o contexto.",
  };
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
