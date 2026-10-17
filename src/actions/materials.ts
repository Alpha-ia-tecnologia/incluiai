"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildMaterial, type MaterialKind } from "@/lib/materials";
import { requireStudentTeam } from "@/lib/auth";

export async function generateMaterial(studentId: string, formData: FormData) {
  await requireStudentTeam(studentId);
  const kind = String(formData.get("kind") ?? "rotina_visual") as MaterialKind;
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  const profile = await prisma.functionalProfile.findUnique({ where: { studentId } });
  if (!profile) throw new Error("Preencha o perfil funcional antes de gerar materiais.");

  const { title, content } = buildMaterial(kind, student, profile);
  await prisma.material.create({
    data: { studentId, kind, title, content: JSON.stringify(content), source: "regras" },
  });
  await prisma.timelineEvent.create({
    data: { studentId, type: "recurso", title: `Material acessível gerado: ${title}` },
  });
  revalidatePath(`/estudantes/${studentId}/materiais`);
}

export async function deleteMaterial(studentId: string, materialId: string) {
  await requireStudentTeam(studentId);
  // Só apaga material DESTE estudante (o id sozinho não basta).
  const removed = await prisma.material.deleteMany({ where: { id: materialId, studentId } });
  if (!removed.count) throw new Error("Material não encontrado para este estudante.");
  revalidatePath(`/estudantes/${studentId}/materiais`);
}
