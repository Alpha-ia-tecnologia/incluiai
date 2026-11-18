import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesWhere } from "./prisma-where.fixture.mjs";
import { canAccessSchool, canAccessStudent, canWorkWithStudent, familyActivityWhere, isFamilyActivity, isFamilyMaterial, isFamilyOf, isTherapistOf, landingFor, linkedStudentIds, studentPathFor, studentScopeWhere } from "./policy.ts";

const user = (role, schoolId = null, studentIds = []) => ({ role, schoolId, studentIds });
const STUDENTS = [{ id: "a1", schoolId: "A" }, { id: "a2", schoolId: "A" }, { id: "b1", schoolId: "B" }];
const [a1, , b1] = STUDENTS;
const VIEWERS = [
  user("secretaria"), user("gestao"), user("coordenacao", "A"), user("professor_sala", "A"), user("professor_aee", "B"), user("apoio", "A"),
  user("familia", null, ["a1"]), user("terapeuta", null, ["b1", "a2"]), user("familia"), user("plataforma"),
];

test("quem vê qual estudante", () => {
  assert.deepEqual(VIEWERS.map((viewer) => STUDENTS.filter((student) => canAccessStudent(viewer, student)).map((student) => student.id).join(",")), [
    "a1,a2,b1", "a1,a2,b1", "a1,a2", "a1,a2", "b1", "a1,a2", "a1", "a2,b1", "", "",
  ]);
});

test("o filtro de estudantes devolve exatamente quem a pessoa vê", () => {
  for (const viewer of VIEWERS) {
    const where = studentScopeWhere(viewer);
    for (const student of STUDENTS) assert.equal(matchesWhere(where, student), canAccessStudent(viewer, student), `${viewer.role} ${student.id}`);
  }
});

test("escola: a Secretaria e a equipe dela; família e terapeuta não agem pela escola", () => {
  assert.equal(canAccessSchool(user("secretaria"), "B"), true);
  assert.equal(canAccessSchool(user("coordenacao", "A"), "B"), false);
  assert.equal(canAccessSchool(user("gestao"), "B"), true);
  assert.equal(canAccessSchool(user("familia", null, ["a1"]), "A"), false);
});

test("equipe do estudante: quem edita a ficha e alcança o estudante", () => {
  assert.equal(canWorkWithStudent(user("professor_aee", "A"), a1), true);
  assert.equal(canWorkWithStudent(user("professor_aee", "A"), b1), false);
  assert.equal(canWorkWithStudent(user("secretaria"), a1), false);
  assert.equal(canWorkWithStudent(user("familia", null, ["a1"]), a1), false);
});

test("família e terapeuta de um estudante", () => {
  assert.equal(isFamilyOf(user("familia", null, ["a1"]), "a1"), true);
  assert.equal(isFamilyOf(user("familia", null, ["a1"]), "a2"), false);
  assert.equal(isFamilyOf(user("terapeuta", null, ["a1"]), "a1"), false);
  assert.equal(isFamilyOf(user("coordenacao", "A"), "a1"), false);
  assert.equal(isTherapistOf(user("terapeuta", null, ["a1"]), "a1"), true);
  assert.equal(isTherapistOf(user("familia", null, ["a1"]), "a1"), false);
});

test("página inicial e caminho do estudante de cada perfil", () => {
  assert.equal(landingFor(user("familia", null, ["a1"])), "/familia/a1");
  assert.equal(landingFor(user("familia", null, ["a1", "a2"])), "/familia");
  assert.equal(landingFor(user("familia")), "/");
  assert.equal(landingFor(user("terapeuta", null, ["a1"])), "/terapeuta");
  assert.equal(landingFor(user("terapeuta")), "/");
  assert.equal(landingFor(user("secretaria")), "/");
  assert.equal(studentPathFor(user("familia", null, ["a1"]), "a1"), "/familia/a1");
  assert.equal(studentPathFor(user("terapeuta", null, ["a1"]), "a1"), "/terapeuta");
  assert.equal(studentPathFor(user("professor_sala", "A"), "a1"), "/estudantes/a1");
});

test("vínculo antigo em User.studentId vale enquanto não há StudentLink", () => {
  assert.deepEqual(linkedStudentIds({ studentId: "old", studentLinks: [] }), ["old"]);
  assert.deepEqual(linkedStudentIds({ studentId: "old", studentLinks: [{ studentId: "a1" }, { studentId: "a2" }] }), ["a1", "a2"]);
  assert.deepEqual(linkedStudentIds({ studentId: null, studentLinks: [] }), []);
});

test("a família vê só a atividade de casa já aceita e o material aprovado", () => {
  assert.equal(isFamilyActivity({ context: "casa", status: "aceita" }), true);
  assert.equal(isFamilyActivity({ context: "casa", status: "aplicada" }), true);
  assert.equal(isFamilyActivity({ context: "casa", status: "sugerida" }), false);
  assert.equal(isFamilyActivity({ context: "aee", status: "aceita" }), false);
  for (const context of ["sala_comum", "aee", "casa"]) {
    for (const status of ["sugerida", "aceita", "aplicada", "rejeitada"]) {
      assert.equal(matchesWhere(familyActivityWhere, { context, status }), isFamilyActivity({ context, status }), `${context} ${status}`);
    }
  }
  assert.equal(isFamilyMaterial({ status: "aprovado" }), true);
  assert.equal(isFamilyMaterial({ status: "rascunho" }), false);
});
