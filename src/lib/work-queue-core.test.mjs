import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEW_HORIZON_DAYS, buildQueue, queueSince, whenWords } from "./work-queue-core.ts";

const NOW = new Date("2026-11-18T15:00:00-03:00");
const day = (offset) => new Date(NOW.getTime() + offset * 86_400_000);
const student = (id, fields = {}) => ({ id, name: id, createdAt: day(-90), alerts: [], reviewDate: day(90), caseStudy: { status: "concluido", updatedAt: day(-80) }, hasPlan: true, hasRecord: true, ...fields });
const facts = (fields = {}) => ({ students: [], records: [], familyNotes: [], checkIns: [], guidance: [], suggestions: [], planDrafts: [], ...fields });
const queue = (input, nominal = true) => buildQueue(facts(input), { now: NOW, nominal });
const kinds = (items) => items.map((item) => `${item.kind}:${item.subject ?? item.count}`);

test("data em palavras, pelo dia de Brasília", () => {
  assert.equal(whenWords(NOW, NOW), "hoje");
  assert.equal(whenWords(day(-1), NOW), "ontem");
  assert.equal(whenWords(day(1), NOW), "amanhã");
  assert.equal(whenWords(day(3), NOW), "em 3 dias");
  assert.equal(whenWords(day(-12), NOW), "há 12 dias");
  assert.equal(whenWords(day(-95), NOW), "há 3 meses");
  assert.equal(whenWords(day(-30), NOW), "há 30 dias");
  assert.equal(whenWords(new Date("2026-11-17T23:50:00-03:00"), new Date("2026-11-18T00:10:00-03:00")), "ontem");
  assert.equal(queueSince(NOW).toISOString(), new Date("2026-11-17T00:00:00-03:00").toISOString());
});

test("fila vazia quando nada mudou e nada vence", () => {
  const empty = queue({ students: [student("Dante")] });
  assert.deepEqual(empty, { recent: [], due: [] });
});

test("desde ontem: aulas de outras pessoas por estudante, conquista, semana, orientação e estudante novo", () => {
  const { recent } = queue({
    students: [student("Dante"), student("Ravi"), student("Aluna", { createdAt: day(-1), hasPlan: false, hasRecord: false, reviewDate: null, caseStudy: null })],
    records: [{ studentId: "Dante", date: day(0), author: "Marcos" }, { studentId: "Dante", date: day(-1), author: "Ana" }, { studentId: "Ravi", date: day(-3), author: "Ana" }],
    familyNotes: [{ studentId: "Dante", date: day(-1), author: "Carla (mãe)", note: "Apontou o nome sem ajuda!" }, { studentId: "Ravi", date: day(-8), author: "Pai", note: "Antiga" }],
    checkIns: [{ studentId: "Ravi", date: day(0), author: "Pai" }],
    guidance: [{ studentId: "Dante", date: day(0), author: "Dra. Helena" }],
  });
  assert.deepEqual(kinds(recent).sort(), ["aula:Dante", "conquista:Dante", "novo:Aluna", "orientacao:Dante", "semana:Ravi"]);
  const lesson = recent.find((item) => item.kind === "aula");
  assert.equal(lesson.title, "2 aulas registradas");
  assert.equal(lesson.detail, "por Marcos e Ana");
  assert.equal(lesson.href, "/estudantes/Dante/diario#historico-registros");
  assert.equal(lesson.when, "hoje");
  assert.equal(recent.find((item) => item.kind === "conquista").detail, "Carla (mãe): “Apontou o nome sem ajuda!”");
  assert.ok(recent.every((item) => !item.crossed), "novidade não é alerta");
  const times = recent.map((item) => item.date.getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a), "mais recente primeiro");
});

test("estudante novo só enquanto nada foi feito", () => {
  const { recent } = queue({ students: [student("Antigo", { createdAt: day(-2), hasPlan: false, hasRecord: false }), student("Com plano", { createdAt: day(0) })] });
  assert.deepEqual(recent, []);
});

test("sugestões da IA: novas em 'desde ontem', antigas aguardando em 'vence em breve'", () => {
  const { recent, due } = queue({
    students: [student("Dante"), student("Ravi")],
    suggestions: [{ studentId: "Dante", date: day(0) }, { studentId: "Dante", date: day(-5) }, { studentId: "Ravi", date: day(-9) }],
    planDrafts: [{ studentId: "Ravi", date: day(-1) }],
  });
  assert.deepEqual(kinds(recent).sort(), ["proposta:Ravi", "sugestao:Dante"]);
  assert.equal(recent.find((item) => item.kind === "sugestao").title, "2 sugestões de atividade para avaliar");
  assert.deepEqual(kinds(due), ["sugestao:Ravi"]);
  assert.equal(due[0].title, "Sugestão de atividade aguardando");
  assert.equal(due[0].when, "há 9 dias");
  assert.equal(due[0].crossed, false);
});

