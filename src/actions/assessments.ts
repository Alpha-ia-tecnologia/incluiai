"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { saveAssessment } from "@/lib/assessments";
import { ITEMS } from "@/lib/assessment";

export async function applyAssessment(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const raw = Object.fromEntries(ITEMS.map((item) => [item.id, formData.get(`item-${item.id}`)]));
    await saveAssessment(user, studentId, raw, String(formData.get("notes") ?? ""));
    redirect(`/estudantes/${studentId}/sondagem`);
  });
}
