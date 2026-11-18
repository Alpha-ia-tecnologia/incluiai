import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_KEYS, accountSchool, assignableRoles, can, isAccountManager, isLinkedRole, isPlatformRole, isRole, roleGroup, roleLabel, roleScope, rolesWith, teachingContext } from "./roles.ts";

const SCHOOL_TEAM = ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"];
const STAFF = [...SCHOOL_TEAM, "secretaria"];
const MANAGEMENT = ["coordenacao", "gestao", "secretaria"];

const CAPABILITIES = {
  pedagogical: STAFF,
  editRecord: SCHOOL_TEAM,
  seeClinical: ["professor_aee", "coordenacao"],
  validateReports: ["professor_aee", "coordenacao"],
  planDua: SCHOOL_TEAM,
  validateDua: ["professor_sala", "professor_aee", "coordenacao", "gestao"],
  coordinateDua: ["coordenacao", "gestao"],
  duaIndicators: MANAGEMENT,
  recordAee: ["professor_aee", "coordenacao", "gestao"],
  management: MANAGEMENT,
  adminTasks: ["gestao", "secretaria"],
  dossier: ["professor_aee", "coordenacao", "gestao", "secretaria"],
  importCensus: ["coordenacao", "gestao"],
  configureCensus: ["secretaria"],
  seeNames: [...SCHOOL_TEAM, "familia", "terapeuta"],
  teamNotices: ["professor_aee", "coordenacao"],
  familyPortal: ["familia"],
  intersectorReports: ["terapeuta"],
  twoFactor: [...STAFF, "plataforma"],
};

test("cada capacidade vale exatamente para os papéis de hoje", () => {
  for (const [capability, roles] of Object.entries(CAPABILITIES)) assert.deepEqual(rolesWith(capability), roles, capability);
});

test("onde cada papel atua e com qual grupo", () => {
  assert.deepEqual(Object.fromEntries(ROLE_KEYS.map((role) => [role, `${roleGroup(role)}/${roleScope(role)}`])), {
    professor_sala: "professor/escola", professor_aee: "professor/escola", apoio: "professor/escola",
    coordenacao: "escola/escola", gestao: "escola/escola", secretaria: "rede/rede",
    familia: "familia/vinculo", terapeuta: "terapeuta/vinculo", plataforma: "plataforma/plataforma",
  });
  assert.deepEqual(ROLE_KEYS.filter(isLinkedRole), ["familia", "terapeuta"]);
  assert.deepEqual(ROLE_KEYS.filter(isPlatformRole), ["plataforma"]);
});

test("quem cria contas e com quais perfis", () => {
  assert.deepEqual(assignableRoles("secretaria"), ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao", "secretaria"]);
  assert.deepEqual(assignableRoles("gestao"), ["professor_sala", "professor_aee", "apoio", "coordenacao", "familia", "terapeuta"]);
  assert.deepEqual(assignableRoles("coordenacao"), ["professor_sala", "professor_aee", "apoio", "familia", "terapeuta"]);
  assert.deepEqual(ROLE_KEYS.filter(isAccountManager), MANAGEMENT);
  assert.deepEqual(Object.fromEntries(ROLE_KEYS.map((role) => [role, accountSchool(role)])), {
    professor_sala: "obrigatoria", professor_aee: "obrigatoria", apoio: "obrigatoria", coordenacao: "opcional", gestao: "opcional",
    secretaria: "nenhuma", familia: "nenhuma", terapeuta: "nenhuma", plataforma: "nenhuma",
  });
});

test("nomes curtos dos papéis e contexto de quem ensina", () => {
  assert.equal(new Set(ROLE_KEYS.map((role) => roleLabel(role))).size, ROLE_KEYS.length);
  assert.equal(roleLabel("terapeuta", { short: true }), "Terapeuta");
  assert.equal(roleLabel("gestao", { short: true }), "Gestão escolar");
  assert.deepEqual(ROLE_KEYS.map(teachingContext).filter(Boolean), ["sala_comum", "aee"]);
  assert.equal(teachingContext("professor_aee"), "aee");
});

test("papel desconhecido (texto livre de registros antigos) não ganha nada", () => {
  assert.equal(isRole("sistema"), false);
  assert.equal(roleLabel("Intérprete de Libras"), "Intérprete de Libras");
  assert.equal(can("sistema", "pedagogical"), false);
  assert.deepEqual(assignableRoles("sistema"), []);
  assert.equal(isLinkedRole("sistema"), false);
});
