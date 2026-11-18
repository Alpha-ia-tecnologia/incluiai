import type { DiaryEntry, Objective, Plan } from "@prisma/client";
import { DAY_MS, isPastDay } from "./dates";
import { splitItems } from "./format";
import type { Term, Trend } from "./scale";

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

export interface StudentAlert {
  kind: "sem_registro" | "plano_vencido" | "sem_plano" | "queda_participacao";
  message: string;
}

const MAX_DAYS_WITHOUT_ENTRY = 7;

export const ALERTS: Record<StudentAlert["kind"], Term> = {
  sem_plano: { label: "Sem plano individual ativo", short: "Sem plano", tone: "alert" },
  plano_vencido: { label: "Plano com revisão vencida", short: "Revisão vencida", tone: "alert" },
  sem_registro: { label: `Sem registro de aula há mais de ${MAX_DAYS_WITHOUT_ENTRY} dias`, short: `Sem registro há ${MAX_DAYS_WITHOUT_ENTRY}+ dias`, tone: "alert" },
  queda_participacao: { label: "Queda de participação", tone: "alert" },
};

export function studentAlerts(input: {
  plans: Plan[];
  entries: DiaryEntry[];
  now?: Date;
}): StudentAlert[] {
  const now = input.now ?? new Date();
  const alerts: StudentAlert[] = [];
  const activePlan = input.plans.find((p) => p.status === "ativo");

  if (!activePlan) {
    alerts.push({ kind: "sem_plano", message: "Estudante sem plano individual ativo." });
  } else if (isPastDay(activePlan.reviewDate, now)) {
    alerts.push({ kind: "plano_vencido", message: "O plano individual passou da data de revisão." });
  }

  const entries = [...input.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const lastEntry = entries.at(-1);
  if (!lastEntry || now.getTime() - new Date(lastEntry.date).getTime() > MAX_DAYS_WITHOUT_ENTRY * DAY_MS) {
    alerts.push({
      kind: "sem_registro",
      message: `Sem registro de acompanhamento há mais de ${MAX_DAYS_WITHOUT_ENTRY} dias.`,
    });
  }

  const recent = entries.slice(-6);
  const refusals = recent.filter((e) => e.participation === "recusou").length;
  if (recent.length >= 4 && refusals >= Math.ceil(recent.length / 2)) {
    alerts.push({
      kind: "queda_participacao",
      message: "Queda de participação nos últimos registros. Vale discutir em equipe.",
    });
  }

  return alerts;
}

export function strategiesThatWorked(entries: DiaryEntry[]): string[] {
  const seen = new Set<string>();
  for (const e of entries) {
    for (const w of splitItems(e.whatWorked)) seen.add(w);
  }
  return [...seen].slice(0, 8);
}
