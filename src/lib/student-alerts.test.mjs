import { test } from "node:test";
import assert from "node:assert/strict";
import { ALERTS, RECORD_GAP_DAYS, alertsFor } from "./student-alerts.ts";

const NOW = new Date("2026-11-18T15:00:00-03:00");
const day = (offset) => new Date(NOW.getTime() + offset * 86_400_000);
const plan = (fields = {}) => ({ status: "ativo", reviewDate: day(30), createdAt: day(-60), objectives: [{ status: "ativo" }], ...fields });
const entry = (offset, participation = "total", objectiveId = "o1") => ({ date: day(offset), participation, objectiveId });
const kinds = (input) => alertsFor({ now: NOW, ...input }).map((alert) => alert.kind);

test("estudante que avança, com registro recente e plano em dia, não tem aviso", () => {
  assert.deepEqual(kinds({ plans: [plan()], entries: [entry(-21), entry(-14), entry(-7), entry(-5)], trends: [{ objectiveId: "o1", trend: "avancando" }] }), []);
});

test("sem plano e sem registro é etapa da trilha, não aviso", () => {
  assert.deepEqual(kinds({ plans: [], entries: [] }), []);
  assert.deepEqual(kinds({ plans: [plan({ objectives: [] })], entries: [] }), []);
  assert.deepEqual(kinds({ plans: [plan({ status: "encerrado", reviewDate: day(-90) })], entries: [] }), []);
});

test("sem registro: só a partir do limite de dias, contado do último registro", () => {
  assert.equal(RECORD_GAP_DAYS, 14);
  assert.deepEqual(kinds({ plans: [plan()], entries: [entry(-(RECORD_GAP_DAYS - 1))] }), []);
  const [alert] = alertsFor({ now: NOW, plans: [plan()], entries: [entry(-RECORD_GAP_DAYS - 3), entry(-RECORD_GAP_DAYS - 10)] });
  assert.equal(alert.kind, "sem_registro");
  assert.equal(alert.message, `Sem registro de acompanhamento há ${RECORD_GAP_DAYS + 3} dias.`);
  assert.equal(alert.since.getTime(), day(-RECORD_GAP_DAYS - 3).getTime());
});

test("sem registro: com objetivo ativo e nenhum registro, conta desde o início do plano", () => {
  assert.deepEqual(kinds({ plans: [plan({ createdAt: day(-5) })], entries: [] }), []);
  assert.deepEqual(kinds({ plans: [plan({ createdAt: day(-20) })], entries: [] }), ["sem_registro"]);
});

test("sem registro: o dia vale em Brasília", () => {
  const lateNight = new Date("2026-11-04T23:30:00-03:00");
  assert.deepEqual(kinds({ plans: [plan()], entries: [{ date: lateNight, participation: "total" }] }), ["sem_registro"]);
  const nextDay = new Date("2026-11-05T00:30:00-03:00");
  assert.deepEqual(kinds({ plans: [plan()], entries: [{ date: nextDay, participation: "total" }] }), []);
});

test("revisão do plano: aviso só depois do dia marcado", () => {
  assert.deepEqual(kinds({ plans: [plan({ reviewDate: NOW })], entries: [entry(-2)] }), []);
  const [alert] = alertsFor({ now: NOW, plans: [plan({ reviewDate: day(-5) })], entries: [entry(-2)] });
  assert.equal(alert.kind, "plano_vencido");
  assert.equal(alert.message, "A revisão do plano venceu há 5 dias.");
  assert.equal(alertsFor({ now: NOW, plans: [plan({ reviewDate: day(-1) })], entries: [entry(-2)] })[0].message, "A revisão do plano venceu há 1 dia.");
});

test("tendência: aviso só quando a regra única diz atenção", () => {
  for (const trend of ["avancando", "estavel", "sem_dados"]) {
    assert.deepEqual(kinds({ plans: [plan()], entries: [entry(-2)], trends: [{ objectiveId: "o1", trend }] }), [], trend);
  }
  const [alert] = alertsFor({ now: NOW, plans: [plan()], entries: [entry(-9, "total", "o2"), entry(-3)], trends: [{ objectiveId: "o1", trend: "atencao" }, { objectiveId: "o2", trend: "estavel" }] });
  assert.equal(alert.kind, "tendencia");
  assert.equal(alert.message, "Um objetivo pede atenção nas últimas aulas.");
  assert.equal(alert.since.getTime(), day(-3).getTime());
  assert.equal(alertsFor({ now: NOW, plans: [plan()], entries: [entry(-1)], trends: [{ objectiveId: "o1", trend: "atencao" }, { objectiveId: "o2", trend: "atencao" }] })[0].message, "2 objetivos pedem atenção nas últimas aulas.");
});

test("recusas: aviso com pelo menos metade das últimas aulas recusadas, a partir de 4 registros", () => {
  assert.deepEqual(kinds({ plans: [plan()], entries: [entry(-3, "recusou"), entry(-2, "recusou"), entry(-1, "recusou")] }), []);
  assert.deepEqual(kinds({ plans: [plan()], entries: [entry(-4), entry(-3, "recusou"), entry(-2), entry(-1, "parcial")] }), []);
  const [alert] = alertsFor({ now: NOW, plans: [plan()], entries: [entry(-4), entry(-3, "recusou"), entry(-2), entry(-1, "recusou")] });
  assert.equal(alert.kind, "queda_participacao");
  assert.equal(alert.message, "Recusou 2 das 4 últimas aulas.");
  const old = [entry(-30, "recusou"), entry(-29, "recusou"), entry(-28, "recusou")];
  assert.deepEqual(kinds({ plans: [plan()], entries: [...old, ...[-6, -5, -4, -3, -2, -1].map((offset) => entry(offset))] }), [], "só as 6 últimas contam");
});

test("os avisos têm rótulo e vêm na ordem da tabela", () => {
  const all = alertsFor({
    now: NOW,
    plans: [plan({ reviewDate: day(-2) })],
    entries: [entry(-40, "recusou"), entry(-39, "recusou"), entry(-38), entry(-30, "recusou")],
    trends: [{ objectiveId: "o1", trend: "atencao" }],
  });
  assert.deepEqual(all.map((alert) => alert.kind), Object.keys(ALERTS));
  for (const alert of all) assert.ok(ALERTS[alert.kind].label && ALERTS[alert.kind].tone === "alert");
});
