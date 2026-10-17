"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { saveIntersectorReport } from "@/lib/records";

// Relatório de Articulação Intersetorial — item 8.
// Só o terapeuta vinculado ao estudante pode registrar; entram apenas
// informações funcionais relevantes ao ambiente escolar.
export async function createIntersectorReport(studentId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Faça login para enviar o relatório.");
  const text = (field: string) => String(formData.get(field) ?? "").trim();
  await saveIntersectorReport(user, studentId, {
    communication: text("communication"),
    accessResources: text("accessResources"),
    positioning: text("positioning") || null,
    facilitators: text("facilitators"),
    schoolGuidance: text("schoolGuidance"),
    strategiesToTry: text("strategiesToTry"),
    sharedGoals: text("sharedGoals"),
  });

  revalidatePath("/terapeuta");
  revalidatePath(`/estudantes/${studentId}`);
}
