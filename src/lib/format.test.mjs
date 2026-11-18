import { test } from "node:test";
import assert from "node:assert/strict";
import { joinItems, parseJson, plural, readList, splitItems, writeList } from "./format.ts";

test("listas com ponto e vírgula: o que se grava volta igual na leitura", () => {
  const items = ["Rotina visual", "Pausa programada", "Material ampliado"];
  assert.equal(joinItems(items), "Rotina visual; Pausa programada; Material ampliado");
  assert.deepEqual(splitItems(joinItems(items)), items);
  assert.deepEqual(splitItems(" a ;\nb;; "), ["a", "b"]);
  assert.deepEqual(splitItems("a, b; c", ","), ["a", "b", "c"]);
});

test("listas em JSON: só textos; valor ruim vira lista vazia", () => {
  assert.deepEqual(readList(writeList(["dinossauros", "música"])), ["dinossauros", "música"]);
  assert.deepEqual(readList('["a", 2, null, "b"]'), ["a", "b"]);
  assert.deepEqual(readList("{}"), []);
  assert.deepEqual(readList("não é json"), []);
  assert.deepEqual(readList(null), []);
  assert.deepEqual(parseJson("x", { ok: false }), { ok: false });
});

test("plural", () => {
  assert.equal(plural(1, "registro", "registros"), "1 registro");
  assert.equal(plural(0, "registro", "registros"), "0 registros");
});
