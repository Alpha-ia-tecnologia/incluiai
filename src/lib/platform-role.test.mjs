// Testes do perfil da plataforma nas regras do município: node --test src/lib/platform-role.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { getNavigation } from "./navigation.ts";
import { ROLES } from "./scale.ts";
import { PLATFORM_ROLE } from "./tenancy-core.ts";
import { assignableRoles, canManageAccount, isAccountManager } from "./user-admin.ts";

test("o perfil da plataforma tem nome, mas nenhum menu do município", () => {
  assert.equal(PLATFORM_ROLE, "plataforma");
  assert.equal(ROLES[PLATFORM_ROLE], "Administração da plataforma");
  assert.deepEqual(getNavigation(PLATFORM_ROLE), []);
  assert.ok(getNavigation("secretaria").length > 0);
});

test("ninguém do município cria, altera ou é gerenciado como conta da plataforma", () => {
  assert.equal(isAccountManager(PLATFORM_ROLE), false);
  assert.deepEqual(assignableRoles({ role: PLATFORM_ROLE }), []);
  for (const role of Object.keys(ROLES)) assert.equal(assignableRoles({ role }).includes(PLATFORM_ROLE), false, role);
  const platformAccount = { id: "p", role: PLATFORM_ROLE, schoolId: null, linkedSchoolIds: [] };
  for (const role of ["secretaria", "gestao", "coordenacao"]) {
    assert.equal(canManageAccount({ id: "m", role, schoolId: null }, platformAccount), false, role);
  }
});
