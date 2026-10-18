// Testes do ciclo de vida do plano: node --test src/lib/plan-lifecycle.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextReviewProblem, reviewOnTime, reviewSummary, suggestedNextReview } from "./plan-lifecycle.ts";

const at = (iso) => new Date(`${iso}-03:00`);

test("no prazo: até o dia marcado, pelo calendário de Brasília", () => {
  assert.equal(reviewOnTime(at("2026-11-16T22:30:00"), at("2026-11-16T12:00:00")), true);
  assert.equal(reviewOnTime(at("2026-11-17T00:10:00"), at("2026-11-16T12:00:00")), false);
  assert.equal(reviewOnTime(at("2026-10-01T09:00:00"), at("2026-11-16T12:00:00")), true);
});

test("próxima revisão: depois de hoje e em até um ano", () => {
  const now = at("2026-10-18T10:00:00");
  assert.equal(nextReviewProblem(at("2026-10-18T12:00:00"), now), "A próxima revisão precisa ser depois de hoje.");
  assert.equal(nextReviewProblem(at("2026-10-19T12:00:00"), now), null);
  assert.match(nextReviewProblem(at("2027-12-01T12:00:00"), now), /no máximo um ano/);
  assert.match(nextReviewProblem(new Date("x"), now), /Informe/);
});

test("data sugerida: 12 semanas depois, no formato do campo de data", () => {
  assert.equal(suggestedNextReview(at("2026-10-18T10:00:00")), "2027-01-10");
});

test("resumo das revisões: quantas no prazo e o percentual (sem base, null)", () => {
  assert.deepEqual(reviewSummary([]), { total: 0, onTime: 0, pct: null });
  assert.deepEqual(reviewSummary([{ onTime: true }, { onTime: false }, { onTime: true }]), { total: 3, onTime: 2, pct: 67 });
});
