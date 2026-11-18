import { TREND, clampSupport, type Trend } from "./scale.ts";

export type TrendLesson = { supportLevel: number; participation?: string | null };
export type TrendReason = "poucos" | "meta" | "menos_apoio" | "mais_apoio" | "recusas" | "sem_avanco" | "estavel";
export type SupportTrend = {
  trend: Trend;
  reason: TrendReason;
  /** Média das aulas recentes menos a das anteriores, na janela; negativo é menos apoio. */
  delta: number | null;
  goalReached: boolean;
  /** Níveis de apoio das aulas da janela, da mais antiga à mais recente. */
  levels: number[];
  refusals: number;
};

export const TREND_RULE = {
  window: 8,
  minLessons: 3,
  minForAlert: 4,
  lessSupport: -0.5,
  moreSupport: 1,
  refusalsIn: 4,
  refusals: 2,
  stalledIn: 3,
} as const;

const mean = (values: ReadonlyArray<number>) => values.reduce((sum, value) => sum + value, 0) / values.length;
const asLesson = (lesson: number | TrendLesson): TrendLesson => (typeof lesson === "number" ? { supportLevel: lesson } : lesson);

/**
 * Lê a tendência do apoio nas aulas, da mais antiga à mais recente.
 * Alerta ("atencao") só quando um limite é cruzado: precisou, em média, de um
 * nível de apoio a mais nas aulas recentes, ou recusou 2 das 4 últimas.
 * Aulas sem avanço são "estavel", com uma dica, nunca alerta.
 */
export function supportTrend(lessons: ReadonlyArray<number | TrendLesson>, options: { target?: number | null } = {}): SupportTrend {
  const recent = lessons.slice(-TREND_RULE.window).map(asLesson);
  const levels = recent.map((lesson) => clampSupport(lesson.supportLevel));
  const latest = levels.at(-1);
  const target = typeof options.target === "number" ? clampSupport(options.target) : null;
  const goalReached = target !== null && latest !== undefined && latest <= target;
  const refusals = recent.slice(-TREND_RULE.refusalsIn).filter((lesson) => lesson.participation === "recusou").length;
  const read = (trend: Trend, reason: TrendReason, delta: number | null): SupportTrend => ({ trend, reason, delta, goalReached, levels, refusals });

  if (levels.length < TREND_RULE.minLessons) return read("sem_dados", "poucos", null);
  const half = Math.floor(levels.length / 2);
  const delta = Math.round((mean(levels.slice(-half)) - mean(levels.slice(0, half))) * 10) / 10;
  if (refusals >= TREND_RULE.refusals) return read("atencao", "recusas", delta);
  if (goalReached) return read("avancando", "meta", delta);
  if (delta >= TREND_RULE.moreSupport && levels.length >= TREND_RULE.minForAlert) return read("atencao", "mais_apoio", delta);
  if (delta <= TREND_RULE.lessSupport) return read("avancando", "menos_apoio", delta);
  const last = levels.slice(-TREND_RULE.stalledIn);
  return read("estavel", last.every((level) => level >= last[0]) ? "sem_avanco" : "estavel", delta);
}

/** As aulas de um objetivo, da mais antiga à mais recente. */
export function lessonsOf<T extends { date: Date | string; objectiveId?: string | null }>(entries: ReadonlyArray<T>, objectiveId: string): T[] {
  return entries
    .filter((entry) => entry.objectiveId === objectiveId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function objectiveSupportTrend(
  objective: { id: string; targetSupport: number },
  entries: ReadonlyArray<TrendLesson & { date: Date | string; objectiveId?: string | null }>,
): SupportTrend & { lessons: number } {
  const lessons = lessonsOf(entries, objective.id);
  return { ...supportTrend(lessons, { target: objective.targetSupport }), lessons: lessons.length };
}

/** O nome da tendência no selo: "Meta alcançada" quando a última aula chegou à meta. */
export const trendLabel = (reading: Pick<SupportTrend, "trend" | "reason">) => (reading.reason === "meta" ? "Meta alcançada" : TREND[reading.trend].label);

/** A dica pedagógica que acompanha a tendência (equipe). */
export function trendMessage(reading: Pick<SupportTrend, "reason" | "refusals">, lessons: number): string {
  switch (reading.reason) {
    case "poucos":
      return lessons === 0 ? "Sem registros ainda. Aplique uma atividade e registre em 3 toques." : "Com 3 aulas registradas, a tendência aparece.";
    case "meta":
      return "Meta alcançada. Vale marcar o objetivo como alcançado ou combinar o próximo degrau.";
    case "menos_apoio":
      return "Nível de apoio em redução. Considere subir um degrau (menos apoio ou mais itens).";
    case "mais_apoio":
      return "Precisou de mais apoio nas aulas recentes. Vale rever a atividade e o contexto com a equipe.";
    case "recusas":
      return `Recusou ${reading.refusals} das ${TREND_RULE.refusalsIn} últimas aulas. Vale rever o interesse âncora e o momento da atividade.`;
    case "sem_avanco":
      return `${TREND_RULE.stalledIn} aulas sem avanço. Talvez o próximo passo esteja grande demais: quer fracionar o objetivo?`;
    default:
      return "Desempenho estável. Mantenha o nível de apoio atual e varie o contexto.";
  }
}
