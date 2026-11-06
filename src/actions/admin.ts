"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isNetworkRole } from "@/lib/auth";

// Cadastros da rede (escolas e turmas) — apenas perfis de gestão.
async function requireNetworkUser() {
  const user = await getCurrentUser();
  if (!user || !isNetworkRole(user.role)) {
    throw new Error("Apenas coordenação, gestão ou Secretaria podem gerir cadastros.");
  }
  return user;
}

// Coordenação e gestão cuidam só da própria escola; a Secretaria, da rede toda.
function assertSchoolScope(user: { schoolId: string | null }, schoolId: string) {
  if (user.schoolId && user.schoolId !== schoolId) throw new Error("Você só pode alterar turmas da sua escola.");
}

export async function createSchool(formData: FormData) {
  await requireNetworkUser();
  const name = String(formData.get("name") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  if (!name || !region) throw new Error("Nome e região são obrigatórios.");
  await prisma.school.create({ data: { name, region } });
  revalidatePath("/cadastros");
}

export async function createClass(formData: FormData) {
  const user = await requireNetworkUser();
  const schoolId = String(formData.get("schoolId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!schoolId || !name) throw new Error("Escola e nome da turma são obrigatórios.");
  assertSchoolScope(user, schoolId);
  await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId, name } },
    create: {
      schoolId,
      name,
      gradeYear: String(formData.get("gradeYear") ?? "").trim() || null,
      shift: String(formData.get("shift") ?? "manha"),
    },
    update: {
      gradeYear: String(formData.get("gradeYear") ?? "").trim() || null,
      shift: String(formData.get("shift") ?? "manha"),
    },
  });
  revalidatePath("/cadastros");
  revalidatePath("/estudantes/novo");
}

// Turma com estudantes não é excluída: eles ficariam sem turma no cadastro.
export async function deleteClass(classId: string) {
  const user = await requireNetworkUser();
  const schoolClass = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { name: true, schoolId: true } });
  if (!schoolClass) throw new Error("Turma não encontrada.");
  assertSchoolScope(user, schoolClass.schoolId);
  const students = await prisma.student.count({ where: { schoolId: schoolClass.schoolId, className: schoolClass.name, status: "ativo" } });
  if (students > 0) throw new Error("Esta turma ainda tem estudantes. Mude a turma deles antes de excluir.");
  await prisma.schoolClass.delete({ where: { id: classId } });
  revalidatePath("/cadastros");
}
