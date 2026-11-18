import { test } from "node:test";
import assert from "node:assert/strict";
import { findMatch, identityKeys, nameBirthKey, normalizeName } from "./student-identity.ts";

test("nome sem acento, caixa, espaços nem pontuação", () => {
  assert.equal(normalizeName("  Lívia   Martins "), "LIVIA MARTINS");
  assert.equal(normalizeName("Ana-Clara D'Ávila"), normalizeName("ANA CLARA D AVILA"));
  assert.equal(nameBirthKey("Ána  Lima", "2015-01-01"), nameBirthKey("ana lima", "2015-01-01"));
});

test("chaves de identidade: INEP, CPF e nome com nascimento", () => {
  assert.deepEqual(identityKeys({ name: "Dante Ribeiro", inepId: "1234", cpf: "111.222.333-44", birthDate: "2019-03-12" }), ["inep:1234", "cpf:11122233344", "nb:DANTE RIBEIRO|2019-03-12"]);
  assert.deepEqual(identityKeys({ name: "Dante Ribeiro", cpf: "123" }), []);
});

test("o mesmo estudante: INEP, depois CPF, depois nome e nascimento, depois nome único", () => {
  const list = [
    { id: "a", name: "Dante Ribeiro", birthDate: "2019-03-12", inepId: "123456789012", cpf: null },
    { id: "b", name: "Lívia Martins", birthDate: "2018-01-10", inepId: null, cpf: "11122233344" },
    { id: "c", name: "Só no AEE", birthDate: "2018-02-01", inepId: null, cpf: null },
    { id: "d", name: "Só no AEE", birthDate: "2017-05-05", inepId: null, cpf: null },
  ];
  assert.deepEqual(findMatch({ name: "Outro Nome", inepId: "123456789012" }, list), { found: list[0], by: "inep", sameName: [] });
  assert.deepEqual(findMatch({ name: "LIVIA", cpf: "111.222.333-44" }, list), { found: list[1], by: "cpf", sameName: [] });
  assert.equal(findMatch({ name: "SO NO AEE", birthDate: "2017-05-05" }, list).found, list[3]);
  assert.equal(findMatch({ name: "DANTE RIBEIRO" }, list).by, "nome");
  assert.deepEqual(findMatch({ name: "SO NO AEE" }, list).sameName.map((item) => item.id), ["c", "d"]);
});
