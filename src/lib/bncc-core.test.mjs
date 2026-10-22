// Testes da base da BNCC: node --test src/lib/bncc-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BNCC_CODE, efYears, inScope, normalizeCode, scopeFor, searchSkills, stems, suggestSkills } from "./bncc-core.ts";

const BNCC = JSON.parse(readFileSync(new URL("../../prisma/data/bncc.json", import.meta.url), "utf8"));
const today = new Date("2026-10-22T12:00:00");

test("a base: 1.580 códigos únicos e válidos, nas três etapas", () => {
  assert.equal(BNCC.length, 1580);
  assert.equal(new Set(BNCC.map((skill) => skill.code)).size, 1580);
  assert.ok(BNCC.every((skill) => BNCC_CODE.test(skill.code) && skill.description.length > 10));
  assert.deepEqual([...new Set(BNCC.map((skill) => skill.stage))].sort(), ["EF", "EI", "EM"]);
});

test("anos de cada habilidade do fundamental", () => {
  assert.deepEqual(efYears("1º ano"), [1]);
  assert.deepEqual(efYears("1º e 2º anos"), [1, 2]);
  assert.deepEqual(efYears("1º ao 5º ano"), [1, 2, 3, 4, 5]);
  assert.deepEqual(efYears("6º ao 9º ano"), [6, 7, 8, 9]);
  assert.equal(normalizeCode(" ef01-lp04 "), "EF01LP04");
});

test("recorte pelo estudante", () => {
  assert.deepEqual(scopeFor({ stage: "anos_iniciais", gradeYear: "2º ano", birthDate: new Date("2018-03-10") }, today), { stage: "EF", year: 2, eiGroup: null });
  assert.equal(scopeFor({ stage: "educacao_infantil", gradeYear: "Pré II", birthDate: new Date("2021-05-01") }, today).eiGroup, "03");
  assert.equal(scopeFor({ stage: "educacao_infantil", gradeYear: "Berçário", birthDate: new Date("2025-08-01") }, today).eiGroup, "01");
  assert.equal(scopeFor({ stage: "eja", gradeYear: "Etapa 1", birthDate: new Date("1990-01-01") }, today).stage, null);
  const second = { stage: "EF", year: 2, eiGroup: null };
  assert.equal(inScope(BNCC.find((skill) => skill.code === "EF12LP01"), second), true);
  assert.equal(inScope(BNCC.find((skill) => skill.code === "EF05MA01"), second), false);
  assert.equal(inScope(BNCC.find((skill) => skill.code === "EI03EO01"), { stage: "EI", year: null, eiGroup: "03" }), true);
  assert.equal(inScope(BNCC.find((skill) => skill.code === "EI01EO01"), { stage: "EI", year: null, eiGroup: "03" }), false);
});

test("busca por código e por palavras", () => {
  assert.deepEqual(searchSkills(BNCC, "ef01lp0", null).map((skill) => skill.code).slice(0, 3), ["EF01LP01", "EF01LP02", "EF01LP03"]);
  const found = searchSkills(BNCC, "contar quantidade", { stage: "EF", year: 1, eiGroup: null });
  assert.ok(found.length > 0);
  assert.ok(found.every((skill) => ["conta", "quant"].every((stem) => stems(`${skill.description} ${skill.component}`).includes(stem))));
  assert.ok(inScope(found[0], { stage: "EF", year: 1, eiGroup: null }));
  assert.deepEqual(searchSkills(BNCC, "de a o", null), []);
});

test("sugestão a partir do objetivo, no ano do estudante", () => {
  const first = { stage: "EF", year: 1, eiGroup: null };
  const count = suggestSkills(BNCC, "contará objetos até 10 em situação concreta, com material concreto", first, "matematica");
  assert.ok(count.length > 0);
  assert.ok(count.every((skill) => inScope(skill, first)));
  assert.equal(count[0].component, "Matemática");
  const letters = suggestSkills(BNCC, "identificará as letras do alfabeto e o próprio nome", first, "leitura");
  assert.equal(letters[0].component, "Língua Portuguesa");
  assert.deepEqual(suggestSkills(BNCC, "com apoio, em 4 de 5 tentativas", first, "leitura"), []);
  assert.deepEqual(stems("Identificará as PALAVRAS"), ["ident", "palav"]);
});
