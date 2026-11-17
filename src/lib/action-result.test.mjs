import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod/v4";
import { UNEXPECTED_INPUT, failureOf } from "./action-result.ts";
import { UserError } from "./user-error.ts";

test("o erro para a pessoa chega como resultado, com os problemas de cada campo", () => {
  const problems = [{ field: "support", message: "Descreva o apoio." }];
  assert.deepEqual(failureOf(new UserError("Ainda falta completar o apoio.", "invalid", problems)), { ok: false, message: "Ainda falta completar o apoio.", problems });
});

test("dado em formato inesperado vira o aviso geral; qualquer outro erro não é resultado", () => {
  const malformed = z.object({ id: z.string() }).safeParse({ id: 1 }).error;
  assert.deepEqual(failureOf(malformed), { ok: false, message: UNEXPECTED_INPUT });
  assert.equal(failureOf(new Error("banco fora do ar")), null);
});
