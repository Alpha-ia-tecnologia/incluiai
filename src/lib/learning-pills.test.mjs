// Testes da formação em pílulas: node --test src/lib/learning-pills.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PILLS, pillBySlug, readingMinutes } from "./learning-pills.ts";

test("seis pílulas, endereços únicos e leitura de até 2 minutos", () => {
  assert.equal(PILLS.length, 6);
  assert.equal(new Set(PILLS.map((pill) => pill.slug)).size, PILLS.length);
  for (const pill of PILLS) {
    assert.match(pill.slug, /^[a-z0-9-]+$/, pill.slug);
    assert.ok(pill.steps.length >= 3 && pill.steps.length <= 5, `${pill.slug}: ${pill.steps.length} passos`);
    assert.ok(pill.avoid.length >= 2, pill.slug);
    assert.ok(readingMinutes(pill) <= 2, `${pill.slug}: ${readingMinutes(pill)} min`);
    assert.ok(pill.where.href.startsWith("/"), pill.slug);
  }
});

test("busca pelo endereço", () => {
  assert.equal(pillBySlug("sondagem").title, "Sondagem: linha de base e reavaliação");
  assert.equal(pillBySlug("nao-existe"), undefined);
});
