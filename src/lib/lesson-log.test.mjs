import { test } from "node:test";
import assert from "node:assert/strict";
import { accountAuthorRole, defaultObjectiveId, lastRecordLabel, lessonLogHref, lessonProblems, missingAnswers, objectiveLabels, supportFromInput } from "./lesson-log.ts";

const objective = (id, fields = {}) => ({ id, action: "identificará seu nome entre 5 opções", condition: "com pista visual", criterion: "4 de 5 tentativas", dimension: "leitura", targetSupport: 1, ...fields });
const at = (iso) => new Date(`${iso}T12:00:00-03:00`);

test("rótulo do objetivo: área, ação e apoio da meta, em palavras", () => {
  const labels = objectiveLabels([objective("a"), objective("b", { action: "comunicará três necessidades da rotina escolar", dimension: "comunicacao", targetSupport: 0 })]);
  assert.equal(labels.get("a"), "Leitura · identificará seu nome entre 5 opções · meta Supervisão");
  assert.equal(labels.get("b"), "Comunicação · comunicará três necessidades da rotina escolar · meta Independente");
});

test("rótulo do objetivo: sem o nome do estudante no começo e com a ação longa encurtada na palavra", () => {
  const long = "lerá e escreverá palavras com sílabas simples do campo semântico do futebol durante a roda de conversa";
  const labels = objectiveLabels([objective("a", { action: "Dante identificará o próprio nome" }), objective("b", { action: long, dimension: "escrita" })], "Dante Oliveira");
  assert.equal(labels.get("a"), "Leitura · identificará o próprio nome · meta Supervisão");
  const action = labels.get("b").split(" · ")[1];
  assert.ok(action.endsWith("…") && action.length <= 71 && long.startsWith(action.slice(0, -1)), action);
});

test("rótulo do objetivo: condição e critério só entram quando separam objetivos iguais", () => {
  const labels = objectiveLabels([
    objective("a", { action: "comunicará três necessidades", dimension: "comunicacao", condition: "usando prancha de comunicação" }),
    objective("b", { action: "comunicará três necessidades", dimension: "comunicacao" }),
    objective("c", { action: "comunicará três necessidades", dimension: "comunicacao", criterion: "3 situações diferentes" }),
    objective("d"),
  ]);
  assert.equal(labels.get("a"), "Comunicação · comunicará três necessidades · usando prancha de comunicação · meta Supervisão");
  assert.equal(labels.get("b"), "Comunicação · comunicará três necessidades · com pista visual · 4 de 5 tentativas · meta Supervisão");
  assert.equal(labels.get("c"), "Comunicação · comunicará três necessidades · com pista visual · 3 situações diferentes · meta Supervisão");
  assert.equal(labels.get("d"), "Leitura · identificará seu nome entre 5 opções · meta Supervisão");
});

test("rótulo do objetivo: objetivos idênticos ganham número, e nenhum rótulo se repete", () => {
  const list = [objective("a", { condition: "usando prancha" }), objective("b"), objective("c"), objective("d")];
  const labels = objectiveLabels(list);
  assert.equal(new Set(labels.values()).size, list.length);
  assert.equal(labels.get("b"), "Leitura · identificará seu nome entre 5 opções · com pista visual · meta Supervisão");
  assert.equal(labels.get("c"), `${labels.get("b")} (2)`);
  assert.equal(labels.get("d"), `${labels.get("b")} (3)`);
  assert.equal(objectiveLabels([objective("a"), objective("b", { targetSupport: 0 })]).get("b"), "Leitura · identificará seu nome entre 5 opções · meta Independente");
});

test("objetivo em foco: o pedido do link vale se for um objetivo ativo", () => {
  const objectives = [objective("a"), objective("b")];
  assert.equal(defaultObjectiveId(objectives, [], ["b"]), "b");
  assert.equal(defaultObjectiveId(objectives, [], ["inexistente", "b"]), "b");
  assert.equal(defaultObjectiveId(objectives, [], ["inexistente", null, ""]), "a");
});

test("objetivo em foco: sem pedido, o ativo há mais tempo sem registro; nunca registrado vem antes", () => {
  const objectives = [objective("a"), objective("b"), objective("c")];
  const records = [
    { objectiveId: "a", date: at("2026-11-10") },
    { objectiveId: "b", date: at("2026-11-01") },
    { objectiveId: "b", date: at("2026-11-12") },
    { objectiveId: "c", date: at("2026-11-11") },
    { objectiveId: null, date: at("2026-10-01") },
    { objectiveId: "encerrado", date: at("2026-09-01") },
  ];
  assert.equal(defaultObjectiveId(objectives, records), "a");
  assert.equal(defaultObjectiveId([...objectives, objective("novo")], records), "novo");
  assert.equal(defaultObjectiveId(objectives, [{ objectiveId: "a", date: at("2026-11-10") }, { objectiveId: "b", date: at("2026-11-10") }, { objectiveId: "c", date: at("2026-11-10") }]), "a");
  assert.equal(defaultObjectiveId([], records, ["a"]), "");
});

test("papel no registro: vem da conta para quem dá aula; os outros papéis escolhem", () => {
  assert.equal(accountAuthorRole("professor_aee"), "professor_aee");
  assert.equal(accountAuthorRole("professor_sala"), "professor_sala");
  assert.equal(accountAuthorRole("apoio"), "apoio");
  for (const role of ["coordenacao", "gestao", "secretaria", "familia", "terapeuta", "plataforma", "outro"]) assert.equal(accountAuthorRole(role), "", role);
});

test("problemas do registro: todos de uma vez, na ordem do formulário", () => {
  const all = lessonProblems({ participation: "", supportLevel: Number.NaN, criterionMet: "talvez", authorRole: "  " });
  assert.deepEqual(all.map((problem) => problem.field), ["participation", "supportLevel", "criterionMet", "authorRole"]);
  assert.ok(all.every((problem) => problem.message.endsWith(".")));
  assert.deepEqual(lessonProblems({ participation: "total", supportLevel: 0, criterionMet: "sim", authorRole: "intérprete de Libras" }), []);
  assert.deepEqual(lessonProblems({ participation: "parcial", supportLevel: 6, criterionMet: "nao", authorRole: "familia" }).map((problem) => problem.field), ["supportLevel", "authorRole"]);
  assert.equal(missingAnswers(1), "Para salvar, falta 1 resposta:");
  assert.equal(missingAnswers(3), "Para salvar, faltam 3 respostas:");
});

test("apoio vindo do formulário: vazio não vira Independente", () => {
  assert.ok(Number.isNaN(supportFromInput("")));
  assert.ok(Number.isNaN(supportFromInput(undefined)));
  assert.ok(Number.isNaN(supportFromInput("1.5")));
  assert.equal(supportFromInput("0"), 0);
  assert.equal(supportFromInput(" 5 "), 5);
});

test("último registro em palavras, pelo dia de Brasília", () => {
  const now = at("2026-11-18");
  assert.equal(lastRecordLabel(null, now), "Ainda sem registro");
  assert.equal(lastRecordLabel(new Date("2026-11-18T02:00:00Z"), now), "Último registro ontem");
  assert.equal(lastRecordLabel(at("2026-11-18"), now), "Último registro hoje");
  assert.equal(lastRecordLabel(at("2026-11-13"), now), "Último registro há 5 dias");
});

test("link para registrar a aula de um objetivo", () => {
  assert.equal(lessonLogHref("e1"), "/estudantes/e1/diario");
  assert.equal(lessonLogHref("e1", "o 2"), "/estudantes/e1/diario?objetivo=o%202");
});
