import type { DiaryEntry, Objective, Plan } from "@prisma/client";
import { splitItems } from "./form-options";

// Detecção de padrões e alertas (itens 9 e 17.6).
// Tudo aqui é determinístico e auditável: contagens e comparações simples
// sobre os registros de 3 toques. Nenhuma inferência clínica.

export type Trend = "avancando" | "estavel" | "atencao" | "sem_dados";

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

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS_WITHOUT_ENTRY = 7;

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
  } else if (new Date(activePlan.reviewDate).getTime() < now.getTime()) {
    alerts.push({ kind: "plano_vencido", message: "O plano individual passou da data de revisão." });
  }

  const lastEntry = [...input.entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
  if (!lastEntry || now.getTime() - new Date(lastEntry.date).getTime() > MAX_DAYS_WITHOUT_ENTRY * DAY_MS) {
    alerts.push({
      kind: "sem_registro",
      message: `Sem registro de acompanhamento há mais de ${MAX_DAYS_WITHOUT_ENTRY} dias.`,
    });
  }

  const recent = input.entries.slice(-6);
  const refusals = recent.filter((e) => e.participation === "recusou").length;
  if (recent.length >= 4 && refusals >= Math.ceil(recent.length / 2)) {
    alerts.push({
      kind: "queda_participacao",
      message: "Queda de participação nos últimos registros. Vale discutir em equipe.",
    });
  }

  return alerts;
}

// Estratégias marcadas como "funcionou" nos registros, para priorização (item 17.6.2).
export function strategiesThatWorked(entries: DiaryEntry[]): string[] {
  const seen = new Set<string>();
  // Cada registro pode marcar várias estratégias, separadas por ";".
  for (const e of entries) {
    for (const w of splitItems(e.whatWorked)) seen.add(w);
  }
  return [...seen].slice(0, 8);
}
