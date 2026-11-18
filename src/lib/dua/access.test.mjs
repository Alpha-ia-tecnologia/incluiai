import { test } from "node:test";
import assert from "node:assert/strict";
import { collaboratorIds, planningAccess, readCollaborators, readablePlanningsWhere, writeCollaborators } from "./access.ts";
import { matchesWhere } from "../prisma-where.fixture.mjs";
import { can } from "../roles.ts";

const user = (id, role, schoolId = "escola-1") => ({ id, role, schoolId });
const planning = (extra = {}) => ({ ownerId: "marcos", schoolId: "escola-1", sharing: "privado", collaborators: "[]", ...extra });
const NONE = { read: false, edit: false, validate: false, share: false, owner: false };

test("responsável lê, edita, valida e compartilha", () => {
  assert.deepEqual(planningAccess(user("marcos", "professor_sala"), planning()), { read: true, edit: true, validate: true, share: true, owner: true });
});

test("colaborador edita e valida, mas não compartilha", () => {
  const shared = planning({ collaborators: JSON.stringify([{ id: "beatriz", name: "Prof.ª Beatriz (AEE)" }]) });
  assert.deepEqual(planningAccess(user("beatriz", "professor_aee"), shared), { read: true, edit: true, validate: true, share: false, owner: false });
});

test("coordenação e gestão da escola editam, validam e compartilham", () => {
  for (const role of ["coordenacao", "gestao"]) {
    assert.deepEqual(planningAccess(user("ana", role), planning()), { read: true, edit: true, validate: true, share: true, owner: false }, role);
  }
  assert.equal(planningAccess(user("rede", "gestao", null), planning()).edit, true);
  assert.deepEqual(planningAccess(user("outra", "coordenacao", "escola-2"), planning()), NONE);
});

test("compartilhado: a equipe da mesma escola lê, sem editar", () => {
  const shared = planning({ sharing: "compartilhado" });
  for (const role of ["professor_sala", "professor_aee", "apoio"]) {
    assert.deepEqual(planningAccess(user("colega", role), shared), { read: true, edit: false, validate: false, share: false, owner: false }, role);
  }
  assert.deepEqual(planningAccess(user("colega", "professor_sala"), planning()), NONE);
});

test("compartilhado: outra escola não lê", () => {
  assert.deepEqual(planningAccess(user("colega", "professor_sala", "escola-2"), planning({ sharing: "compartilhado" })), NONE);
});

test("família, terapeuta e secretaria não planejam nem leem planejamentos", () => {
  for (const role of ["familia", "terapeuta", "secretaria"]) {
    assert.equal(can(role, "planDua"), false, role);
    const own = planning({ ownerId: "x", sharing: "compartilhado", collaborators: JSON.stringify([{ id: "x" }]) });
    assert.deepEqual(planningAccess(user("x", role), own), NONE, role);
  }
  for (const role of ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"]) assert.equal(can(role, "planDua"), true, role);
});

test("profissional de apoio edita, mas não valida", () => {
  const asCollaborator = planningAccess(user("lia", "apoio"), planning({ collaborators: JSON.stringify([{ id: "lia", name: "Lia" }]) }));
  assert.deepEqual(asCollaborator, { read: true, edit: true, validate: false, share: false, owner: false });
  const asOwner = planningAccess(user("lia", "apoio"), planning({ ownerId: "lia" }));
  assert.deepEqual([asOwner.edit, asOwner.validate, asOwner.share], [true, false, true]);
});

test("compartilhar: só o responsável ou a coordenação", () => {
  const shared = planning({ sharing: "compartilhado", collaborators: JSON.stringify([{ id: "beatriz" }]) });
  assert.equal(planningAccess(user("marcos", "professor_sala"), shared).share, true);
  assert.equal(planningAccess(user("ana", "coordenacao"), shared).share, true);
  assert.equal(planningAccess(user("beatriz", "professor_aee"), shared).share, false);
  assert.equal(planningAccess(user("colega", "professor_sala"), shared).share, false);
});

test("indicadores: coordenação, gestão e secretaria", () => {
  for (const role of ["coordenacao", "gestao", "secretaria"]) assert.equal(can(role, "duaIndicators"), true, role);
  for (const role of ["professor_sala", "professor_aee", "apoio", "familia", "terapeuta"]) assert.equal(can(role, "duaIndicators"), false, role);
});

test("colaboradores: JSON inválido ou sem id não dá acesso", () => {
  assert.deepEqual(collaboratorIds("não é json"), []);
  assert.deepEqual(collaboratorIds('{"id":"x"}'), []);
  assert.deepEqual(collaboratorIds(JSON.stringify([{ id: "a" }, { name: "sem id" }, null, { id: 7 }])), ["a", "7"]);
  assert.equal(planningAccess(user("x", "professor_sala"), planning({ collaborators: "[{" })).read, false);
});

test("filtro de listas equivale à leitura", () => {
  const users = [
    user("marcos", "professor_sala"), user("beatriz", "professor_aee"), user("lia", "apoio"), user("ana", "coordenacao"), user("rede", "gestao", null),
    user("outra", "coordenacao", "escola-2"), user("colega", "professor_sala", "escola-2"), user("c2", "professor_sala"), user("x", "familia"), user("s", "secretaria", null),
  ];
  const plannings = [
    planning({ id: "p1" }),
    planning({ id: "p2", sharing: "compartilhado" }),
    planning({ id: "p3", schoolId: "escola-2", sharing: "compartilhado" }),
    planning({ id: "p4", schoolId: null, sharing: "compartilhado" }),
    planning({ id: "p5", ownerId: "colega", schoolId: "escola-2", collaborators: writeCollaborators([{ id: "beatriz", name: "Beatriz" }, { id: "c2y", name: "Outro" }]) }),
    planning({ id: "p6", ownerId: "lia", collaborators: "[{" }),
  ];
  for (const viewer of users) {
    for (const row of plannings) {
      assert.equal(matchesWhere(readablePlanningsWhere(viewer), row), planningAccess(viewer, row).read, `${viewer.id} ${row.id}`);
    }
  }
});

test("colaboradores: o que se grava é o que a busca por id encontra, e leitura tolera lixo", () => {
  const stored = writeCollaborators([{ id: "c1x", name: "Ana \"Nina\"" }, { id: "c2y", name: "Bruno" }]);
  assert.deepEqual(readCollaborators(stored), [{ id: "c1x", name: "Ana \"Nina\"" }, { id: "c2y", name: "Bruno" }]);
  const shared = planning({ collaborators: stored });
  assert.equal(matchesWhere(readablePlanningsWhere(user("c2y", "professor_sala", "escola-2")), shared), true);
  assert.equal(matchesWhere(readablePlanningsWhere(user("c2", "professor_sala", "escola-2")), shared), false);
  assert.deepEqual(collaboratorIds("não é json"), []);
  assert.deepEqual(collaboratorIds('[{"name":"sem id"},{"id":"c3"}]'), ["c3"]);
});
