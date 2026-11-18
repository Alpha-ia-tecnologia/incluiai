import { test } from "node:test";
import assert from "node:assert/strict";
import { bnccSearchUrl, readBnccQuery } from "./bncc-query.ts";

const read = (url) => readBnccQuery(new URL(url, "http://localhost").searchParams);

test("o que o seletor pede é o que a rota lê", () => {
  const query = { codes: ["EF01LP01", "EF15LP03"], text: "ler palavras", studentId: "e1", suggest: "identificará o próprio nome", dimension: "leitura" };
  assert.match(bnccSearchUrl(query), /^\/api\/bncc\?/);
  assert.deepEqual(read(bnccSearchUrl(query)), query);
  assert.deepEqual(read(bnccSearchUrl({ text: "contar" })), { codes: undefined, text: "contar", studentId: undefined, suggest: undefined, dimension: undefined });
});
