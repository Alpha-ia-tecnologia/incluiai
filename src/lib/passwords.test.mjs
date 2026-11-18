import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, verifyPasswordOrDummy } from "./passwords.ts";

test("a senha guardada confere com a mesma senha e só com ela, sem guardar o texto", () => {
  const stored = hashPassword("girassol no pátio azul");
  assert.equal(verifyPassword("girassol no pátio azul", stored), true);
  assert.equal(verifyPassword("girassol no patio azul", stored), false);
  assert.notEqual(hashPassword("girassol no pátio azul"), stored);
  assert.ok(!stored.includes("girassol"));
});

test("registro fora do formato não confere; conta inexistente nunca entra", () => {
  for (const bad of ["", "sem-separador", "sal:", ":resumo", "sal:zz"]) assert.equal(verifyPassword("girassol", bad), false, bad);
  assert.equal(verifyPasswordOrDummy("girassol", null), false);
  assert.equal(verifyPasswordOrDummy("girassol", hashPassword("girassol")), true);
});
