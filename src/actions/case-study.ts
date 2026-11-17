"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { saveCaseStudy } from "@/lib/case-studies";

export async function saveCaseStudyAction(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const conclude = formData.get("intent") === "concluir";
    const { status, missingAee } = await saveCaseStudy(user, studentId, { answers: (key) => formData.get(key), conclude });
    const page = `/estudantes/${studentId}/estudo-de-caso`;
    if (missingAee) redirect(`${page}?${status === "concluido" ? "editar=1&" : ""}faltaAee=1#secao-essencial`);
    redirect(`${page}${conclude || status === "concluido" ? "?concluido=1" : "?salvo=1"}`);
  });
}
