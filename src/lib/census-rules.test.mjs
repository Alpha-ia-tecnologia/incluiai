// Testes das regras do Censo: node --test src/lib/census-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEducacensoFile, specialEdPersons } from "./educacenso.ts";
import { SAMPLE } from "./educacenso.fixture.mjs";
import { buildSyncPlan, censusCounts, regularOnlyIds, cleanMonitorConfig, fundebComparison, monitorState, nextRun, stageFromAge, sumCounts, toSnapshot, verifyCoverage } from "./census-rules.ts";

const now = new Date("2026-10-22T15:00:00Z");
const persons = specialEdPersons(parseEducacensoFile(SAMPLE));
const students = [
  { id: "s1", name: "Dante Ribeiro", birthDate: "2019-03-12", inepId: null, cpf: null, hasAEE: false },
  { id: "s2", name: "Lívia Martins", birthDate: "2018-01-10", inepId: null, cpf: null, hasAEE: true },
  { id: "s3", name: "Só no AEE", birthDate: "2018-02-01", inepId: null, cpf: null, hasAEE: true },
  { id: "s4", name: "Só no AEE", birthDate: "2017-05-05", inepId: null, cpf: null, hasAEE: false },
];

test("etapa estimada pela idade em 31 de março", () => {
  assert.equal(stageFromAge("2021-03-31", now), "educacao_infantil");
  assert.equal(stageFromAge("2020-03-31", now), "anos_iniciais");
  assert.equal(stageFromAge("2020-04-01", now), "educacao_infantil");
  assert.equal(stageFromAge("2012-01-01", now), "anos_finais");
  assert.equal(stageFromAge("2000-01-01", now), "eja");
});

test("plano: atualiza quem já está, cria quem falta, pede revisão de homônimos", () => {
  const plan = buildSyncPlan(persons, students, { now });
  const byName = Object.fromEntries(plan.items.map((item) => [item.censusName, item]));
  assert.equal(byName["DANTE RIBEIRO"].action, "update");
  assert.equal(byName["DANTE RIBEIRO"].matchedBy, "nome_nascimento");
  assert.deepEqual(byName["DANTE RIBEIRO"].diffs.map((diff) => diff.field), ["inepId", "cpf", "hasAEE"]);
  assert.equal(byName["NOVA ALUNA DA SILVA"].action, "create");
  assert.deepEqual(byName["NOVA ALUNA DA SILVA"].create, { name: "Nova Aluna da Silva", birthDate: "2018-06-05", inepId: "999888777666", cpf: null, hasAEE: true, className: "A informar", stage: "anos_iniciais" });
  assert.match(byName["NOVA ALUNA DA SILVA"].warnings.join(" "), /Dupla matrícula não confirmada/);
  assert.deepEqual([byName["MENINO DA PRE"].create.stage, byName["MENINO DA PRE"].create.className], ["educacao_infantil", "PRE II"]);
  assert.equal(byName["SO NO AEE"].action, "review");
  assert.equal(byName["SO NO AEE"].candidates.length, 2);
  // Enquanto o homônimo não é vinculado na revisão, quem tem AEE fica como ausente.
  assert.deepEqual(plan.missing, [{ id: "s2", name: "Lívia Martins" }, { id: "s3", name: "Só no AEE" }]);
  assert.equal(plan.totals.doublePending, 3);
});

test("plano: decisões da revisão e transferência de outra escola", () => {
  const plan = buildSyncPlan(persons, students, { now, decisions: [
    { personKey: "111222333444", decision: "link", studentId: "s3" },
    { personKey: "999888777666", decision: "ignore", reason: "Transferida em setembro" },
  ] });
  const linked = plan.items.find((item) => item.key === "111222333444");
  assert.equal(linked.matchedBy, "manual");
  assert.equal(linked.studentId, "s3");
  assert.deepEqual(plan.ignored, [{ key: "999888777666", censusName: "NOVA ALUNA DA SILVA", reason: "Transferida em setembro" }]);
  assert.deepEqual(plan.missing, [{ id: "s2", name: "Lívia Martins" }]);
  const elsewhere = buildSyncPlan(persons, [], { now, elsewhere: (keys) => keys.includes("inep:999888777666") });
  const moved = elsewhere.items.find((item) => item.key === "999888777666");
  assert.equal(moved.action, "review");
  assert.equal(moved.elsewhere, true);
  const forced = buildSyncPlan(persons, [], { now, decisions: [{ personKey: "999888777666", decision: "create" }], elsewhere: () => true });
  assert.equal(forced.items.find((item) => item.key === "999888777666").action, "create");
});

