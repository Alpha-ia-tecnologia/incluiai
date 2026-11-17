const DAY = 86_400_000;
const brDay = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export function reviewOnTime(reviewedAt: Date, dueDate: Date): boolean {
  return brDay(reviewedAt) <= brDay(dueDate);
}

export const MAX_REVIEW_DAYS = 366;
export function nextReviewProblem(next: Date, now: Date = new Date()): string | null {
  if (Number.isNaN(next.getTime())) return "Informe a data da próxima revisão.";
  if (brDay(next) <= brDay(now)) return "A próxima revisão precisa ser depois de hoje.";
  if (next.getTime() - now.getTime() > MAX_REVIEW_DAYS * DAY) return "Marque a próxima revisão para daqui a no máximo um ano.";
  return null;
}

export function suggestedNextReview(now: Date = new Date()): string {
  return brDay(new Date(now.getTime() + 12 * 7 * DAY));
}

export function reviewSummary(reviews: ReadonlyArray<{ onTime: boolean }>): { total: number; onTime: number; pct: number | null } {
  const onTime = reviews.filter((review) => review.onTime).length;
  return { total: reviews.length, onTime, pct: reviews.length ? Math.round((onTime / reviews.length) * 100) : null };
}

export const CLOSE_REASONS = [
  "Objetivos alcançados: a equipe vai elaborar um novo plano",
  "Mudança importante no estudante ou na turma",
  "Transferência de escola",
  "Fim do ano letivo",
] as const;
