// Testes da sessão e do limite de tentativas: node --test src/lib/session-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { LOGIN_MAX_FAILURES, SESSION_IDLE_MS, hashSessionToken, loginBlocked, newSessionToken, sessionState, shouldTouchSession } from "./session-core.ts";

const now = new Date("2026-10-18T10:00:00-03:00");
const ago = (ms) => new Date(now.getTime() - ms);
const minutes = (n) => n * 60 * 1000;

test("código da sessão é aleatório e o banco guarda só o resumo", () => {
  const a = newSessionToken();
  const b = newSessionToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40);
  assert.equal(hashSessionToken(a), hashSessionToken(a));
  assert.notEqual(hashSessionToken(a), a);
  assert.match(hashSessionToken(a), /^[0-9a-f]{64}$/);
});

test("sessão vale até a validade e cai depois de 2 horas sem uso", () => {
  const future = new Date(now.getTime() + minutes(60));
  assert.equal(sessionState({ expiresAt: future, lastSeenAt: ago(minutes(10)) }, now), "valida");
  assert.equal(sessionState({ expiresAt: ago(1), lastSeenAt: ago(minutes(1)) }, now), "expirada");
  assert.equal(sessionState({ expiresAt: future, lastSeenAt: ago(SESSION_IDLE_MS) }, now), "ociosa");
});

test("último uso só é gravado depois de 5 minutos", () => {
  assert.equal(shouldTouchSession(ago(minutes(2)), now), false);
  assert.equal(shouldTouchSession(ago(minutes(5)), now), true);
});

test("5 erros em 15 minutos bloqueiam; um acerto zera a conta; erros antigos não contam", () => {
  const fail = (m) => ({ success: false, createdAt: ago(minutes(m)) });
  assert.equal(loginBlocked(Array.from({ length: LOGIN_MAX_FAILURES - 1 }, (_, i) => fail(i + 1)), now), false);
  assert.equal(loginBlocked(Array.from({ length: LOGIN_MAX_FAILURES }, (_, i) => fail(i + 1)), now), true);
  assert.equal(loginBlocked([fail(10), fail(9), fail(8), fail(7), { success: true, createdAt: ago(minutes(6)) }, fail(5)], now), false);
  assert.equal(loginBlocked(Array.from({ length: LOGIN_MAX_FAILURES }, (_, i) => fail(20 + i)), now), false);
});
