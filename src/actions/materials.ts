"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireStudentTeam } from "@/lib/auth";
import { addMaterialImages, approveStudentMaterial, createStudentMaterial, saveMaterialActivity } from "@/lib/material-generate";

export type MaterialActionState = { status: "idle" | "ok" | "erro"; message?: string; materialId?: string };

const failure = (error: unknown, fallback: string): MaterialActionState => {
  console.error("[materiais]", error);
  const message = error instanceof Error && /permissão|Preencha|Escolha|objetivo|configurada|não encontrad/i.test(error.message) ? error.message : fallback;
  return { status: "erro", message };
};

const galleryPath = (studentId: string) => `/estudantes/${studentId}/materiais`;
const materialPath = (studentId: string, materialId: string) => `${galleryPath(studentId)}/${materialId}`;

function revalidateMaterial(studentId: string, materialId: string) {
  revalidatePath(galleryPath(studentId));
  revalidatePath(materialPath(studentId, materialId));
  revalidatePath(`${materialPath(studentId, materialId)}/imprimir`);
}

// O redirect fica fora do try: ele lança o desvio do Next.
export async function generateMaterial(studentId: string, _previous: MaterialActionState, formData: FormData): Promise<MaterialActionState> {
  let target: string;
  try {
    const user = await requireStudentTeam(studentId);
    const { material, source, images } = await createStudentMaterial(user, studentId, {
      kind: String(formData.get("kind") ?? ""),
      topic: String(formData.get("topic") ?? ""),
      context: String(formData.get("context") ?? "aee"),
      objectiveId: String(formData.get("objectiveId") ?? "") || null,
      withImages: formData.get("gerarImagens") === "on",
    });
    revalidateMaterial(studentId, material.id);
    revalidatePath(`/estudantes/${studentId}/linha-do-tempo`);
    const query = new URLSearchParams({ criado: source });
    if (images.requested) {
      query.set("imagens", String(images.created));
      if (images.errors.length) query.set("falhas", "1");
    }
    target = `${materialPath(studentId, material.id)}?${query}`;
  } catch (error) {
    return failure(error, "Não foi possível criar o material agora. Tente de novo.");
  }
  redirect(target);
}

export async function approveMaterial(studentId: string, materialId: string) {
  const user = await requireStudentTeam(studentId);
  await approveStudentMaterial(user, studentId, materialId);
  revalidateMaterial(studentId, materialId);
}

export async function generateMaterialImagesAction(studentId: string, materialId: string): Promise<MaterialActionState> {
  try {
    const user = await requireStudentTeam(studentId);
    const result = await addMaterialImages(user, studentId, materialId);
    revalidateMaterial(studentId, materialId);
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
    revalidateMaterial(studentId, materialId);
    return { status: "ok", message: "Atividade levada para Atividades, como sugestão para aceitar." };
  } catch (error) {
    return failure(error, "Não foi possível levar a atividade agora. Tente de novo.");
  }
}

export async function deleteMaterial(studentId: string, materialId: string) {
  const prisma = await db();
  await requireStudentTeam(studentId);
  const removed = await prisma.material.deleteMany({ where: { id: materialId, studentId } });
  if (!removed.count) throw new Error("Material não encontrado para este estudante.");
  revalidateMaterial(studentId, materialId);
  redirect(galleryPath(studentId));
}
