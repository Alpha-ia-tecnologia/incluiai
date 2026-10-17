// Séries e divisões para os gráficos (padrão visual do painel, src/components/data-viz.tsx).
// Puro, sem banco e sem React: recebe o que as páginas já carregam e devolve
// números prontos para desenhar. Testes em src/lib/series.test.mjs.
//
// Nível de apoio: 0 (independente) a 5 (apoio físico total). Menos é avanço.

export type SeriesPoint = { label: string; title: string; value: number };
// Tom visual de um valor (o mesmo de src/components/data-viz.tsx).
export type VizTone = "good" | "mid" | "alert" | "neutral" | "info";
export const PARTICIPATION_TONE: Record<string, VizTone> = { total: "good", parcial: "mid", recusou: "alert" };
export const PARTICIPATION_TEXT: Record<string, string> = { total: "participou de toda a atividade", parcial: "participou de parte", recusou: "recusou" };
export type SplitSegment = { key: string; label: string; value: number };

type EntryLike = { date: Date | string; participation?: string; supportLevel?: number; criterionMet?: string; objectiveId?: string | null; whatWorked?: string | null };

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));
const DAY = 86_400_000;
const shortDate = (date: Date) => date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Segunda-feira 00:00 (horário de Brasília aproximado pelo meio-dia) da semana da data.
function weekStart(date: Date): Date {
  const local = new Date(date.getTime() - 3 * 3_600_000);
  const day = (local.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day) + 3 * 3_600_000);
}

// Quantas datas caem em cada uma das últimas `weeks` semanas (a mais recente por último).
export function weeklyCounts(dates: ReadonlyArray<Date | string>, weeks: number, now: Date = new Date()): SeriesPoint[] {
  const current = weekStart(now).getTime();
  const buckets = Array.from({ length: weeks }, (_, index) => current - (weeks - 1 - index) * 7 * DAY);
  const counts = new Map(buckets.map((start) => [start, 0]));
  for (const value of dates) {
    const start = weekStart(toDate(value)).getTime();
    if (counts.has(start)) counts.set(start, counts.get(start)! + 1);
  }
  return buckets.map((start) => {
    const date = new Date(start);
    return { label: shortDate(date), title: `Semana de ${shortDate(date)}`, value: counts.get(start)! };
  });
}

// Quantas datas caem em cada um dos últimos `months` meses (o atual por último).
export function monthlyCounts(dates: ReadonlyArray<Date | string>, months: number, now: Date = new Date()): SeriesPoint[] {
  const keys = Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - index), 1));
    return { key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`, month: date.getUTCMonth(), year: date.getUTCFullYear() };
  });
  const counts = new Map(keys.map((item) => [item.key, 0]));
  for (const value of dates) {
    const date = toDate(value);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return keys.map((item) => ({ label: MONTH_SHORT[item.month], title: `${MONTH_LONG[item.month]} de ${item.year}`, value: counts.get(item.key)! }));
}

// Nível de apoio ao longo dos registros (do mais antigo ao mais recente).
export function supportSeries(entries: ReadonlyArray<EntryLike>, objectiveId?: string): { date: Date; value: number }[] {
  return entries
    .filter((entry) => typeof entry.supportLevel === "number" && (!objectiveId || entry.objectiveId === objectiveId))
    .map((entry) => ({ date: toDate(entry.date), value: Math.min(5, Math.max(0, entry.supportLevel!)) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type Trend = "avancando" | "estavel" | "atencao" | "sem_dados";
export const TREND_TEXT: Record<Trend, string> = { avancando: "Avançando", estavel: "Estável", atencao: "Pede atenção", sem_dados: "Poucos registros" };

// Tendência do apoio: média da metade inicial contra a metade final. Menos apoio = avanço.
export function supportTrend(values: ReadonlyArray<number>): { trend: Trend; delta: number | null } {
  if (values.length < 3) return { trend: "sem_dados", delta: null };
  const half = Math.floor(values.length / 2);
  const mean = (list: ReadonlyArray<number>) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const delta = Math.round((mean(values.slice(-half)) - mean(values.slice(0, half))) * 10) / 10;
  return { trend: delta <= -0.5 ? "avancando" : delta >= 0.5 ? "atencao" : "estavel", delta };
}

const PARTICIPATION: SplitSegment[] = [
  { key: "total", label: "Participou de toda a atividade", value: 0 },
  { key: "parcial", label: "Participou de parte", value: 0 },
  { key: "recusou", label: "Recusou", value: 0 },
];
const CRITERION: SplitSegment[] = [
  { key: "sim", label: "Atingiu o critério", value: 0 },
  { key: "parcial", label: "Atingiu em parte", value: 0 },
  { key: "nao", label: "Ainda não atingiu", value: 0 },
];

function split(template: SplitSegment[], values: ReadonlyArray<string | undefined>): SplitSegment[] {
  return template.map((segment) => ({ ...segment, value: values.filter((value) => value === segment.key).length }));
}
export const participationSplit = (entries: ReadonlyArray<EntryLike>) => split(PARTICIPATION, entries.map((entry) => entry.participation));
export const criterionSplit = (entries: ReadonlyArray<EntryLike>) => split(CRITERION, entries.map((entry) => entry.criterionMet));

// Itens marcados em listas separadas por ";" (ex.: "o que funcionou"), com a contagem.
export function countItems(values: ReadonlyArray<string | null | undefined>, limit = 8): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    for (const item of (value ?? "").split(/[;\n]/).map((part) => part.trim()).filter(Boolean)) counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR")).slice(0, limit);
}

// Frequência do AEE por mês, separada por situação (frequência não é aprendizagem).
export function sessionsByMonth(sessions: ReadonlyArray<{ date: Date | string; status: string }>, months: number, now: Date = new Date()) {
  const base = monthlyCounts([], months, now);
  const byStatus = (status: string) => monthlyCounts(sessions.filter((session) => session.status === status).map((session) => session.date), months, now);
  const [realizado, falta, cancelamento] = [byStatus("realizado"), byStatus("falta"), byStatus("cancelamento")];
  return base.map((month, index) => ({ ...month, realizado: realizado[index].value, falta: falta[index].value, cancelamento: cancelamento[index].value, value: realizado[index].value + falta[index].value + cancelamento[index].value }));
}

// Percentual inteiro; sem base (denominador zero) = null, nunca 0%.
export const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

// Rótulo curto de data para eixos (dd/mm).
export const axisDate = (value: Date | string) => shortDate(toDate(value));
