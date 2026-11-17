"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";

export async function registerResourceUse(resourceId: string, activityId: string, formData: FormData) {
  const prisma = await db();
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
