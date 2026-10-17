// Testes das séries dos gráficos: node --test src/lib/series.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { countItems, criterionSplit, monthlyCounts, participationSplit, percentOf, sessionsByMonth, supportSeries, supportTrend, weeklyCounts } from "./series.ts";

const at = (iso) => new Date(`${iso}T12:00:00-03:00`);

test("registros por semana: últimas N semanas, a atual por último, segunda a domingo", () => {
  const now = at("2026-10-17"); // sábado
  const weeks = weeklyCounts([at("2026-10-12"), at("2026-10-17"), at("2026-10-11"), at("2026-09-01")], 3, now);
  assert.equal(weeks.length, 3);
  assert.deepEqual(weeks.map((week) => week.value), [0, 1, 2]);
  assert.equal(weeks[2].label, "12/10");
});

test("registros por mês: o mês atual por último, com nome completo no título", () => {
  const months = monthlyCounts([at("2026-10-02"), at("2026-10-20"), at("2026-08-15")], 3, at("2026-10-17"));
  assert.deepEqual(months.map((month) => [month.label, month.value]), [["ago", 1], ["set", 0], ["out", 2]]);
  assert.equal(months[2].title, "outubro de 2026");
});

test("série do apoio: ordem por data, por objetivo e presa entre 0 e 5", () => {
  const entries = [
    { date: at("2026-10-03"), supportLevel: 3, objectiveId: "a" },
    { date: at("2026-10-01"), supportLevel: 4, objectiveId: "a" },
    { date: at("2026-10-02"), supportLevel: 9, objectiveId: "b" },
  ];
  assert.deepEqual(supportSeries(entries, "a").map((point) => point.value), [4, 3]);
  assert.deepEqual(supportSeries(entries).map((point) => point.value), [4, 5, 3]);
});

test("tendência: menos apoio no fim é avanço; poucos registros não concluem", () => {
  assert.deepEqual(supportTrend([4, 4, 3, 2, 2]), { trend: "avancando", delta: -2 });
  assert.equal(supportTrend([2, 2, 3, 4]).trend, "atencao");
  assert.equal(supportTrend([3, 3, 3, 3]).trend, "estavel");
  assert.deepEqual(supportTrend([3, 2]), { trend: "sem_dados", delta: null });
});

test("divisões de participação e de critério contam cada situação", () => {
  const entries = [{ participation: "total", criterionMet: "sim" }, { participation: "total", criterionMet: "parcial" }, { participation: "recusou", criterionMet: "nao" }];
  assert.deepEqual(participationSplit(entries).map((segment) => segment.value), [2, 0, 1]);
  assert.deepEqual(criterionSplit(entries).map((segment) => segment.value), [1, 1, 1]);
});

test("o que funcionou: conta itens separados por ponto e vírgula, do mais citado ao menos", () => {
  const items = countItems(["Cartões; Pausa", "Pausa", null, "Cartões;Pausa; Música"], 2);
  assert.deepEqual(items, [{ label: "Pausa", value: 3 }, { label: "Cartões", value: 2 }]);
});

test("frequência do AEE por mês separa realizado, falta e cancelamento", () => {
  const months = sessionsByMonth([{ date: at("2026-10-01"), status: "realizado" }, { date: at("2026-10-08"), status: "falta" }, { date: at("2026-09-08"), status: "cancelamento" }], 2, at("2026-10-17"));
  assert.deepEqual(months.map((month) => [month.label, month.realizado, month.falta, month.cancelamento, month.value]), [["set", 0, 0, 1, 1], ["out", 1, 1, 0, 2]]);
});

test("percentual sem base é null, nunca 0%", () => {
  assert.equal(percentOf(0, 0), null);
  assert.equal(percentOf(9, 11), 82);
});
