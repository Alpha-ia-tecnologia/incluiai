import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffle } from "./mechanics.ts";

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("embaralhar não perde nem repete itens, preserva a origem e se reproduz com a mesma semente", () => {
  const source = Object.freeze(Array.from({ length: 20 }, (_, index) => index));
  const shuffled = shuffle(source, seededRandom(42));
  assert.deepEqual([...shuffled].sort((a, b) => a - b), source);
  assert.notDeepEqual(shuffled, source);
  assert.deepEqual(shuffled, shuffle(source, seededRandom(42)));
});
