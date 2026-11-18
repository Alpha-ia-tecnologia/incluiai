import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_STATUS, AEE_SESSION_STATUSES, CONTEXTS, CRITERION_MET, MATERIAL_STATUS, OBJECTIVE_STATUSES, PARTICIPATION, REPORT_STATUS,
  clampSupport, labelOf, shortOf, supportInfo, supportOffset, supportTone, toneOf,
} from "./scale.ts";

test("valor gravado que a tabela não conhece aparece como veio, em tom neutro", () => {
  for (const key of ["valor_antigo", "constructor", "toString"]) {
    assert.equal(labelOf(PARTICIPATION, key), key);
    assert.equal(shortOf(PARTICIPATION, key), key);
    assert.equal(toneOf(PARTICIPATION, key), "neutral");
  }
  assert.equal(toneOf(PARTICIPATION, null), "neutral");
  assert.notEqual(shortOf(PARTICIPATION, "total"), labelOf(PARTICIPATION, "total"));
  assert.equal(shortOf(PARTICIPATION, "recusou"), labelOf(PARTICIPATION, "recusou"));
});

test("escala de apoio de 0 a 5: fora dela fica no limite; tom bom até 1, médio até 3, alerta acima", () => {
  assert.deepEqual([-2, 0, 2.4, 2.6, 5, 9].map(clampSupport), [0, 0, 2, 3, 5, 5]);
  assert.deepEqual([supportInfo(-1).level, supportInfo(7).level], [0, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(supportTone), ["good", "good", "mid", "mid", "alert", "alert"]);
  assert.deepEqual([0, 5, 9].map(supportOffset), [1, 0, 0]);
});

test("os valores já gravados no banco continuam com nome e tom", () => {
  const stored = [
    [PARTICIPATION, ["total", "parcial", "recusou"]],
    [CRITERION_MET, ["sim", "parcial", "nao"]],
    [CONTEXTS, ["sala_comum", "aee", "casa"]],
    [ACTIVITY_STATUS, ["sugerida", "aceita", "aplicada", "rejeitada"]],
    [MATERIAL_STATUS, ["sugerido", "aprovado"]],
    [REPORT_STATUS, ["rascunho", "validado"]],
  ];
  for (const [table, keys] of stored) {
    for (const key of keys) assert.ok(Object.hasOwn(table, key) && labelOf(table, key) !== key && toneOf(table, key) !== "neutral", key);
  }
  for (const key of ["ativo", "alcancado", "em_revisao"]) assert.ok(OBJECTIVE_STATUSES.includes(key), key);
  for (const key of ["realizado", "falta", "cancelamento"]) assert.ok(AEE_SESSION_STATUSES.includes(key), key);
});
