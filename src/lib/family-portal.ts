import { MONTH_NAMES, addDays, brDay, brYmd, dayStart } from "./dates.ts";
import { plural } from "./format.ts";
import { PARTICIPATION, clampSupport } from "./scale.ts";
import { TREND_RULE } from "./support-trend.ts";
import type { SupportStepsData } from "./support-steps.ts";

/** Quanta ajuda, em palavras do dia a dia, para cada nível da escala de apoio (0 a 5). */
export const FAMILY_HELP = [
  "sem ajuda",
  "só com um lembrete",
  "com uma dica falada ou visual",
  "vendo alguém fazer antes",
  "com ajuda física em parte",
  "com ajuda física o tempo todo",
] as const;

export const familyHelp = (level: number) => FAMILY_HELP[clampSupport(level)];

// Futuro do presente irregular: o infinitivo não é "futuro sem o acento".
const IRREGULAR_ENDINGS: ReadonlyArray<[string, string]> = [["fará", "fazer"], ["dirá", "dizer"], ["trará", "trazer"]];

function infinitive(word: string): string {
  if (word === "porá") return "pôr";
  for (const [future, verb] of IRREGULAR_ENDINGS) if (word.endsWith(future)) return word.slice(0, -future.length) + verb;
  return /^\p{Ll}+rá$/u.test(word) ? word.slice(0, -1) : word;
}

/**
 * O objetivo como a família fala: "identificará seu nome entre 5 opções" vira
 * "Identificar seu nome entre 5 opções". Sem o nome do estudante no começo.
 */
