// Testes das permissões do planejamento com DUA: node --test src/lib/dua/access.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { canPlanDua, canSeeDuaIndicators, collaboratorIds, planningAccess, readablePlanningsWhere } from "./access.ts";

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
  // Sem escola vinculada, a gestão atua na rede.
  assert.equal(planningAccess(user("rede", "gestao", null), planning()).edit, true);
  // Coordenação de outra escola não lê o planejamento privado.
  assert.deepEqual(planningAccess(user("outra", "coordenacao", "escola-2"), planning()), NONE);
});

test("compartilhado: a equipe da mesma escola lê, sem editar", () => {
  const shared = planning({ sharing: "compartilhado" });
  for (const role of ["professor_sala", "professor_aee", "apoio"]) {
    assert.deepEqual(planningAccess(user("colega", role), shared), { read: true, edit: false, validate: false, share: false, owner: false }, role);
  }
  // Privado, a mesma colega não lê.
  assert.deepEqual(planningAccess(user("colega", "professor_sala"), planning()), NONE);
});

test("compartilhado: outra escola não lê", () => {
  assert.deepEqual(planningAccess(user("colega", "professor_sala", "escola-2"), planning({ sharing: "compartilhado" })), NONE);
});

test("família, terapeuta e secretaria não planejam nem leem planejamentos", () => {
  for (const role of ["familia", "terapeuta", "secretaria"]) {
    assert.equal(canPlanDua({ role }), false, role);
    // Nem como responsável ou colaborador gravado antes (perfil mudou: vale na hora).
    const own = planning({ ownerId: "x", sharing: "compartilhado", collaborators: JSON.stringify([{ id: "x" }]) });
    assert.deepEqual(planningAccess(user("x", role), own), NONE, role);
  }
  for (const role of ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"]) assert.equal(canPlanDua({ role }), true, role);
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
  for (const role of ["coordenacao", "gestao", "secretaria"]) assert.equal(canSeeDuaIndicators({ role }), true, role);
  for (const role of ["professor_sala", "professor_aee", "apoio", "familia", "terapeuta"]) assert.equal(canSeeDuaIndicators({ role }), false, role);
});

test("colaboradores: JSON inválido ou sem id não dá acesso", () => {
  assert.deepEqual(collaboratorIds("não é json"), []);
  assert.deepEqual(collaboratorIds('{"id":"x"}'), []);
  assert.deepEqual(collaboratorIds(JSON.stringify([{ id: "a" }, { name: "sem id" }, null, { id: 7 }])), ["a", "7"]);
  assert.equal(planningAccess(user("x", "professor_sala"), planning({ collaborators: "[{" })).read, false);
});

test("filtro de listas equivale à leitura", () => {
  assert.deepEqual(readablePlanningsWhere(user("x", "familia")), { id: "__nenhum__" });
  const schoolScope = { OR: [{ schoolId: "escola-1" }, { schoolId: null }] };
  assert.deepEqual(readablePlanningsWhere(user("marcos", "professor_sala")), {
    OR: [{ ownerId: "marcos" }, { collaborators: { contains: '"marcos"' } }, { sharing: "compartilhado", ...schoolScope }],
  });
  assert.deepEqual(readablePlanningsWhere(user("ana", "coordenacao")).OR.at(-1), schoolScope);
  assert.deepEqual(readablePlanningsWhere(user("rede", "gestao", null)).OR.at(-1), {});
});
