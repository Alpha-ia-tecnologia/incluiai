// Testes do arquivo de migração do Educacenso: node --test src/lib/educacenso.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEdition, identityKeys, normalizeName, parseEducacensoFile, specialEdPersons, titleCase, toIsoDate } from "./educacenso.ts";
import { sampleFile } from "./educacenso.fixture.mjs";

test("datas, nomes e chaves de identidade", () => {
  assert.equal(toIsoDate("12/03/2019"), "2019-03-12");
  assert.equal(toIsoDate("30/02/2018"), "");
  assert.equal(toIsoDate("2019-03-12"), "");
  assert.equal(normalizeName("  Lívia   Martins "), "LIVIA MARTINS");
  assert.equal(titleCase("MARIA DA SILVA E SOUZA"), "Maria da Silva e Souza");
  assert.deepEqual(identityKeys({ name: "Dante Ribeiro", inepId: "1234", cpf: "111.222.333-44", birthDate: "2019-03-12" }), ["inep:1234", "cpf:11122233344", "nb:DANTE RIBEIRO|2019-03-12"]);
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
    assert.deepEqual(parsed.school, { code: "12345678", name: "EMEF PAULO FREIRE" });
    assert.equal(parsed.classes.length, 4);
    assert.equal(parsed.persons.length, 7);
    assert.deepEqual(parsed.stats.parsed, { "00": 1, "20": 4, "30": 8, "60": 10, "99": 1 });
    assert.equal(parsed.stats.skipped.length, 2); // registro 30 sem nome e matrícula de pessoa ausente
    const byName = Object.fromEntries(parsed.persons.map((person) => [person.name, person]));
    const dante = byName["DANTE RIBEIRO"];
    assert.deepEqual([dante.special, dante.hasAee, dante.hasRegular, dante.stageGroup, dante.regularClassName], [true, true, true, "302", "2º ANO A"]);
    assert.deepEqual(dante.aeeServices, ["Desenvolvimento de funções cognitivas", "Comunicação alternativa e aumentativa (CAA)"]);
    assert.deepEqual(byName["NOVA ALUNA DA SILVA"].aeeServices, ["Desenvolvimento de vida autônoma"]);
    // Classe especial não é classe comum: não confirma a dupla matrícula.
    assert.equal(byName["ALUNA DA CLASSE ESPECIAL"].hasRegular, false);
    assert.equal(byName["MENINO DA PRE"].stageGroup, "301");
    assert.equal(byName["SO NO AEE"].birthDate, "");
    assert.equal(byName["SO NO AEE"].key, "111222333444");
    // Gestora com a marcação, mas sem matrícula de aluno: fica de fora.
    assert.equal(byName["GESTORA COM DEFICIENCIA"].enrolled, false);
    assert.deepEqual(specialEdPersons(parsed).map((person) => person.name), ["DANTE RIBEIRO", "NOVA ALUNA DA SILVA", "SO NO AEE", "ALUNA DA CLASSE ESPECIAL", "MENINO DA PRE"]);
  });
}
