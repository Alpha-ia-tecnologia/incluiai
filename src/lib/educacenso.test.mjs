// Testes do arquivo de migração do Educacenso: node --test src/lib/educacenso.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEdition, identityKeys, normalizeName, parseEducacensoFile, parseInterval, schedulesOverlap, specialEdPersons, titleCase, toIsoDate } from "./educacenso.ts";
import { sampleFile } from "./educacenso.fixture.mjs";

test("datas, nomes, horários e chaves de identidade", () => {
  assert.equal(toIsoDate("12/03/2019"), "2019-03-12");
  assert.equal(toIsoDate("30/02/2018"), "");
  assert.equal(toIsoDate("2019-03-12"), "");
  assert.equal(normalizeName("  Lívia   Martins "), "LIVIA MARTINS");
  assert.equal(titleCase("MARIA DA SILVA E SOUZA"), "Maria da Silva e Souza");
  assert.deepEqual(identityKeys({ name: "Dante Ribeiro", inepId: "1234", cpf: "111.222.333-44", birthDate: "2019-03-12" }), ["inep:1234", "cpf:11122233344", "nb:DANTE RIBEIRO|2019-03-12"]);
  assert.deepEqual(parseInterval("07:30-11:00"), [450, 660]);
  assert.deepEqual(parseInterval("11:00-07:00"), [0, 0]);
  assert.deepEqual(parseInterval(""), [0, 0]);
  const week = (day, interval) => Array.from({ length: 7 }, (_, index) => (index === day ? parseInterval(interval) : [0, 0]));
  assert.equal(schedulesOverlap(week(1, "07:00-11:00"), week(1, "10:00-12:00")), true);
  assert.equal(schedulesOverlap(week(1, "07:00-11:00"), week(1, "11:00-12:00")), false); // encostar não é coincidir
  assert.equal(schedulesOverlap(week(1, "07:00-11:00"), week(2, "08:00-09:00")), false);
});

test("a edição sai do número de campos (com ou sem | no fim) ou do tipo de turma", () => {
  assert.equal(parseEducacensoFile(sampleFile(2025)).edition, 2025);
  assert.equal(parseEducacensoFile(sampleFile(2026)).edition, 2026);
  const withTrailingPipe = sampleFile(2026).split("\r\n").map((row) => `${row}|`).join("\n");
  assert.equal(parseEducacensoFile(withTrailingPipe).edition, 2026);
  assert.equal(detectEdition([["20", "1", "T", "", "X", "", "", "", "", "", "", "", "", "5"]]), 2026);
  // BOM gravado em ISO-8859-1 e lido como Windows-1252 antes do registro 00.
  const latin = new TextDecoder("windows-1252").decode(Buffer.from(sampleFile(2025), "latin1"));
  assert.equal(parseEducacensoFile(latin).school?.code, "12345678");
  assert.equal(detectEdition([["20", "1", "T", "", "X", "", "", "", "", "", "", "", "", "1"]]), 2025);
});

for (const edition of [2025, 2026]) {
  test(`${edition}: escola, turmas, pessoas e matrículas`, () => {
    const parsed = parseEducacensoFile(sampleFile(edition));
    assert.deepEqual(parsed.school, { code: "12345678", name: "EMEF PAULO FREIRE", dependency: "municipal", privateCategory: "", municipalPartnership: false });
    assert.equal(parsed.classes.length, 6);
    assert.equal(parsed.persons.length, 9);
    assert.deepEqual(parsed.stats.parsed, { "00": 1, "20": 6, "30": 10, "60": 18, "99": 1 });
    assert.equal(parsed.stats.skipped.length, 2); // registro 30 sem nome e matrícula de pessoa ausente
    const byName = Object.fromEntries(parsed.persons.map((person) => [person.name, person]));
    const dante = byName["DANTE RIBEIRO"];
    assert.deepEqual([dante.special, dante.hasAee, dante.hasRegular, dante.stageGroup, dante.regularClassName], [true, true, true, "302", "2º ANO A"]);
    assert.deepEqual(dante.aeeServices, ["Desenvolvimento de funções cognitivas", "Comunicação alternativa e aumentativa (CAA)"]);
    assert.deepEqual([dante.aeeLinks, dante.aeeLinksWithoutService, dante.scheduleOverlap], [1, 0, false]);
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
    // Gestora com a marcação, mas sem matrícula de aluno: fica de fora.
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