export function familyGoalTitle(action: string, firstName = ""): string {
  let text = action.trim().replace(/\s+/g, " ");
  if (firstName && text.toLocaleLowerCase("pt-BR").startsWith(`${firstName.toLocaleLowerCase("pt-BR")} `)) text = text.slice(firstName.length + 1);
  text = text.replace(/\p{L}+/gu, infinitive).replace(/[.;]+$/, "");
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

/**
 * Uma frase sobre o objetivo, em palavras da família, a partir dos degraus:
 * "Está precisando de menos ajuda: na última aula, fez com uma dica falada ou visual; o objetivo é fazer só com um lembrete."
 */
export function familyGoalSentence(data: Pick<SupportStepsData, "lessons" | "target" | "trend">): string | null {
  const last = data.lessons.at(-1);
  const goal = data.target === null ? "" : `; o objetivo é fazer ${familyHelp(data.target)}`;
  if (!last) return goal ? `O objetivo é fazer ${familyHelp(data.target!)}.` : null;
  const did = familyHelp(last.level);
  switch (data.trend.reason) {
    case "meta":
      return `Chegou ao objetivo: na última aula, fez ${did}.`;
    case "menos_apoio":
      return `Está precisando de menos ajuda: na última aula, fez ${did}${goal}.`;
    case "mais_apoio":
      return `Precisou de mais ajuda nas últimas aulas: na última, fez ${did}${goal}.`;
    case "recusas":
      return `Em ${data.trend.refusals} das ${Math.min(TREND_RULE.refusalsIn, data.trend.levels.length)} últimas aulas, preferiu não fazer a atividade.`;
    case "poucos":
      return `${data.lessons.length === 1 ? "Na primeira aula" : "Na última aula"}, fez ${did}${goal}.`;
    default:
      return `Nas últimas aulas, fez ${did}${goal}.`;
  }
}

/** Os objetivos que o portal mostra primeiro: os das aulas mais recentes; sem aula, na ordem do plano. */
export function pickGoals<T extends { id: string }>(objectives: ReadonlyArray<T>, lessons: ReadonlyArray<{ date: Date | string; objectiveId?: string | null }>, count = 2): T[] {
  const latest = new Map<string, number>();
  for (const lesson of lessons) {
    if (!lesson.objectiveId) continue;
    latest.set(lesson.objectiveId, Math.max(latest.get(lesson.objectiveId) ?? -Infinity, new Date(lesson.date).getTime()));
  }
  return objectives
    .map((objective, index) => ({ objective, index, at: latest.get(objective.id) ?? -Infinity }))
    .sort((a, b) => b.at - a.at || a.index - b.index)
    .slice(0, count)
    .map((item) => item.objective);
}

export const WEEK_DAYS = 7;

/** Os 7 dias até hoje (horário de Brasília): o começo do primeiro dia e o rótulo, como "12 a 18 de novembro". */
export function weekWindow(now: Date = new Date()): { since: Date; label: string } {
  const today = brDay(now);
  const first = addDays(today, -(WEEK_DAYS - 1));
  const [a, b] = [brYmd(dayStart(first)), brYmd(now)];
  const label = a.month === b.month
    ? `${a.day} a ${b.day} de ${MONTH_NAMES[b.month - 1]}`
    : `${a.day} de ${MONTH_NAMES[a.month - 1]} a ${b.day} de ${MONTH_NAMES[b.month - 1]}`;
  return { since: dayStart(first), label };
}

export type WeekItem = {
  key: string;
  kind: "aulas" | "atendimento" | "conquista" | "casa" | "material" | "relatorio";
  title: string;
  detail?: string;
  href?: string;
};

export type WeekInput = {
  since: Date;
  /** Endereço do portal do estudante, para os links (ex.: "/familia/abc"). */
  portal: string;
  firstName: string;
  lessons: ReadonlyArray<{ date: Date; participation: string; objectiveId: string | null }>;
  objectives: ReadonlyArray<{ id: string; action: string }>;
  sessions: ReadonlyArray<{ date: Date; status: string }>;
  conquests: ReadonlyArray<{ id: string; date: Date; title: string }>;
  activities: ReadonlyArray<{ id: string; title: string; at: Date }>;
  materials: ReadonlyArray<{ id: string; title: string; at: Date }>;
  reports: ReadonlyArray<{ id: string; at: Date | null }>;
};

function participationOf(lessons: WeekInput["lessons"]): string {
  if (lessons.length === 1) {
    const answer = PARTICIPATION[lessons[0].participation]?.answer;
    return answer ? answer.charAt(0).toLowerCase() + answer.slice(1) : "";
  }
  const count = (key: string) => lessons.filter((lesson) => lesson.participation === key).length;
  const [all, part, refused] = [count("total"), count("parcial"), count("recusou")];
  const took = [all ? `de toda a atividade em ${all}` : "", part ? `de parte em ${part}` : ""].filter(Boolean);
  return [took.length ? `participou ${took.join(" e ")}` : "", refused ? `recusou ${refused}` : ""].filter(Boolean).join("; ");
}

/** O que a escola registrou nos 7 dias, em palavras da família, do mais importante ao menos. */
export function familyWeek(input: WeekInput): WeekItem[] {
  const inWeek = (date: Date | null) => date !== null && date.getTime() >= input.since.getTime();
  const items: WeekItem[] = [];

  const lessons = input.lessons.filter((lesson) => inWeek(lesson.date));
  if (lessons.length) {
    const worked = [...new Set(lessons.map((lesson) => lesson.objectiveId))]
      .map((id) => input.objectives.find((objective) => objective.id === id))
      .filter((objective) => objective !== undefined)
      .map((objective) => familyGoalTitle(objective.action, input.firstName));
    const participation = participationOf(lessons);
    items.push({
      key: "aulas",
      kind: "aulas",
      title: `${plural(lessons.length, "aula registrada", "aulas registradas")}${participation ? `: ${participation}` : ""}`,
      detail: worked.length ? worked.join(" · ") : undefined,
      href: worked.length ? "#plano" : undefined,
    });
  }

  const sessions = input.sessions.filter((session) => inWeek(session.date));
  if (sessions.length) {
    const count = (status: string) => sessions.filter((session) => session.status === status).length;
    const [done, missed, cancelled] = [count("realizado"), count("falta"), count("cancelamento")];
    const rest = [missed ? plural(missed, "falta", "faltas") : "", cancelled ? plural(cancelled, "cancelado", "cancelados") : ""].filter(Boolean).join(" · ");
    items.push(done
      ? { key: "atendimento", kind: "atendimento", title: plural(done, "atendimento especializado", "atendimentos especializados"), detail: rest || undefined }
      : { key: "atendimento", kind: "atendimento", title: "Atendimento especializado", detail: rest });
  }

  for (const conquest of input.conquests.filter((item) => inWeek(item.date))) {
    items.push({ key: `conquista-${conquest.id}`, kind: "conquista", title: "Conquista na escola", detail: conquest.title });
  }
  for (const activity of input.activities.filter((item) => inWeek(item.at))) {
    items.push({ key: `casa-${activity.id}`, kind: "casa", title: "Nova atividade para casa", detail: activity.title, href: "#casa" });
  }
  for (const material of input.materials.filter((item) => inWeek(item.at))) {
    items.push({ key: `material-${material.id}`, kind: "material", title: "Novo material para casa", detail: material.title, href: `${input.portal}/materiais/${material.id}` });
  }
  for (const report of input.reports.filter((item) => inWeek(item.at))) {
    items.push({ key: `relatorio-${report.id}`, kind: "relatorio", title: "Relatório do período pronto", href: `${input.portal}/relatorios/${report.id}` });
  }
  return items;
}

export type ShareInput = { answers: ReadonlyArray<string>; note: string; achievement: string; author: string };
export type SharePlan = {
  /** A resposta da semana (pergunta da semana), quando há o que guardar. */
  checkIn: { answers: string[]; note: string } | null;
  /** A conquista de casa (registro da família), quando há. */
  achievement: { note: string; author: string } | null;
};

/**
 * "Contar para a escola" junta a pergunta da semana e a conquista de casa num
 * formulário só; cada parte continua indo para o seu registro.
 */
export function planShare(input: ShareInput): SharePlan | { error: string } {
  const answers = input.answers.map((item) => item.trim()).filter(Boolean);
  const note = input.note.trim();
  const achievement = input.achievement.trim();
  if (!answers.length && !note && !achievement) return { error: "Marque o que aconteceu ou escreva uma frase para a escola." };
  return {
    checkIn: answers.length || note ? { answers, note } : null,
    achievement: achievement ? { note: achievement, author: input.author.trim() } : null,
  };
}

/** A resposta da semana não mudou: mesmas opções (em qualquer ordem) e mesma frase. */
export function sameCheckIn(a: { answers: ReadonlyArray<string>; note: string | null }, b: { answers: ReadonlyArray<string>; note: string | null }): boolean {
  const key = (answers: ReadonlyArray<string>) => [...new Set(answers.map((item) => item.trim()))].sort().join("\n");
  return key(a.answers) === key(b.answers) && (a.note ?? "").trim() === (b.note ?? "").trim();
}
