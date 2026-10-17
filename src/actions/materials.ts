"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudentTeam } from "@/lib/auth";
import { addMaterialImages, approveStudentMaterial, createStudentMaterial, saveMaterialActivity } from "@/lib/material-generate";

// Materiais de apoio. Cada ação confere a equipe do estudante; a geração e as
// regras ficam em src/lib/material-generate.ts (também usado pelo assistente).
// Os resultados voltam como estado (useActionState) para a mensagem chegar à
// pessoa também no build de produção.

export type MaterialActionState = { status: "idle" | "ok" | "erro"; message?: string; materialId?: string };

const failure = (error: unknown, fallback: string): MaterialActionState => {
  console.error("[materiais]", error);
  const message = error instanceof Error && /permissão|Preencha|Escolha|objetivo|configurada|não encontrad/i.test(error.message) ? error.message : fallback;
  return { status: "erro", message };
};

export async function generateMaterial(studentId: string, _previous: MaterialActionState, formData: FormData): Promise<MaterialActionState> {
  try {
    const user = await requireStudentTeam(studentId);
    const { material, source, images } = await createStudentMaterial(user, studentId, {
      kind: String(formData.get("kind") ?? ""),
      topic: String(formData.get("topic") ?? ""),
      context: String(formData.get("context") ?? "aee"),
      objectiveId: String(formData.get("objectiveId") ?? "") || null,
      withImages: formData.get("gerarImagens") === "on",
    });
    revalidatePath(`/estudantes/${studentId}/materiais`);
    revalidatePath(`/estudantes/${studentId}/linha-do-tempo`);
    const imageNote = images.requested ? (images.errors.length ? ` ${images.created} imagem(ns) prontas; ${images.errors[0]}` : ` ${images.created} imagem(ns) prontas.`) : "";
    return { status: "ok", materialId: material.id, message: `Material criado ${source === "ia" ? "pelos agentes de IA" : "pelas regras da plataforma"}. Revise e aprove antes de usar.${imageNote}` };
  } catch (error) {
    return failure(error, "Não foi possível criar o material agora. Tente de novo.");
  }
}

export async function approveMaterial(studentId: string, materialId: string) {
  const user = await requireStudentTeam(studentId);
  await approveStudentMaterial(user, studentId, materialId);
  revalidatePath(`/estudantes/${studentId}/materiais`);
}

export async function generateMaterialImagesAction(studentId: string, materialId: string): Promise<MaterialActionState> {
  try {
    const user = await requireStudentTeam(studentId);
    const result = await addMaterialImages(user, studentId, materialId);
    revalidatePath(`/estudantes/${studentId}/materiais`);
    if (!result.created && result.errors.length) return { status: "erro", message: result.errors[0] };
    return { status: "ok", message: result.created ? `${result.created} imagem(ns) prontas.${result.errors.length ? ` ${result.errors[0]}` : ""}` : "Todas as imagens já estavam prontas." };
  } catch (error) {
    return failure(error, "Não foi possível gerar as imagens agora. Tente de novo.");
  }
}

export async function sendMaterialActivity(studentId: string, materialId: string, index: number): Promise<MaterialActionState> {
  try {
    const user = await requireStudentTeam(studentId);
    await saveMaterialActivity(user, studentId, materialId, index);
    revalidatePath(`/estudantes/${studentId}/atividades`);
    revalidatePath(`/estudantes/${studentId}/materiais`);
    return { status: "ok", message: "Atividade levada para Atividades, como sugestão para aceitar." };
  } catch (error) {
    return failure(error, "Não foi possível levar a atividade agora. Tente de novo.");
  }
}

export async function deleteMaterial(studentId: string, materialId: string) {
  await requireStudentTeam(studentId);
  // Só apaga material DESTE estudante (o id sozinho não basta).
  const removed = await prisma.material.deleteMany({ where: { id: materialId, studentId } });
  if (!removed.count) throw new Error("Material não encontrado para este estudante.");
  revalidatePath(`/estudantes/${studentId}/materiais`);
}
