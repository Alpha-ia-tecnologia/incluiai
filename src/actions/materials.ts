"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudentTeam } from "@/lib/auth";
import { buildMaterial, MATERIAL_KINDS, type MaterialKind } from "@/lib/materials";

const KINDS = new Set<string>(MATERIAL_KINDS.map((item) => item.kind));

export async function generateMaterial(studentId: string, formData: FormData) {
  await requireStudentTeam(studentId);
  const requested = String(formData.get("kind") ?? "rotina_visual");
  const kind = (KINDS.has(requested) ? requested : "rotina_visual") as MaterialKind;
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

// Só a equipe do estudante exclui, e só materiais deste estudante. Se já foi
// excluído (por exemplo, em outra aba), não há erro: o resultado é o mesmo.
export async function deleteMaterial(studentId: string, materialId: string) {
  await requireStudentTeam(studentId);
  await prisma.material.deleteMany({ where: { id: materialId, studentId } });
  revalidatePath(`/estudantes/${studentId}/materiais`);
}
