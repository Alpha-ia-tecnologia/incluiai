import { formatDate, formatDateShort } from "./dates.ts";
import { plural } from "./format.ts";
import { PARTICIPATION, SUPPORT_LEVELS, clampSupport } from "./scale.ts";
import { lessonsOf, supportTrend, type SupportTrend } from "./support-trend.ts";

export type StepsSize = "mini" | "regular" | "full";
export type StepsAudience = "equipe" | "familia";

/** Quantas aulas, no máximo, cada tamanho mostra (as mais recentes). */
export const STEPS_LIMIT: Record<StepsSize, number> = { mini: 8, regular: 12, full: 24 };

export type StepLesson = {
  key: string;
  /** "13/11" */
  date: string;
  /** "13 de nov. de 2026" */
  dateLong: string;
  level: number;
  participation: string;
};

/** O que `SupportSteps` desenha. Serializável: pode ir do servidor para um componente de cliente. */
export type SupportStepsData = {
  /** As aulas do objetivo, da mais antiga à mais recente (no máximo `STEPS_LIMIT.full`). */
  lessons: StepLesson[];
  /** Quantas aulas o objetivo tem ao todo. */
  total: number;
  /** O nível de apoio da meta (0 a 5), quando há. */
  target: number | null;
  trend: SupportTrend;
};

export type StepEntry = { id?: string; date: Date | string; supportLevel: number; participation: string; objectiveId?: string | null };

/** Monta os degraus a partir das aulas de um só objetivo (em qualquer ordem). */
export function stepsFrom(entries: ReadonlyArray<StepEntry>, { target = null }: { target?: number | null } = {}): SupportStepsData {
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const lessons = sorted.slice(-STEPS_LIMIT.full).map((entry, index) => ({
    key: entry.id ?? `${new Date(entry.date).getTime()}-${index}`,
    date: formatDateShort(entry.date),
    dateLong: formatDate(entry.date),
    level: clampSupport(entry.supportLevel),
    participation: entry.participation,
  }));
  const goal = typeof target === "number" ? clampSupport(target) : null;
  return { lessons, total: sorted.length, target: goal, trend: supportTrend(sorted, { target: goal }) };
}

/** Os degraus de um objetivo, a partir das aulas do estudante (de todos os objetivos). */
export function stepsFor(objective: { id: string; targetSupport: number }, entries: ReadonlyArray<StepEntry>): SupportStepsData {
  return stepsFrom(lessonsOf(entries, objective.id), { target: objective.targetSupport });
}

/** Os degraus de cada objetivo que tem aula, o da aula mais recente primeiro; aulas sem objetivo ficam num grupo sem nome. */
export function stepsByObjective(entries: ReadonlyArray<StepEntry & { objective?: { id: string; action: string; targetSupport: number } | null }>): { key: string; name: string | null; data: SupportStepsData }[] {
  const groups = new Map<string, { name: string | null; target: number | null; entries: StepEntry[]; latest: number }>();
  for (const entry of entries) {
    const key = entry.objective?.id ?? "";
    const group = groups.get(key) ?? { name: entry.objective?.action ?? null, target: entry.objective?.targetSupport ?? null, entries: [], latest: -Infinity };
    group.entries.push(entry);
    group.latest = Math.max(group.latest, new Date(entry.date).getTime());
    groups.set(key, group);
  }
  return [...groups]
    .sort(([, a], [, b]) => b.latest - a.latest)
    .map(([key, group]) => ({ key: key || "sem-objetivo", name: group.name, data: stepsFrom(group.entries, { target: group.target }) }));
}

/** O objetivo em foco: o que tem a aula registrada mais recente; sem aula, o primeiro da lista. */
export function focusObjective<T extends { id: string }>(objectives: ReadonlyArray<T>, entries: ReadonlyArray<{ date: Date | string; objectiveId?: string | null }>): T | null {
  let focus: T | null = null;
  let latest = -Infinity;
  for (const entry of entries) {
    const time = new Date(entry.date).getTime();
    const objective = time > latest ? objectives.find((item) => item.id === entry.objectiveId) : undefined;
    if (objective) [focus, latest] = [objective, time];
  }
  return focus ?? objectives[0] ?? null;
}

export const visibleLessons = (data: Pick<SupportStepsData, "lessons">, size: StepsSize) => data.lessons.slice(-STEPS_LIMIT[size]);

export const reachedGoal = (level: number, target: number | null) => target !== null && level <= target;

const levelName = (level: number) => SUPPORT_LEVELS[clampSupport(level)].label;

function pathOf(levels: ReadonlyArray<number>): string {
  const [first, last] = [levels[0], levels[levels.length - 1]];
  if (levels.length === 1) return levelName(first);
  if (levels.every((level) => level === first)) return `sempre em ${levelName(first)}`;
  return first === last ? `começou e terminou em ${levelName(first)}` : `de ${levelName(first)} para ${levelName(last)}`;
}

function goalOf(levels: ReadonlyArray<number>, target: number | null, audience: StepsAudience): string | null {
  if (target === null) return null;
  const [word, reached] = audience === "familia" ? ["objetivo", "alcançado"] : ["meta", "alcançada"];
  const name = `${word} ${levelName(target)}`;
  let streak = 0;
  for (let index = levels.length - 1; index >= 0 && reachedGoal(levels[index], target); index -= 1) streak += 1;
  if (streak === 0) return name;
  if (streak === levels.length && streak > 1) return `${name} ${reached} em todas`;
  return streak === 1 ? `${name} ${reached} na última` : `${name} ${reached} nas ${streak} últimas`;
}

function participationOf(lessons: ReadonlyArray<StepLesson>): string {
  if (lessons.length === 1) {
    const answer = PARTICIPATION[lessons[0].participation]?.answer;
    return answer ? answer.charAt(0).toLowerCase() + answer.slice(1) : lessons[0].participation;
  }
  const count = (key: string) => lessons.filter((lesson) => lesson.participation === key).length;
  const took = [count("total") ? `de toda a atividade em ${count("total")}` : "", count("parcial") ? `de parte em ${count("parcial")}` : ""].filter(Boolean);
  return [took.length ? `participou ${took.join(", ")}` : "", count("recusou") ? `recusou em ${count("recusou")}` : ""].filter(Boolean).join(", ");
}

/**
 * A frase que um leitor de tela ouve no lugar do desenho, por exemplo:
 * "8 aulas: de Modelo para Supervisão; meta Supervisão alcançada nas 2 últimas; participou de toda a atividade em 6, de parte em 1, recusou em 1."
 */
export function stepsSentence(data: SupportStepsData, { size = "full", audience = "equipe" }: { size?: StepsSize; audience?: StepsAudience } = {}): string {
  const lessons = visibleLessons(data, size);
  const levels = lessons.map((lesson) => lesson.level);
  const goal = goalOf(levels, data.target, audience);
  if (!lessons.length) return `Ainda sem registro de aula${goal ? `; ${goal}` : ""}.`;
  const count = data.total > lessons.length ? `${lessons.length} últimas de ${data.total} aulas` : plural(lessons.length, "aula", "aulas");
  const participation = participationOf(lessons);
  return `${count}: ${[pathOf(levels), goal, participation].filter(Boolean).join("; ")}.`;
}
