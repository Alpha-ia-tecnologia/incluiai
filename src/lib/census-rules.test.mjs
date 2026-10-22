// Testes das regras do Censo: node --test src/lib/census-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEducacensoFile, specialEdPersons } from "./educacenso.ts";
import { SAMPLE } from "./educacenso.fixture.mjs";
import { buildSyncPlan, censusCounts, issuesOf, networkAeeEstimate, personWarnings, regularOnlyIds, schoolFundebNote, cleanMonitorConfig, fundebComparison, monitorState, nextRun, stageFromAge, sumCounts, toSnapshot, verifyCoverage } from "./census-rules.ts";

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
  assert.equal(plan.totals.doublePending, 5);
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
  assert.deepEqual(counts, { especial: 7, aee: 7, dupla: 2, aeeSemComum: 5, especialSemAee: 0, duplaByStage: { 301: 1, 302: 1 } });
  assert.deepEqual(sumCounts([counts, counts]).duplaByStage, { 301: 2, 302: 2 });
  assert.equal(sumCounts([counts, counts]).dupla, 4);
  assert.match(fundebComparison(1, null).text, /Informe as matrículas/);
  assert.equal(fundebComparison(136, 136).difference, 0);
  assert.match(fundebComparison(150, 136).text, /indicam 14 matrículas de AEE a mais.*não comprova perda/);
  assert.match(fundebComparison(130, 136).text, /O FNDE considerou 6 matrículas/);
});

test("alertas do vínculo: sem tipo de AEE, horário coincidente, vínculos demais, AEE repetido e classe comum a distância", () => {
  const byName = Object.fromEntries(persons.map((person) => [person.name, person]));
  assert.match(personWarnings(byName["SO NO AEE"]).join(" "), /sem nenhum tipo de atendimento.*recusa o arquivo/);
  assert.match(personWarnings(byName["MENINO DA PRE"]).join(" "), /horário do AEE coincide.*Nota Técnica Conjunta nº 12\/2025/);
  assert.match(personWarnings(byName["MENINO DA PRE"]).join(" "), /conta um só por aluno/);
  assert.match(personWarnings(byName["ALUNO A DISTANCIA"]).join(" "), /semipresencial ou a distância/);
  assert.match(personWarnings(byName["ALUNO DE MUITOS VINCULOS"]).join(" "), /Mais de 4 vínculos/);
  const snapshot = Object.fromEntries(toSnapshot(persons).map((person) => [person.name, person]));
  assert.deepEqual(issuesOf(snapshot["SO NO AEE"]), ["sem_tipo_aee"]);
  assert.deepEqual(issuesOf(snapshot["MENINO DA PRE"]), ["horario_coincidente", "aee_duplicado"]);
  assert.deepEqual(issuesOf(snapshot["ALUNO A DISTANCIA"]), ["comum_nao_presencial"]);
  assert.deepEqual(issuesOf(snapshot["ALUNO DE MUITOS VINCULOS"]), ["vinculos_demais", "aee_duplicado"]);
  assert.deepEqual(issuesOf(snapshot["DANTE RIBEIRO"]), []);
  // Referência antiga, sem os campos novos: nenhum alerta.
  assert.deepEqual(issuesOf({ key: "x", name: "X", inepId: "", cpf: "", birthDate: "", special: true, aee: true, regular: true, stage: "302" }), []);
});

test("verificação: classe comum em outra escola da rede e vínculo bloqueado não confirmam por engano", () => {
  const snapshot = toSnapshot(persons);
  const team = [
    { id: "n", name: "Nova Aluna da Silva", birthDate: "2018-06-05", inepId: "999888777666", cpf: null, hasAEE: true },
    { id: "s", name: "So no AEE", birthDate: "", inepId: "111222333444", cpf: null, hasAEE: true },
  ];
  const elsewhere = (keys) => (keys.includes("inep:999888777666") ? "EMEF Outra" : null);
  const coverage = verifyCoverage(team, snapshot, new Set(), elsewhere);
  assert.deepEqual(coverage.rows.map((row) => [row.status, row.regularAt ?? null]), [["dupla", "EMEF Outra"], ["sem_comum", null]]);
  assert.equal(coverage.confirmed, 1);
  const blocked = verifyCoverage([{ id: "p", name: "Aluno de Muitos Vinculos", birthDate: "2016-04-04", inepId: null, cpf: null, hasAEE: true }], snapshot.map((person) => ({ ...person, regular: true })));
  assert.equal(blocked.rows[0].status, "dupla");
  assert.equal(blocked.confirmed, 0); // mais de 4 vínculos: o Educacenso não importa a pessoa
});

test("Fundeb: dependência da escola e estimativa do AEE considerado na rede", () => {
  assert.equal(schoolFundebNote({ dependency: "municipal", privateCategory: "", municipalPartnership: false }).tone, "ok");
  assert.match(schoolFundebNote({ dependency: "estadual", privateCategory: "", municipalPartnership: false }).text, /conta para a rede estadual/);
  assert.equal(schoolFundebNote({ dependency: "federal", privateCategory: "", municipalPartnership: false }).tone, "fora");
  assert.match(schoolFundebNote({ dependency: "privada", privateCategory: "4", municipalPartnership: true }).text, /exclusivamente em educação especial/);
  assert.equal(schoolFundebNote({ dependency: "privada", privateCategory: "1", municipalPartnership: false }).tone, "fora");
  assert.match(schoolFundebNote({ dependency: "", privateCategory: "", municipalPartnership: false }).text, /não informa a dependência/);

  const municipal = { dependency: "municipal", privateCategory: "", municipalPartnership: false };
  const school = toSnapshot(persons);
  // Outra escola municipal com a classe comum da Nova Aluna e o AEE repetido do Dante.
  const other = [
    { key: "a", name: "NOVA ALUNA DA SILVA", inepId: "999888777666", cpf: "", birthDate: "2018-06-05", special: true, aee: false, regular: true, stage: "302" },
    { key: "b", name: "DANTE RIBEIRO", inepId: "123456789012", cpf: "", birthDate: "2019-03-12", special: true, aee: true, regular: false, stage: "", aeeLinks: 1, aeeNoService: 0, activityLinks: 1 },
  ];
  const state = [{ key: "c", name: "ESTUDANTE DO ESTADO", inepId: "777777777777", cpf: "", birthDate: "2010-01-01", special: true, aee: true, regular: true, stage: "304", aeeLinks: 1, aeeNoService: 0, activityLinks: 1 }];
  const estimate = networkAeeEstimate([
    { id: "1", name: "EMEF Paulo Freire", info: municipal, persons: school },
    { id: "2", name: "EMEF Outra", info: municipal, persons: other },
    { id: "3", name: "Escola estadual", info: { ...municipal, dependency: "estadual" }, persons: state },
  ]);
  // Contam: Dante (302), Menino da Pré (301) e Nova Aluna (classe comum na outra escola, 302).
  // Sem classe comum presencial pública nos arquivos: a da classe especial e o aluno a distância.
  assert.deepEqual(estimate, { considered: 3, byStage: { 301: 1, 302: 2 }, notVerifiable: 2, blocked: 2, repeated: 1, otherNetwork: 1, partner: 0 });
  // Só a outra escola: o Dante já não se repete e a classe comum dele está na primeira.
  assert.equal(networkAeeEstimate([
    { id: "1", name: "EMEF Paulo Freire", info: municipal, persons: school },
    { id: "2", name: "EMEF Outra", info: municipal, persons: other },
  ], "2").considered, 1);
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
