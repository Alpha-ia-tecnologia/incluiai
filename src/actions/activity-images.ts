"use server";

import { imagesAllowedFor } from "@/lib/consent";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudentTeam } from "@/lib/auth";
import { createActivityImage } from "@/lib/images/save";
import { ImageGenerationError, isImageGenerationEnabled } from "@/lib/images/openai-images";

export type ImageActionState = { status: "idle" | "ok" | "erro"; message?: string };

async function requireActivity(studentId: string, activityId: string) {
  const user = await requireStudentTeam(studentId);
  const activity = await prisma.activity.findFirst({ where: { id: activityId, studentId }, select: { id: true } });
  if (!activity) throw new Error("Atividade não encontrada.");
  return user;
}

// Gera (ou troca) a imagem de apoio de uma atividade, sob pedido do professor.
export async function generateActivityImage(studentId: string, activityId: string, _previous: ImageActionState, formData: FormData): Promise<ImageActionState> {
  const user = await requireActivity(studentId, activityId);
  if (!isImageGenerationEnabled()) return { status: "erro", message: "A geração de imagens não está configurada (falta OPENAI_API_KEY)." };
  if (!(await imagesAllowedFor(studentId))) return { status: "erro", message: "A família ainda não autorizou o uso de IA com os dados deste estudante." };
  const kind = String(formData.get("kind") ?? "").trim().slice(0, 500) || "sequencia";
  try {
    await createActivityImage(activityId, kind, user);
  } catch (error) {
    console.error("[imagens] falha ao gerar imagem:", error);
    return { status: "erro", message: error instanceof ImageGenerationError ? error.message : "Não foi possível gerar a imagem agora. Tente de novo." };
  }
  revalidatePath(`/estudantes/${studentId}/atividades`);
  return { status: "ok" };
}

export async function removeActivityImage(studentId: string, activityId: string) {
  await requireActivity(studentId, activityId);
  await prisma.activityImage.deleteMany({ where: { activityId } });
  revalidatePath(`/estudantes/${studentId}/atividades`);
}