test("verificação: dupla matrícula, sem AEE, sem classe comum, sem marcação e ausente", () => {
  const snapshot = toSnapshot(persons);
  const team = [
    { id: "a", name: "Dante Ribeiro", birthDate: "2019-03-12", inepId: "123456789012", cpf: null, hasAEE: true },
    { id: "b", name: "Nova Aluna da Silva", birthDate: "2018-06-05", inepId: null, cpf: null, hasAEE: true },
    { id: "c", name: "Aluno Sem Deficiencia", birthDate: "2017-01-01", inepId: null, cpf: "55544433322", hasAEE: true },
    { id: "d", name: "Ninguém", birthDate: "2017-01-01", inepId: null, cpf: null, hasAEE: true },
    { id: "e", name: "Sem AEE na plataforma", birthDate: "2017-01-01", inepId: null, cpf: null, hasAEE: false },
  ];
  const coverage = verifyCoverage(team, snapshot, new Set(regularOnlyIds(team, parseEducacensoFile(SAMPLE).persons)));
  assert.deepEqual(coverage.rows.map((row) => row.status), ["dupla", "sem_comum", "sem_marcacao", "ausente"]);
  assert.equal(coverage.confirmed, 1);
  assert.equal(coverage.pending, 3);
  assert.equal(coverage.percent, 25);
  const special = { ...snapshot[0], key: "x", name: "SEM AEE", inepId: "777", aee: false };
  assert.equal(verifyCoverage([{ id: "f", name: "Sem Aee", birthDate: "", inepId: "777", cpf: null, hasAEE: true }], [special]).rows[0].status, "sem_aee");
});

test("contagens do arquivo, por etapa, e comparação com o FNDE", () => {
  const counts = censusCounts(toSnapshot(persons));
  assert.deepEqual(counts, { especial: 5, aee: 5, dupla: 2, aeeSemComum: 3, especialSemAee: 0, duplaByStage: { 301: 1, 302: 1 } });
  assert.deepEqual(sumCounts([counts, counts]).duplaByStage, { 301: 2, 302: 2 });
  assert.equal(sumCounts([counts, counts]).dupla, 4);
  assert.match(fundebComparison(1, null).text, /Informe as matrículas/);
  assert.equal(fundebComparison(136, 136).difference, 0);
  assert.match(fundebComparison(150, 136).text, /14 matrículas de AEE com dupla matrícula a mais.*não comprova perda/);
  assert.match(fundebComparison(130, 136).text, /O FNDE considerou 6 matrículas/);
});

test("janela do Censo: duas verificações por dia, no horário de Brasília", () => {
  const config = { enabled: true, periodStart: "2026-10-20", periodEnd: "2026-10-23", times: ["16:00", "08:00"] };
  assert.equal(nextRun(config, now).toISOString(), "2026-10-22T19:00:00.000Z"); // 12h em Brasília → 16h
  assert.equal(nextRun(config, new Date("2026-10-22T20:00:00Z")).toISOString(), "2026-10-23T11:00:00.000Z");
  assert.equal(nextRun(config, new Date("2026-10-23T20:00:00Z")), null);
  assert.equal(monitorState(config, now, null).status, "ativo");
  assert.equal(monitorState({ ...config, periodStart: "2027-05-26", periodEnd: "2027-08-31" }, now, null).status, "aguardando");
  assert.equal(monitorState({ ...config, periodStart: "2026-05-27", periodEnd: "2026-08-31" }, now, null).status, "fora");
  assert.equal(monitorState({ ...config, enabled: false }, now, null).status, "desligado");
  assert.match(monitorState(config, now, null).text, /Próxima verificação: 22\/10\/2026 às 16:00/);
});

test("configuração da janela: datas e horários válidos", () => {
  assert.deepEqual(cleanMonitorConfig({ enabled: true, periodStart: "2027-05-26", periodEnd: "2027-08-31", times: ["16:00", "08:00", "08:00"] }), { enabled: true, periodStart: "2027-05-26", periodEnd: "2027-08-31", times: ["08:00", "16:00"] });
  assert.match(cleanMonitorConfig({ enabled: true, periodStart: "2027-08-31", periodEnd: "2027-05-26", times: ["08:00"] }).error, /fim da janela vem antes/);
  assert.match(cleanMonitorConfig({ enabled: true, periodStart: "2027-05-26", periodEnd: "2027-08-31", times: ["25:00"] }).error, /de 1 a 4 horários/);
  assert.match(cleanMonitorConfig({ enabled: true, periodStart: "2027-02-30", periodEnd: "2027-08-31", times: ["08:00"] }).error, /datas/);
});
