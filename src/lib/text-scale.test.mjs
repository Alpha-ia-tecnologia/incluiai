import { test } from "node:test";
import assert from "node:assert/strict";
import { TEXT_SCALES, TEXT_SCALE_KEY, TEXT_SCALE_SCRIPT, applyTextScale, isTextScale } from "./text-scale.ts";

const fakeRoot = () => ({ dataset: {}, style: { fontSize: "" } });

function runScript(stored) {
  const root = fakeRoot();
  const localStorage = { getItem: (key) => (key === TEXT_SCALE_KEY ? stored : null) };
  new Function("localStorage", "document", TEXT_SCALE_SCRIPT)(localStorage, { documentElement: root });
  return root;
}

test("tamanho do texto", () => {
  assert.equal(isTextScale("2"), true);
  assert.equal(isTextScale("4"), false);
  assert.equal(isTextScale(null), false);
});

test("o script antes da pintura e o controle aplicam o mesmo tamanho", () => {
  for (const scale of TEXT_SCALES) {
    const applied = fakeRoot();
    applyTextScale(applied, scale.value);
    assert.deepEqual(runScript(scale.value), applied, scale.value);
  }
  assert.notDeepEqual(runScript("3"), fakeRoot());
  assert.deepEqual(runScript(null), fakeRoot());
  assert.deepEqual(runScript("__proto__"), fakeRoot());
});
