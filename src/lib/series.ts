import { splitItems } from "./format.ts";
import { DAY_MS, MONTH_NAMES, MONTH_SHORT, dayStart, formatDateShort, monthIndex, monthOfIndex, weekStart } from "./dates.ts";
import { AEE_SESSION_STATUSES, CRITERION_MET, PARTICIPATION, clampSupport, type AeeSessionStatus, type Term, type Tone } from "./scale.ts";

export { supportTrend } from "./support-trend.ts";

export type SeriesPoint = { label: string; title: string; value: number };
export type SplitSegment = { key: string; label: string; tone: Tone; value: number };

type EntryLike = { date: Date | string; participation?: string; supportLevel?: number; criterionMet?: string; objectiveId?: string | null; whatWorked?: string | null };

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export function weeklyCounts(dates: ReadonlyArray<Date | string>, weeks: number, now: Date = new Date()): SeriesPoint[] {
  const current = dayStart(weekStart(now)).getTime();
  const buckets = Array.from({ length: weeks }, (_, index) => current - (weeks - 1 - index) * 7 * DAY_MS);
  const counts = new Map(buckets.map((start) => [start, 0]));
  for (const value of dates) {
    const start = dayStart(weekStart(toDate(value))).getTime();
    if (counts.has(start)) counts.set(start, counts.get(start)! + 1);
  }
  return buckets.map((start) => {
    const label = formatDateShort(new Date(start));
    return { label, title: `Semana de ${label}`, value: counts.get(start)! };
  });
}

export function monthlyCounts(dates: ReadonlyArray<Date | string>, months: number, now: Date = new Date()): SeriesPoint[] {
  const current = monthIndex(now);
  const keys = Array.from({ length: months }, (_, index) => current - (months - 1 - index));
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const value of dates) {
    const key = monthIndex(toDate(value));
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return keys.map((key) => {
    const { year, month } = monthOfIndex(key);
    return { label: MONTH_SHORT[month - 1], title: `${MONTH_NAMES[month - 1]} de ${year}`, value: counts.get(key)! };
  });
}

export function supportSeries(entries: ReadonlyArray<EntryLike>, objectiveId?: string): { date: Date; value: number }[] {
  return entries
    .filter((entry) => typeof entry.supportLevel === "number" && (!objectiveId || entry.objectiveId === objectiveId))
    .map((entry) => ({ date: toDate(entry.date), value: clampSupport(entry.supportLevel!) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function split(table: Readonly<Record<string, Term>>, values: ReadonlyArray<string | null | undefined>): SplitSegment[] {
  return Object.entries(table).map(([key, term]) => ({ key, label: term.label, tone: term.tone, value: values.filter((value) => value === key).length }));
}
export const participationSplit = (entries: ReadonlyArray<EntryLike>) => split(PARTICIPATION, entries.map((entry) => entry.participation));
export const criterionSplit = (entries: ReadonlyArray<EntryLike>) => split(CRITERION_MET, entries.map((entry) => entry.criterionMet));

export function countItems(values: ReadonlyArray<string | null | undefined>, limit = 8): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    for (const item of splitItems(value)) counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR")).slice(0, limit);
}

export function sessionsByMonth(sessions: ReadonlyArray<{ date: Date | string; status: string }>, months: number, now: Date = new Date()) {
  const byStatus = AEE_SESSION_STATUSES.map((status) => monthlyCounts(sessions.filter((session) => session.status === status).map((session) => session.date), months, now));
  return monthlyCounts([], months, now).map((month, index) => {
    const counts = Object.fromEntries(AEE_SESSION_STATUSES.map((status, position) => [status, byStatus[position][index].value])) as Record<AeeSessionStatus, number>;
    return { ...month, ...counts, value: Object.values(counts).reduce((sum, value) => sum + value, 0) };
  });
}

export const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