test("vence em breve: ordem de data, com cor de estado só no que passou do limite", () => {
  const { due } = queue({
    students: [
      student("Lívia", { reviewDate: day(-16), alerts: [{ kind: "plano_vencido", message: "", since: day(-16) }, { kind: "sem_registro", message: "", since: day(-29) }] }),
      student("Ravi", { reviewDate: day(4), alerts: [{ kind: "sem_registro", message: "", since: day(-17) }] }),
      student("Dante", { reviewDate: day(REVIEW_HORIZON_DAYS), caseStudy: { status: "rascunho", updatedAt: day(-3) } }),
      student("Longe", { reviewDate: day(REVIEW_HORIZON_DAYS + 1) }),
    ],
  });
  assert.deepEqual(kinds(due), ["sem_registro:Lívia", "sem_registro:Ravi", "revisao:Lívia", "estudo:Dante", "revisao:Ravi", "revisao:Dante"]);
  assert.deepEqual(due.map((item) => item.when), ["há 29 dias", "há 17 dias", "há 16 dias", "há 3 dias", "em 4 dias", `em ${REVIEW_HORIZON_DAYS} dias`]);
  assert.deepEqual(due.filter((item) => item.crossed).map((item) => `${item.kind}:${item.subject}`), ["sem_registro:Lívia", "sem_registro:Ravi", "revisao:Lívia"]);
  assert.equal(due.find((item) => item.subject === "Lívia" && item.kind === "revisao").title, "Revisão do plano vencida");
  assert.equal(due.find((item) => item.subject === "Ravi" && item.kind === "revisao").title, "Revisão do plano");
  assert.equal(due.find((item) => item.subject === "Ravi" && item.kind === "revisao").href, "/estudantes/Ravi/ppi#revisao");
});

test("estudante que avança não aparece como alerta", () => {
  const { recent, due } = queue({ students: [student("Dante", { reviewDate: day(12) })], records: [{ studentId: "Dante", date: day(0), author: "Ana" }] });
  assert.ok([...recent, ...due].every((item) => !item.crossed));
  assert.deepEqual(kinds(due), ["revisao:Dante"]);
});

test("tendência e recusas viram um só item de evolução, com a frase do aviso", () => {
  const { due } = queue({
    students: [student("Ravi", { alerts: [{ kind: "tendencia", message: "Um objetivo pede atenção nas últimas aulas.", since: day(-2) }, { kind: "queda_participacao", message: "Recusou 3 das 5 últimas aulas.", since: day(-2) }] })],
  });
  assert.deepEqual(kinds(due), ["evolucao:Ravi"]);
  assert.equal(due[0].detail, "Um objetivo pede atenção nas últimas aulas.");
  assert.equal(due[0].href, "/estudantes/Ravi/linha-do-tempo");
  assert.ok(due[0].crossed);
});

test("itens de quem não está no escopo ficam de fora", () => {
  const { recent } = queue({ students: [student("Dante")], records: [{ studentId: "Outro", date: day(0), author: "Ana" }] });
  assert.deepEqual(recent, []);
});

test("sem nomes (Secretaria): números da rede ligados ao Painel", () => {
  const { recent, due } = queue({
    students: [
      student("Lívia", { reviewDate: day(-16), alerts: [{ kind: "plano_vencido", message: "", since: day(-16) }, { kind: "sem_registro", message: "", since: day(-29) }] }),
      student("Ravi", { reviewDate: day(4), alerts: [{ kind: "sem_registro", message: "", since: day(-17) }] }),
      student("Dante", { reviewDate: day(10) }),
      student("Nova", { createdAt: day(0), hasPlan: false, hasRecord: false, reviewDate: null, caseStudy: null }),
    ],
    records: [{ studentId: "Dante", date: day(0), author: "Ana" }, { studentId: "Ravi", date: day(-1), author: "Ana" }, { studentId: "Ravi", date: day(-6), author: "Ana" }],
  }, false);
  assert.deepEqual(recent.map((item) => [item.title, item.count]), [["Aulas registradas", 2], ["Estudante novo", 1]]);
  assert.deepEqual(due.map((item) => [item.title, item.count, item.crossed]), [
    ["Plano com revisão vencida", 1, true],
    ["Estudantes sem registro há 14 dias ou mais", 2, true],
    ["Revisões de plano nos próximos 30 dias", 2, false],
  ]);
  for (const item of recent) assert.equal(item.href, "/painel");
  for (const item of due) assert.equal(item.href, "/painel#atencao");
  for (const item of [...recent, ...due]) {
    assert.equal(item.subject, null);
    assert.ok(!["Lívia", "Ravi", "Dante", "Nova"].some((name) => `${item.title}${item.detail ?? ""}`.includes(name)));
  }
});
