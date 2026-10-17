"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";

// Ciclo do banco de recursos (item 13): o professor seleciona, aplica e
// registra o resultado — assim o município descobre o que funciona.
export async function registerResourceUse(resourceId: string, activityId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isStaffOrNetwork(user.role)) {
    throw new Error("Apenas a equipe escolar pode registrar aplicações.");
  }
  const worked = String(formData.get("worked")) === "sim";
  const activity = await prisma.resourceActivity.findFirst({
    where: { id: activityId, resourceId },
  });
  if (!activity) throw new Error("Atividade não pertence a este recurso.");

  await prisma.$transaction([
    prisma.resource.update({
      where: { id: resourceId },
      data: {
        timesUsed: { increment: 1 },
        ...(worked ? { positiveOutcomes: { increment: 1 } } : {}),
      },
    }),
    prisma.resourceActivity.update({
      where: { id: activity.id },
      data: {
        timesUsed: { increment: 1 },
        ...(worked ? { positiveOutcomes: { increment: 1 } } : {}),
      },
    }),
  ]);
  revalidatePath(`/recursos/${resourceId}`);
  revalidatePath("/recursos");
}
