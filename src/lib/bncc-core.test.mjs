import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCode, scopeFor, searchSkills, suggestSkills } from "./bncc-core.ts";

const BNCC = JSON.parse(readFileSync(new URL("../../prisma/data/bncc.json", import.meta.url), "utf8"));
const BNCC_CODE = /^(EI0[1-3][A-Z]{2}\d{2}|EF\d{2}[A-Z]{2}\d{2}|EM13[A-Z]{2,3}\d{2,3})$/;
const today = new Date("2026-10-22T12:00:00");
const ef = (year) => ({ stage: "EF", year, eiGroup: null });
const plain = (text) => text.normalize("NFD").replace(/\p{M}/gu, "");
const suggests = (code, scope) => suggestSkills(BNCC, BNCC.find((skill) => skill.code === code).description, scope, null, 50).some((skill) => skill.code === code);

test("a base: 1.580 códigos únicos e válidos, nas três etapas", () => {
  assert.equal(BNCC.length, 1580);
  assert.equal(new Set(BNCC.map((skill) => skill.code)).size, 1580);
  assert.ok(BNCC.every((skill) => BNCC_CODE.test(skill.code) && skill.description.length > 10));
  assert.deepEqual([...new Set(BNCC.map((skill) => skill.stage))].sort(), ["EF", "EI", "EM"]);
});

test("sugestão só no ano do estudante, também nas habilidades de dois anos e de intervalos", () => {
  assert.ok(suggests("EF12LP01", ef(2)) && !suggests("EF12LP01", ef(3)));
  assert.ok(suggests("EF15LP03", ef(3)) && suggests("EF15LP03", ef(5)) && !suggests("EF15LP03", ef(6)));
  assert.ok(suggests("EF05MA01", ef(5)) && !suggests("EF05MA01", ef(2)));
  assert.ok(suggests("EI03EO01", { stage: "EI", year: null, eiGroup: "03" }) && !suggests("EI01EO01", { stage: "EI", year: null, eiGroup: "03" }));
  assert.equal(normalizeCode(" ef01-lp04 "), "EF01LP04");
});

test("recorte pelo estudante", () => {
  assert.deepEqual(scopeFor({ stage: "anos_iniciais", gradeYear: "2º ano", birthDate: new Date("2018-03-10") }, today), { stage: "EF", year: 2, eiGroup: null });
  assert.equal(scopeFor({ stage: "educacao_infantil", gradeYear: "Pré II", birthDate: new Date("2021-05-01") }, today).eiGroup, "03");
  assert.equal(scopeFor({ stage: "educacao_infantil", gradeYear: "Berçário", birthDate: new Date("2025-08-01") }, today).eiGroup, "01");
  assert.equal(scopeFor({ stage: "eja", gradeYear: "Etapa 1", birthDate: new Date("1990-01-01") }, today).stage, null);
});

test("busca por código e por palavras", () => {
  assert.deepEqual(searchSkills(BNCC, "ef01lp0", null).map((skill) => skill.code).slice(0, 3), ["EF01LP01", "EF01LP02", "EF01LP03"]);
  const found = searchSkills(BNCC, "contar quantidade", ef(1));
  assert.ok(found.length > 0);
  assert.ok(found.every((skill) => /cont/i.test(plain(`${skill.description} ${skill.component}`)) && /quant/i.test(plain(`${skill.description} ${skill.component}`))), found.map((skill) => skill.code).join(", "));
  assert.match(found[0].years, /1º/);
  const words = searchSkills(BNCC, "identificar palavras", ef(1));
  assert.ok(words.length > 0 && words.every((skill) => /identific/i.test(skill.description) && /palavra/i.test(skill.description)));
  assert.deepEqual(searchSkills(BNCC, "de a o", null), []);
});

test("sugestão a partir do objetivo, no ano do estudante", () => {
  const first = { stage: "EF", year: 1, eiGroup: null };
  const count = suggestSkills(BNCC, "contará objetos até 10 em situação concreta, com material concreto", first, "matematica");
  assert.ok(count.length > 0);
  assert.ok(count.every((skill) => /1º/.test(skill.years)));
  assert.equal(count[0].component, "Matemática");
  const letters = suggestSkills(BNCC, "identificará as letras do alfabeto e o próprio nome", first, "leitura");
  assert.equal(letters[0].component, "Língua Portuguesa");
  assert.deepEqual(suggestSkills(BNCC, "com apoio, em 4 de 5 tentativas", first, "leitura"), []);
});
