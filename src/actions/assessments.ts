"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudentTeam } from "@/lib/auth";
import { saveAssessment } from "@/lib/assessments";
import { ITEMS } from "@/lib/assessment";

export type AssessmentState = { error?: string };

// Aplicar a sondagem: cada item vem como item-<id> com o nível (ou vazio).
export async function applyAssessment(studentId: string, _previous: AssessmentState, formData: FormData): Promise<AssessmentState> {
  const user = await requireStudentTeam(studentId);
  const raw = Object.fromEntries(ITEMS.map((item) => [item.id, formData.get(`item-${item.id}`)]));
  const result = await saveAssessment(user, studentId, raw, String(formData.get("notes") ?? ""));
  if (typeof result !== "string") return result;
  revalidatePath(`/estudantes/${studentId}/sondagem`);
  redirect(`/estudantes/${studentId}/sondagem`);
}
