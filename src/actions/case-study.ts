"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { saveCaseStudy } from "@/lib/case-studies";
import { caseStudyHref } from "@/lib/search-params";

export async function saveCaseStudyAction(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const conclude = formData.get("intent") === "concluir";
    const { status, missingAee } = await saveCaseStudy(user, studentId, { answers: (key) => formData.get(key), conclude });
    if (missingAee) redirect(caseStudyHref(studentId, { notice: "faltaAee", editing: status === "concluido", hash: "#secao-essencial" }));
    redirect(caseStudyHref(studentId, { notice: conclude || status === "concluido" ? "concluido" : "salvo" }));
  });
}
