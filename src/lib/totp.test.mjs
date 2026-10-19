// Testes do código de duas etapas: node --test src/lib/totp.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, groupSecret, hashRecoveryCode, matchTotpStep, newRecoveryCodes, newTotpSecret, otpauthUri, totpAt, totpStep, verifyTotp } from "./totp.ts";

// Vetores da RFC 6238 (SHA-1, segredo "12345678901234567890"), com 8 dígitos.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

test("vetores da RFC 6238", () => {
  assert.equal(totpAt(RFC_SECRET, 59_000, 8), "94287082");
  assert.equal(totpAt(RFC_SECRET, 1_111_111_109_000, 8), "07081804");
  assert.equal(totpAt(RFC_SECRET, 1_234_567_890_000, 8), "89005924");
  assert.equal(totpAt(RFC_SECRET, 20_000_000_000_000, 8), "65353130");
});

test("base32 vai e volta", () => {
  const bytes = Buffer.from("IncluiEdu, cada pessoa uma possibilidade");
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  assert.equal(base32Decode("gezd gnbv").toString(), "12345");
});

test("verificação aceita a janela vizinha e recusa o resto", () => {
  const secret = newTotpSecret();
  const now = 1_760_000_000_000;
  assert.equal(verifyTotp(secret, totpAt(secret, now), now), true);
  assert.equal(verifyTotp(secret, totpAt(secret, now - 30_000), now), true);
  assert.equal(verifyTotp(secret, totpAt(secret, now - 90_000), now), false);
  assert.equal(verifyTotp(secret, "12345", now), false);
  assert.equal(verifyTotp(secret, `${totpAt(secret, now).slice(0, 3)} ${totpAt(secret, now).slice(3)}`, now), true);
});

test("janela do código, para recusar o mesmo código duas vezes", () => {
  const secret = newTotpSecret();
  const now = 1_760_000_000_000;
  assert.equal(matchTotpStep(secret, totpAt(secret, now), now), totpStep(now));
  assert.equal(matchTotpStep(secret, totpAt(secret, now + 30_000), now), totpStep(now) + 1);
  assert.equal(matchTotpStep(secret, "abc", now), null);
});

test("segredo, endereço do aplicativo e códigos de recuperação", () => {
  const secret = newTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.match(groupSecret(secret), /^([A-Z2-7]{4} ){7}[A-Z2-7]{4}$/);
  assert.match(otpauthUri(secret, "aee@escola.edu.br"), /^otpauth:\/\/totp\/IncluiEdu%3Aaee%40escola\.edu\.br\?secret=[A-Z2-7]+&issuer=IncluiEdu/);
  const codes = newRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  assert.match(codes[0], /^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
  assert.equal(hashRecoveryCode(codes[0].toLowerCase()), hashRecoveryCode(codes[0]));
});
