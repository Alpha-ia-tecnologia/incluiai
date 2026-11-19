import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonsOf, objectiveSupportTrend, supportTrend, trendLabel, trendMessage } from "./support-trend.ts";

const lessons = (levels, participation = "total") => levels.map((supportLevel) => ({ supportLevel, participation }));

test("tendência: com menos de 3 aulas não conclui", () => {
  assert.equal(supportTrend([]).trend, "sem_dados");
  assert.deepEqual(supportTrend([3, 2]), { trend: "sem_dados", reason: "poucos", delta: null, goalReached: false, levels: [3, 2], refusals: 0 });
  assert.equal(supportTrend([2], { target: 2 }).goalReached, true);
  assert.equal(supportTrend([2], { target: 2 }).trend, "sem_dados");
});

test("tendência: menos apoio nas aulas recentes é avanço", () => {
  assert.deepEqual(supportTrend([4, 4, 3, 2, 2]), { trend: "avancando", reason: "menos_apoio", delta: -2, goalReached: false, levels: [4, 4, 3, 2, 2], refusals: 0 });
  assert.equal(supportTrend([3, 2, 2], { target: 1 }).trend, "avancando");
});

test("tendência: a última aula na meta é avanço, mesmo depois de subir o apoio", () => {
  const reading = supportTrend([1, 1, 0, 2, 2], { target: 2 });
  assert.equal(reading.trend, "avancando");
  assert.equal(reading.reason, "meta");
  assert.equal(trendLabel(reading), "Meta alcançada");
});

test("tendência: alerta só quando o apoio sobe um nível inteiro, em pelo menos 4 aulas", () => {
  assert.equal(supportTrend([2, 2, 3, 4]).trend, "atencao");
  assert.equal(supportTrend([2, 2, 3, 4]).reason, "mais_apoio");
  assert.equal(supportTrend([3, 3, 3, 3, 4, 4]).trend, "estavel", "meio nível a mais não é alerta");
  assert.equal(supportTrend([2, 2, 3]).trend, "estavel", "com 3 aulas, uma aula a mais de apoio não é alerta");
  assert.equal(trendLabel(supportTrend([2, 2, 3, 4])), "Pede atenção");
});

test("tendência: 2 recusas nas 4 últimas aulas pedem atenção, mesmo com a meta alcançada", () => {
  const entries = [...lessons([2, 1, 1]), { supportLevel: 1, participation: "recusou" }, { supportLevel: 1, participation: "recusou" }];
  const reading = supportTrend(entries, { target: 1 });
  assert.equal(reading.trend, "atencao");
  assert.equal(reading.reason, "recusas");
  assert.match(trendMessage(reading, entries.length), /^Recusou 2 das 4 últimas aulas/);
  assert.equal(supportTrend([...lessons([2, 2, 2]), { supportLevel: 2, participation: "recusou" }]).trend, "estavel", "uma recusa não é alerta");
});

test("tendência: aulas sem avanço ficam estáveis, com a dica de fracionar", () => {
  const reading = supportTrend([3, 3, 3, 3], { target: 1 });
  assert.equal(reading.trend, "estavel");
  assert.equal(reading.reason, "sem_avanco");
  assert.match(trendMessage(reading, 4), /fracionar/);
  assert.equal(supportTrend([3, 3, 4, 3, 3]).reason, "estavel", "voltou a precisar de menos apoio na última");
});

test("tendência: só as 8 aulas mais recentes contam", () => {
  const reading = supportTrend([5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(reading.levels, [2, 2, 2, 2, 2, 2, 2, 2]);
  assert.equal(reading.trend, "estavel");
});

test("tendência do objetivo: só as aulas dele, em ordem de data", () => {
  const at = (day) => new Date(`2026-10-${day}T12:00:00-03:00`);
  const entries = [
    { objectiveId: "a", date: at("20"), supportLevel: 2, participation: "total" },
    { objectiveId: "b", date: at("19"), supportLevel: 5, participation: "recusou" },
    { objectiveId: "a", date: at("05"), supportLevel: 4, participation: "total" },
    { objectiveId: "a", date: at("12"), supportLevel: 3, participation: "parcial" },
  ];
  assert.deepEqual(lessonsOf(entries, "a").map((entry) => entry.supportLevel), [4, 3, 2]);
  const reading = objectiveSupportTrend({ id: "a", targetSupport: 1 }, entries);
  assert.equal(reading.lessons, 3);
  assert.equal(reading.trend, "avancando");
  assert.equal(trendMessage(objectiveSupportTrend({ id: "c", targetSupport: 1 }, entries), 0), "Aplique uma atividade e registre em 3 toques.");
});
