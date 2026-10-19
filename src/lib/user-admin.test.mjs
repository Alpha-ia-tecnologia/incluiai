// Testes da gestão de contas: node --test src/lib/user-admin.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { accountSchoolProblem, assignableRoles, canManageAccount, isAccountManager, mergeLinks, passwordProblem, temporaryPassword } from "./user-admin.ts";

const secretaria = { id: "s", role: "secretaria", schoolId: null };
const coordA = { id: "c", role: "coordenacao", schoolId: "A" };
const gestaoA = { id: "g", role: "gestao", schoolId: "A" };
const account = (role, schoolId = null, linkedSchoolIds = []) => ({ id: "x", role, schoolId, linkedSchoolIds });

test("quem gerencia contas", () => {
  assert.equal(isAccountManager("secretaria"), true);
  assert.equal(isAccountManager("coordenacao"), true);
  assert.equal(isAccountManager("professor_aee"), false);
  assert.equal(isAccountManager("familia"), false);
  assert.equal(assignableRoles(secretaria).includes("familia"), false);
  assert.equal(assignableRoles(coordA).includes("coordenacao"), false);
  assert.equal(assignableRoles(gestaoA).includes("coordenacao"), true);
  assert.equal(assignableRoles(gestaoA).includes("secretaria"), false);
});

test("coordenação: equipe da própria escola e famílias de estudantes dela", () => {
  assert.equal(canManageAccount(coordA, account("professor_aee", "A")), true);
  assert.equal(canManageAccount(coordA, account("professor_aee", "B")), false);
  assert.equal(canManageAccount(coordA, account("familia", null, ["A", "B"])), true);
  assert.equal(canManageAccount(coordA, account("familia", null, ["B"])), false);
  assert.equal(canManageAccount(coordA, account("secretaria")), false);
  assert.equal(canManageAccount(coordA, account("coordenacao", "A")), false);
  assert.equal(canManageAccount(coordA, { ...account("professor_aee", "A"), id: "c" }), false);
});

test("Secretaria: equipe de qualquer escola, sem famílias", () => {
  assert.equal(canManageAccount(secretaria, account("coordenacao", "B")), true);
  assert.equal(canManageAccount(secretaria, account("secretaria")), true);
  assert.equal(canManageAccount(secretaria, account("familia", null, ["A"])), false);
  assert.equal(canManageAccount(secretaria, { ...account("secretaria"), id: "s" }), false);
});

test("escola da conta nova", () => {
  assert.equal(accountSchoolProblem(coordA, "professor_sala", "A"), null);
  assert.match(accountSchoolProblem(coordA, "professor_sala", "B"), /só na sua escola/);
  assert.match(accountSchoolProblem(secretaria, "professor_sala", null), /Escolha a escola/);
  assert.equal(accountSchoolProblem(secretaria, "coordenacao", null), null);
  assert.match(accountSchoolProblem(coordA, "familia", "A"), /vinculados a estudantes/);
  assert.match(accountSchoolProblem(secretaria, "secretaria", "A"), /da rede/);
});

test("vínculos: a escola mexe só nos estudantes dela", () => {
  const current = [{ studentId: "a1", schoolId: "A" }, { studentId: "b1", schoolId: "B" }];
  assert.deepEqual(mergeLinks(coordA, current, [{ studentId: "a2", schoolId: "A" }, { studentId: "b2", schoolId: "B" }]), ["b1", "a2"]);
  assert.deepEqual(mergeLinks({ ...coordA, schoolId: null }, current, [{ studentId: "a2", schoolId: "A" }]), ["a2"]);
});

test("senha nova", () => {
  assert.match(passwordProblem("curta"), /pelo menos 10/);
  assert.match(passwordProblem("1234567890"), /fácil de adivinhar/);
  assert.match(passwordProblem("aaaaaaaaaaaa"), /fácil de adivinhar/);
  assert.match(passwordProblem("carla.souza2026", { email: "carla.souza@email.com" }), /e-mail/);
  assert.match(passwordProblem("beatriz-na-escola", { name: "Prof.ª Beatriz (AEE)" }), /nome/);
  assert.equal(passwordProblem("girassol no pátio azul", { email: "aee@escola.edu.br", name: "Prof.ª Beatriz" }), null);
});

test("senha temporária", () => {
  const one = temporaryPassword();
  assert.match(one, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.doesNotMatch(one, /[01ilo]/);
  assert.notEqual(one, temporaryPassword());
  assert.equal(passwordProblem(one), null);
});
