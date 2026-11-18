import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEducacensoFile, specialEdPersons, titleCase } from "./educacenso.ts";
import { censusFile, sampleFile } from "./educacenso.fixture.mjs";

test("datas, nomes e horários", () => {
  const aee = (code, days) => ({ code, name: code, kind: "aee", days });
  const file = censusFile({
    school: { code: "12345678", name: "EMEF TESTE" },
    classes: [{ code: "REG", name: "2 ANO", kind: "curricular", stage: "302", days: { 1: "07:00-11:00" } }, aee("A1", { 1: "10:00-12:00" }), aee("A2", { 1: "11:00-12:00" }), aee("A3", { 2: "08:00-09:00" }), aee("A4", { 1: "11:00-07:00" })],
    people: [
      { code: "P1", name: "MARIA DA SILVA E SOUZA", birth: "12/03/2019" },
      { code: "P2", name: "PESSOA DOIS", birth: "30/02/2018" },
      { code: "P3", name: "PESSOA TRES", birth: "2019-03-12" },
      { code: "P4", name: "PESSOA QUATRO", birth: "01/01/2018" },
    ],
    enrollments: ["P1", "P2", "P3", "P4"].flatMap((person, index) => [{ person, klass: "REG" }, { person, klass: `A${index + 1}`, services: [0] }]),
  }).join("\r\n");
  const persons = parseEducacensoFile(file).persons;
  assert.deepEqual(persons.map((person) => person.birthDate), ["2019-03-12", "", "", "2018-01-01"]);
  assert.deepEqual(persons.map((person) => person.scheduleOverlap), [true, false, false, false]);
  assert.equal(titleCase("MARIA DA SILVA E SOUZA"), "Maria da Silva e Souza");
});

test("a edição sai do número de campos (com ou sem | no fim) ou do tipo de turma", () => {
  assert.equal(parseEducacensoFile(sampleFile(2025)).edition, 2025);
  assert.equal(parseEducacensoFile(sampleFile(2026)).edition, 2026);
  const withTrailingPipe = sampleFile(2026).split("\r\n").map((row) => `${row}|`).join("\n");
  assert.equal(parseEducacensoFile(withTrailingPipe).edition, 2026);
  assert.equal(parseEducacensoFile("20|1|T||X|||||||||5").edition, 2026);
  const latin = new TextDecoder("windows-1252").decode(Buffer.from(sampleFile(2025), "latin1"));
  assert.equal(parseEducacensoFile(latin).school?.code, "12345678");
  assert.equal(parseEducacensoFile("20|1|T||X|||||||||1").edition, 2025);
});

for (const edition of [2025, 2026]) {
  test(`${edition}: escola, turmas, pessoas e matrículas`, () => {
    const parsed = parseEducacensoFile(sampleFile(edition));
    assert.deepEqual(parsed.school, { code: "12345678", name: "EMEF PAULO FREIRE", dependency: "municipal", privateCategory: "", municipalPartnership: false });
    assert.equal(parsed.classes.length, 6);
    assert.equal(parsed.persons.length, 9);
    assert.deepEqual(parsed.stats.parsed, { "00": 1, "20": 6, "30": 10, "60": 18, "99": 1 });
    assert.equal(parsed.stats.skipped.length, 2);
    const byName = Object.fromEntries(parsed.persons.map((person) => [person.name, person]));
    const dante = byName["DANTE RIBEIRO"];
    assert.deepEqual([dante.special, dante.hasAee, dante.hasRegular, dante.stageGroup, dante.regularClassName], [true, true, true, "302", "2º ANO A"]);
    assert.deepEqual(dante.aeeServices, ["Desenvolvimento de funções cognitivas", "Comunicação alternativa e aumentativa (CAA)"]);
    assert.deepEqual([dante.aeeLinks, dante.aeeLinksWithoutService, dante.scheduleOverlap], [1, 0, false]);
    // Registro 30, campos 36 a 48: os recursos nas avaliações do INEP (mesmas posições nas duas edições).
    assert.deepEqual(dante.assessmentResources, ["Auxílio ledor", "Tempo adicional"]);
    assert.deepEqual(byName["NOVA ALUNA DA SILVA"].assessmentResources, []);
    assert.deepEqual(byName["NOVA ALUNA DA SILVA"].aeeServices, ["Desenvolvimento de vida autônoma"]);
    // Classe especial não é classe comum: não confirma a dupla matrícula.
    assert.equal(byName["ALUNA DA CLASSE ESPECIAL"].hasRegular, false);
    assert.equal(byName["SO NO AEE"].birthDate, "");
    assert.equal(byName["SO NO AEE"].key, "111222333444");
    assert.equal(byName["SO NO AEE"].aeeLinksWithoutService, 1);
    const pre = byName["MENINO DA PRE"];
    assert.deepEqual([pre.stageGroup, pre.aeeLinks, pre.scheduleOverlap], ["301", 2, true]);
    const remote = byName["ALUNO A DISTANCIA"];
    assert.deepEqual([remote.hasRegular, remote.regularRemote, remote.stageGroup], [false, true, "302"]);
    assert.equal(byName["ALUNO DE MUITOS VINCULOS"].activityLinks, 5);
    assert.equal(byName["GESTORA COM DEFICIENCIA"].enrolled, false);
    assert.deepEqual(specialEdPersons(parsed).map((person) => person.name), ["DANTE RIBEIRO", "NOVA ALUNA DA SILVA", "SO NO AEE", "ALUNA DA CLASSE ESPECIAL", "MENINO DA PRE", "ALUNO A DISTANCIA", "ALUNO DE MUITOS VINCULOS"]);
  });
}

test("escola privada conveniada: categoria e convênio com a Secretaria Municipal", () => {
  const file = sampleFile(2025, { dependency: "4" }).replace("|EMEF PAULO FREIRE|", "|APAE|").split("\r\n");
  const fields = file[0].split("|");
  fields[31] = "4"; // filantrópica
  fields[33] = "1"; // convênio com a Secretaria Municipal
  file[0] = fields.join("|");
  const school = parseEducacensoFile(file.join("\r\n")).school;
  assert.deepEqual([school.dependency, school.privateCategory, school.municipalPartnership], ["privada", "4", true]);
});
