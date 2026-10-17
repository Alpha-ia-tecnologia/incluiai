import { prisma } from "../prisma";
import { createAnonymizer, type Anonymizer } from "./anonymize-core";

// Anonimização (LGPD): regras puras em anonymize-core.ts; aqui, a carga dos nomes
// conhecidos pela plataforma a partir do banco.
export * from "./anonymize-core";

// Reúne os nomes conhecidos pela plataforma que podem aparecer nos textos livres.
export async function loadAnonymizer(studentId: string): Promise<Anonymizer> {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { name: true, guardianName: true, schoolId: true, familyNotes: { select: { author: true } }, intersectorReports: { select: { authorName: true } } },
  });
  const [classmates, users, schools] = await Promise.all([
    prisma.student.findMany({ where: { schoolId: student.schoolId, id: { not: studentId } }, select: { name: true } }),
    prisma.user.findMany({ select: { name: true, role: true } }),
    prisma.school.findMany({ select: { name: true } }),
  ]);
  return createAnonymizer({
    student: student.name,
    classmates: classmates.map((item) => item.name),
    family: [student.guardianName, ...student.familyNotes.map((note) => note.author), ...users.filter((user) => user.role === "familia").map((user) => user.name)],
    professionals: [...users.filter((user) => user.role !== "familia").map((user) => user.name), ...student.intersectorReports.map((report) => report.authorName)],
    schools: schools.map((school) => school.name),
  });
}
