import "server-only";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { can } from "./roles";
import { UserError } from "./user-error";

function requireManagement(user: SessionUser) {
  if (!can(user.role, "management")) throw new UserError("Apenas coordenação, gestão ou Secretaria podem gerir cadastros.", "forbidden");
}

export async function createSchool(user: SessionUser, input: { name: string; region: string }) {
  const prisma = await db();
  requireManagement(user);
  if (!input.name || !input.region) throw new UserError("Nome e região são obrigatórios.");
  await prisma.school.create({ data: { name: input.name, region: input.region } });
}

export async function saveClass(user: SessionUser, input: { schoolId: string; name: string; gradeYear: string | null; shift: string }) {
  const prisma = await db();
  requireManagement(user);
  if (!input.schoolId || !input.name) throw new UserError("Escola e nome da turma são obrigatórios.");
  const details = { gradeYear: input.gradeYear, shift: input.shift || "manha" };
  await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: input.schoolId, name: input.name } },
    create: { schoolId: input.schoolId, name: input.name, ...details },
    update: details,
  });
}

export async function deleteClass(user: SessionUser, classId: string) {
  const prisma = await db();
  requireManagement(user);
  await prisma.schoolClass.delete({ where: { id: classId } });
}
