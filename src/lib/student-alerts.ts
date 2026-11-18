import { brDay, daysBetween, isPastDay } from "./dates.ts";
import { plural } from "./format.ts";
import type { Term, Trend } from "./scale.ts";

export const RECORD_GAP_DAYS = 14;
const REFUSAL_WINDOW = 6;
const REFUSAL_MIN_RECORDS = 4;

export type AlertKind = "plano_vencido" | "sem_registro" | "tendencia" | "queda_participacao";

export interface StudentAlert {
  kind: AlertKind;
  message: string;
  since: Date;
}

export const ALERTS: Record<AlertKind, Term> = {
  plano_vencido: { label: "Plano com revisão vencida", short: "Revisão vencida", tone: "alert" },
  sem_registro: { label: `Sem registro de aula há ${RECORD_GAP_DAYS} dias ou mais`, short: `Sem registro há ${RECORD_GAP_DAYS}+ dias`, tone: "alert" },
  tendencia: { label: "Evolução pede atenção", short: "Evolução", tone: "alert" },
  queda_participacao: { label: "Queda de participação", tone: "alert" },
};

export const PLAN_MISSING: Term = { label: "Sem plano individual ativo", short: "Sem plano", tone: "neutral" };

type PlanLike = { status: string; reviewDate: Date; createdAt: Date; objectives: ReadonlyArray<{ status: string }> };
type EntryLike = { date: Date; participation: string; objectiveId?: string | null };
export type ObjectiveTrend = { objectiveId: string; trend: Trend };

const daysSince = (date: Date, now: Date) => daysBetween(brDay(date), brDay(now));
const latest = (entries: ReadonlyArray<EntryLike>) => entries.reduce<Date | null>((last, entry) => (!last || entry.date > last ? entry.date : last), null);

export function alertsFor(input: {
  plans: ReadonlyArray<PlanLike>;
  entries: ReadonlyArray<EntryLike>;
  trends?: ReadonlyArray<ObjectiveTrend>;
  now?: Date;
}): StudentAlert[] {
  const now = input.now ?? new Date();
  const alerts: StudentAlert[] = [];
  const plan = input.plans.find((item) => item.status === "ativo");
  const entries = [...input.entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const lastEntry = entries.at(-1);

  if (plan && isPastDay(plan.reviewDate, now)) {
    alerts.push({ kind: "plano_vencido", message: `A revisão do plano venceu há ${plural(daysSince(plan.reviewDate, now), "dia", "dias")}.`, since: plan.reviewDate });
  }

  const recordingExpected = Boolean(lastEntry) || Boolean(plan?.objectives.some((objective) => objective.status === "ativo"));
  const recordClock = lastEntry?.date ?? plan?.createdAt;
  if (recordingExpected && recordClock && daysSince(recordClock, now) >= RECORD_GAP_DAYS) {
    alerts.push({ kind: "sem_registro", message: `Sem registro de acompanhamento há ${daysSince(recordClock, now)} dias.`, since: recordClock });
  }

  const flagged = new Set((input.trends ?? []).filter((item) => item.trend === "atencao").map((item) => item.objectiveId));
  if (flagged.size) {
    const evidence = latest(entries.filter((entry) => entry.objectiveId && flagged.has(entry.objectiveId))) ?? lastEntry?.date ?? now;
    alerts.push({ kind: "tendencia", message: `${flagged.size === 1 ? "Um objetivo pede" : `${flagged.size} objetivos pedem`} atenção nas últimas aulas.`, since: evidence });
  }

  const recent = entries.slice(-REFUSAL_WINDOW);
  const refusals = recent.filter((entry) => entry.participation === "recusou").length;
  if (lastEntry && recent.length >= REFUSAL_MIN_RECORDS && refusals >= Math.ceil(recent.length / 2)) {
    alerts.push({ kind: "queda_participacao", message: `Recusou ${refusals} das ${recent.length} últimas aulas.`, since: lastEntry.date });
  }

  return alerts;
}
