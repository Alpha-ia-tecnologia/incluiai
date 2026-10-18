// Regras do ciclo de vida do plano de ensino (revisar e encerrar), puras para
// teste com node --test (src/lib/plan-lifecycle.test.mjs). Seções 4, 6, 11 e
// 17.9 da proposta: o plano é revisado com a equipe, no prazo, e não recomeça do zero.

const DAY = 86_400_000;
// O dia no horário de Brasília (AAAA-MM-DD), para comparar datas de calendário.
const brDay = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// No prazo = revisado até o dia marcado (inclusive), pelo calendário de Brasília.
export function reviewOnTime(reviewedAt: Date, dueDate: Date): boolean {
  return brDay(reviewedAt) <= brDay(dueDate);
}

// A próxima revisão precisa ser depois de hoje e em até um ano.
export const MAX_REVIEW_DAYS = 366;
export function nextReviewProblem(next: Date, now: Date = new Date()): string | null {
  if (Number.isNaN(next.getTime())) return "Informe a data da próxima revisão.";
  if (brDay(next) <= brDay(now)) return "A próxima revisão precisa ser depois de hoje.";
  if (next.getTime() - now.getTime() > MAX_REVIEW_DAYS * DAY) return "Marque a próxima revisão para daqui a no máximo um ano.";
  return null;
}

// Data sugerida para a próxima revisão: um trimestre letivo (12 semanas), no formato do campo de data.
export function suggestedNextReview(now: Date = new Date()): string {
  return brDay(new Date(now.getTime() + 12 * 7 * DAY));
}

// Quantas revisões saíram no prazo (base do indicador "planos revisados no prazo").
export function reviewSummary(reviews: ReadonlyArray<{ onTime: boolean }>): { total: number; onTime: number; pct: number | null } {
  const onTime = reviews.filter((review) => review.onTime).length;
  return { total: reviews.length, onTime, pct: reviews.length ? Math.round((onTime / reviews.length) * 100) : null };
}

// Motivos para encerrar o plano; "Outro" pede texto.
export const CLOSE_REASONS = [
  "Objetivos alcançados: a equipe vai elaborar um novo plano",
  "Mudança importante no estudante ou na turma",
  "Transferência de escola",
  "Fim do ano letivo",
] as const;
