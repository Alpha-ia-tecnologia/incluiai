import { CRITERION_MET, DIMENSIONS, PARTICIPATION, supportInfo } from "./scale.ts";
import { isLinkedRole, isRole, roleGroup } from "./roles.ts";
import { brDay, daysBetween } from "./dates.ts";
import type { Problem } from "./user-error.ts";
import { reachedGoal, type SupportStepsData } from "./support-steps.ts";

export const lessonLogHref = (studentId: string, objectiveId?: string | null) =>
  `/estudantes/${studentId}/diario${objectiveId ? `?objetivo=${encodeURIComponent(objectiveId)}` : ""}`;

export type LabelledObjective = { id: string; action: string; condition: string; criterion: string; dimension: string; targetSupport: number };

const SEPARATOR = " · ";
const ACTION_MAX = 70;
const DETAILS: ((objective: LabelledObjective) => string)[] = [(objective) => objective.condition.trim(), (objective) => objective.criterion.trim()];

function actionText(action: string, studentName: string) {
  let text = action.replace(/\s+/g, " ").trim();
  const first = studentName.trim().split(" ")[0] ?? "";
  if (first && text.toLocaleLowerCase("pt-BR").startsWith(`${first.toLocaleLowerCase("pt-BR")} `)) text = text.slice(first.length + 1);
  return text.length > ACTION_MAX ? `${text.slice(0, ACTION_MAX).replace(/\s+\S*$/, "")}…` : text;
}

function clashes<T>(list: readonly T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of list) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups.values()].filter((group) => group.length > 1);
}

export function objectiveLabels(objectives: readonly LabelledObjective[], studentName = ""): Map<string, string> {
  const parts = new Map(objectives.map((objective) => [objective.id, [DIMENSIONS[objective.dimension] ?? objective.dimension, actionText(objective.action, studentName)].filter(Boolean)]));
  const text = (objective: LabelledObjective) => [...(parts.get(objective.id) ?? []), `meta ${supportInfo(objective.targetSupport).label}`].join(SEPARATOR);
  let pending = clashes(objectives, text);
  for (const detail of DETAILS) {
    for (const group of pending) {
      if (new Set(group.map(detail)).size < 2) continue;
      for (const objective of group) if (detail(objective)) parts.get(objective.id)?.push(detail(objective));
    }
    pending = pending.flatMap((group) => clashes(group, text));
  }
  const repeated = new Map(pending.flatMap((group) => group.map((objective, index) => [objective.id, index] as const)));
  return new Map(objectives.map((objective) => {
    const index = repeated.get(objective.id) ?? 0;
    return [objective.id, index ? `${text(objective)} (${index + 1})` : text(objective)];
  }));
}

export function defaultObjectiveId(objectives: readonly { id: string }[], records: readonly { objectiveId: string | null; date: Date }[], requested: readonly (string | null | undefined)[] = []): string {
  const ids = new Set(objectives.map((objective) => objective.id));
  const asked = requested.find((id) => id && ids.has(id));
  if (asked) return asked;
  const latest = new Map<string, number>();
  for (const record of records) {
    if (record.objectiveId && ids.has(record.objectiveId)) latest.set(record.objectiveId, Math.max(latest.get(record.objectiveId) ?? -Infinity, record.date.getTime()));
  }
  let chosen = "";
  let chosenAt = Infinity;
  for (const objective of objectives) {
    const at = latest.get(objective.id) ?? -Infinity;
    if (!chosen || at < chosenAt) [chosen, chosenAt] = [objective.id, at];
  }
  return chosen;
}

export const accountAuthorRole = (role: string): string => (isRole(role) && roleGroup(role) === "professor" ? role : "");

export type LessonAnswers = { participation: string; supportLevel: number; criterionMet: string; authorRole: string };

export const LESSON_PROBLEM = {
  participation: "Marque como o estudante participou.",
  supportLevel: "Escolha quanto apoio foi necessário.",
  criterionMet: "Marque se conseguiu realizar o que era esperado.",
  authorRole: "Escolha o seu papel neste registro.",
} as const;

export function lessonProblems(answers: LessonAnswers): Problem[] {
  const role = answers.authorRole.trim();
  const missing: (keyof typeof LESSON_PROBLEM)[] = [
    ...(Object.hasOwn(PARTICIPATION, answers.participation) ? [] : ["participation" as const]),
    ...(Number.isInteger(answers.supportLevel) && answers.supportLevel >= 0 && answers.supportLevel <= 5 ? [] : ["supportLevel" as const]),
    ...(Object.hasOwn(CRITERION_MET, answers.criterionMet) ? [] : ["criterionMet" as const]),
    ...(role && !isLinkedRole(role) ? [] : ["authorRole" as const]),
  ];
  return missing.map((field) => ({ field, message: LESSON_PROBLEM[field] }));
}

export const missingAnswers = (count: number) => `Para salvar, ${count === 1 ? "falta 1 resposta" : `faltam ${count} respostas`}:`;

export const supportFromInput = (value: unknown): number => (typeof value === "string" && /^\d$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);

export function lastRecordLabel(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return "Ainda sem registro";
  const days = daysBetween(brDay(date), brDay(now));
  return days <= 0 ? "Último registro hoje" : days === 1 ? "Último registro ontem" : `Último registro há ${days} dias`;
}

export type SavedLesson = { objectiveId: string | null; steps: SupportStepsData | null };

export type LessonOutcome = { reached: boolean; level: string; goal: string | null; note: string; streak: number };

export function lessonOutcome(steps: Pick<SupportStepsData, "lessons" | "total" | "target">): LessonOutcome | null {
  const levels = steps.lessons.map((lesson) => lesson.level);
  const latest = levels.at(-1);
  if (latest === undefined) return null;
  let streak = 0;
  while (streak < levels.length && levels[levels.length - 1 - streak] === latest) streak += 1;
  const previous = levels.length > streak ? levels[levels.length - 1 - streak] : null;
  const note = steps.total === 1 ? "primeira aula registrada"
    : streak > 1 ? `${streak}ª aula seguida`
      : previous !== null && latest < previous ? "menos apoio que na aula anterior"
        : previous !== null && latest > previous ? "mais apoio que na aula anterior" : "";
  return { reached: reachedGoal(latest, steps.target), level: supportInfo(latest).label, goal: steps.target === null ? null : supportInfo(steps.target).label, note, streak };
}
