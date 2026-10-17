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

export async function createSchool(formData: FormData) {
  await requireNetworkUser();
  const name = String(formData.get("name") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  if (!name || !region) throw new Error("Nome e região são obrigatórios.");
  await prisma.school.create({ data: { name, region } });
  revalidatePath("/cadastros");
}

export async function createClass(formData: FormData) {
  await requireNetworkUser();
  const schoolId = String(formData.get("schoolId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!schoolId || !name) throw new Error("Escola e nome da turma são obrigatórios.");
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

export async function deleteClass(classId: string) {
  await requireNetworkUser();
  await prisma.schoolClass.delete({ where: { id: classId } });
  revalidatePath("/cadastros");
}
