// Testes da sondagem: node --test src/lib/assessment.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AREAS, ITEMS, areaSummary, cleanAnswers, compareAreas, objectiveSuggestions, reassessmentDue, referenceLabel, referenceYear, smallNumber } from "./assessment.ts";

const BNCC = new Map(JSON.parse(readFileSync(new URL("../../prisma/data/bncc.json", import.meta.url), "utf8")).map((skill) => [skill.code, skill]));

test("instrumento: 51 itens, ids únicos, toda área com itens e códigos da BNCC que existem no ano certo", () => {
  assert.equal(ITEMS.length, 51);
  assert.equal(new Set(ITEMS.map((item) => item.id)).size, ITEMS.length);
  for (const area of AREAS) assert.ok(ITEMS.some((item) => item.area === area.key), area.key);
  for (const item of ITEMS.filter((entry) => entry.bncc)) {
    const skill = BNCC.get(item.bncc);
    assert.ok(skill, `${item.id}: ${item.bncc} não existe`);
    assert.ok(skill.years.includes(`${item.year}º`), `${item.id}: ${item.bncc} é de ${skill.years}`);
  }
});

test("respostas: só itens do instrumento e níveis de 0 a 5", () => {
  const answers = cleanAnswers({ "com-01": "2", "com-02": 7, "com-03": "", "nao-existe": 1, "le-01": 0 });
  assert.equal(answers["com-01"], 2);
  assert.equal(answers["com-02"], null);
  assert.equal(answers["com-03"], null);
  assert.equal(answers["le-01"], 0);
  assert.equal("nao-existe" in answers, false);
});

test("resumo por área e ano de referência", () => {
  const answers = cleanAnswers({ "le-01": 0, "le-02": 1, "le-03": 2, "le-07": 2, "le-08": 2, "le-10": 4, "ma-01": 3 });
  assert.deepEqual(areaSummary(answers, "leitura_escrita"), { observed: 6, average: 1.8, independent: 2 });
  assert.equal(referenceYear(answers, "leitura_escrita"), 1);
  assert.equal(referenceLabel(referenceYear(answers, "leitura_escrita")), "habilidades do 1º ano");
  assert.equal(referenceYear(answers, "matematica"), 0);
  assert.equal(referenceLabel(0), "ainda antes das habilidades do 1º ano");
  assert.equal(referenceYear(answers, "comunicacao"), null);
  assert.equal(referenceYear(cleanAnswers({ "le-01": 0, "le-08": 1, "le-11": 2 }), "leitura_escrita"), 3);
});

test("evolução entre aplicações e sugestões de objetivo", () => {
  const baseline = cleanAnswers({ "com-01": 4, "com-02": 4, "int-03": 5 });
  const latest = cleanAnswers({ "com-01": 2, "com-02": 3, "int-03": 5 });
  const rows = compareAreas(baseline, latest);
  assert.deepEqual(rows.find((row) => row.area === "comunicacao"), { area: "comunicacao", label: "Comunicação e linguagem", start: 4, end: 2.5, change: 1.5 });
  assert.equal(rows.find((row) => row.area === "motor").change, null);
  assert.deepEqual(objectiveSuggestions(latest).map((item) => item.id), ["int-03", "com-02"]);
});

test("prazo de reavaliação e números pequenos", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  assert.equal(reassessmentDue(null, now), true);
  assert.equal(reassessmentDue(new Date("2026-09-01T12:00:00Z"), now), false);
  assert.equal(reassessmentDue(new Date("2026-06-01T12:00:00Z"), now), true);
  assert.equal(smallNumber(3), "menos de 5");
  assert.equal(smallNumber(0), "0");
  assert.equal(smallNumber(12), "12");
});
