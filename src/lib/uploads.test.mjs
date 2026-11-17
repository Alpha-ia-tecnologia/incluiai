import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UPLOAD_LIMIT_BYTES, optionalUpload, requiredUpload } from "./uploads.ts";
import { UserError } from "./user-error.ts";
import { LOGO_MAX_BYTES } from "./branding/logo-core.ts";

test("todo limite de envio cabe no limite do corpo das ações do Next", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  const megabytes = Number(config.match(/bodySizeLimit:\s*"(\d+)mb"/)?.[1]);
  assert.ok(megabytes > 0, "bodySizeLimit em next.config.ts");
  for (const [name, bytes] of Object.entries({ ...UPLOAD_LIMIT_BYTES, logo: LOGO_MAX_BYTES })) {
    assert.ok(bytes < megabytes * 1024 * 1024, `${name} passa do bodySizeLimit`);
  }
});

const rules = { maxBytes: 10, missing: "Escolha o arquivo.", tooLarge: "Arquivo grande demais." };

test("arquivo ausente ou vazio: obrigatório avisa, opcional fica nulo", () => {
  assert.throws(() => requiredUpload(null, rules), (error) => error instanceof UserError && error.message === rules.missing);
  assert.throws(() => requiredUpload(new File([], "vazio.pdf"), rules), (error) => error instanceof UserError && error.message === rules.missing);
  assert.equal(optionalUpload("texto", rules), null);
});

test("arquivo acima do limite avisa nos dois casos; dentro do limite volta o arquivo", () => {
  const big = new File(["x".repeat(11)], "grande.pdf");
  assert.throws(() => requiredUpload(big, rules), (error) => error instanceof UserError && error.message === rules.tooLarge);
  assert.throws(() => optionalUpload(big, rules), (error) => error instanceof UserError && error.message === rules.tooLarge);
  const small = new File(["x"], "pequeno.pdf");
  assert.equal(requiredUpload(small, rules), small);
});
