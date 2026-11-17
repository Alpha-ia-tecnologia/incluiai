import { db } from "../prisma";
import type { SessionUser } from "../auth";
import { studentScopeWhere } from "../policy";
import { can, isLinkedRole, rolesWith } from "../roles";
import { createRedactor, redactionNames, type Named, type Redactor, type ScopeNames } from "./redactor";

// reader: o texto trocado volta para quem o escreveu (Libras), então só entram
// os nomes que a pessoa já vê; um nome trocado revelaria quem existe na rede.
export type RedactionScope =
  | { student: string }
  | { school: string | null; focus?: string | null }
  | { reader: SessionUser | null }
  | { conversation: SessionUser };

const NO_NAMES: ScopeNames = { focus: null, students: [], family: [], professionals: [], schools: [], everyPart: false };

async function networkPeople() {
  const prisma = await db();
  const users = await prisma.user.findMany({ select: { name: true, role: true } });
  return {
    family: users.filter((user) => can(user.role, "familyPortal")).map((user) => user.name),
    professionals: users.filter((user) => !can(user.role, "familyPortal")).map((user) => user.name),
  };
}

async function allSchools(): Promise<Named[]> {
  const prisma = await db();
  return prisma.school.findMany({ select: { id: true, name: true } });
}

async function visibleStudents(user: SessionUser) {
  const prisma = await db();
  return prisma.student.findMany({
    where: studentScopeWhere(user),
    select: { id: true, name: true, schoolId: true, guardianName: true, familyNotes: { select: { author: true } }, intersectorReports: { select: { authorName: true } } },
    orderBy: { name: "asc" },
  });
}

async function studentScope(studentId: string): Promise<ScopeNames> {
  const prisma = await db();
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { id: true, name: true, guardianName: true, schoolId: true, familyNotes: { select: { author: true } }, intersectorReports: { select: { authorName: true } } },
  });
  const [classmates, people, schools] = await Promise.all([
    prisma.student.findMany({ where: { schoolId: student.schoolId, id: { not: studentId } }, select: { id: true, name: true } }),
    networkPeople(),
    allSchools(),
  ]);
  return {
    focus: { id: student.id, name: student.name },
    students: classmates,
    family: [student.guardianName, ...student.familyNotes.map((note) => note.author), ...people.family],
    professionals: [...people.professionals, ...student.intersectorReports.map((report) => report.authorName)],
    schools,
    everyPart: false,
  };
}

async function schoolScope(schoolId: string | null, focusId: string | null | undefined): Promise<ScopeNames> {
  const prisma = await db();
  const [students, users, schools] = await Promise.all([
    prisma.student.findMany({ where: schoolId ? { schoolId } : {}, select: { id: true, name: true, guardianName: true } }),
    prisma.user.findMany({ select: { name: true } }),
    allSchools(),
  ]);
  const focus = students.find((student) => student.id === focusId) ?? null;
  return {
    focus: focus && { id: focus.id, name: focus.name },
    students: students.filter((student) => student !== focus).map(({ id, name }) => ({ id, name })),
    family: students.map((student) => student.guardianName).filter(Boolean),
    professionals: users.map((user) => user.name),
    schools,
    everyPart: true,
  };
}

async function readerScope(user: SessionUser | null): Promise<ScopeNames> {
  if (!user) return NO_NAMES;
  const prisma = await db();
  const students = await visibleStudents(user);
  const ids = students.map((student) => student.id);
  const schoolIds = [...new Set(students.map((student) => student.schoolId))];
  const [families, staff, schools] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: rolesWith("familyPortal") }, studentLinks: { some: { studentId: { in: ids } } } }, select: { name: true } }),
    prisma.user.findMany({ where: isLinkedRole(user.role) || user.schoolId ? { OR: [{ schoolId: { in: schoolIds } }, { schoolId: null }] } : {}, select: { name: true, role: true } }),
    allSchools(),
  ]);
  return {
    focus: null,
    students: students.map(({ id, name }) => ({ id, name })),
    family: [...students.map((student) => student.guardianName), ...families.map((family) => family.name)],
    professionals: [...staff.filter((person) => !isLinkedRole(person.role)).map((person) => person.name), user.name],
    schools,
    everyPart: false,
  };
}

async function conversationScope(user: SessionUser): Promise<ScopeNames> {
  const [students, people, schools] = await Promise.all([visibleStudents(user), networkPeople(), allSchools()]);
  return {
    focus: null,
    students: students.map(({ id, name }) => ({ id, name })),
    family: [
      ...students.map((student) => student.guardianName),
      ...students.flatMap((student) => student.familyNotes.map((note) => note.author)),
      ...people.family,
    ],
    professionals: [...people.professionals, ...students.flatMap((student) => student.intersectorReports.map((report) => report.authorName))],
    schools,
    everyPart: false,
  };
}

export function namesInScope(scope: RedactionScope | { names: ScopeNames }): Promise<ScopeNames> {
  if ("names" in scope) return Promise.resolve(scope.names);
  if ("student" in scope) return studentScope(scope.student);
  if ("school" in scope) return schoolScope(scope.school, scope.focus);
  if ("reader" in scope) return readerScope(scope.reader);
  return conversationScope(scope.conversation);
}

export async function redactorFor(scope: RedactionScope): Promise<Redactor> {
  return createRedactor(redactionNames(await namesInScope(scope)));
}
