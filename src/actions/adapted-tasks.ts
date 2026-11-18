"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { UPLOAD_LIMIT_BYTES, megabytes, optionalUpload } from "@/lib/uploads";
import { createAdaptedTask, createLevels, deleteAdaptedTask, saveAdaptedTask, transcribeTask, type TaskScope, type TaskText } from "@/lib/adapted-tasks";
import type { AdaptedContent, AnswerFormat } from "@/lib/adapted-tasks-core";

const taskForm = z.object({
  intent: formField.text(),
  title: formField.text(),
  text: formField.text(),
  kind: z.unknown().transform((value) => (value === "prova" ? "prova" : "atividade")),
  options: formField.list(),
  objectiveId: formField.optionalText(),
});

export async function adaptTask(scope: TaskScope, formData: FormData): Promise<ActionResult<TaskText>> {
  return runFormAction(formData, taskForm, async (user, data) => {
    const file = optionalUpload(formData.get("file"), {
      maxBytes: UPLOAD_LIMIT_BYTES.taskFile,
      tooLarge: `O arquivo passa de ${megabytes(UPLOAD_LIMIT_BYTES.taskFile)} MB. Tire a foto de novo ou divida o PDF.`,
    });
    if (data.intent !== "adaptar" && file) {
      const read = await transcribeTask(user, scope, file);
      return { title: data.title || read.title, text: read.text };
    }
    if ("studentId" in scope) {
      const task = await createAdaptedTask(user, scope.studentId, data);
      redirect(`/estudantes/${scope.studentId}/atividades/adaptadas/${task.id}`);
    }
    const batchId = await createLevels(user, scope.planningId, data);
    redirect(`/planejamento/${scope.planningId}/niveis?lote=${batchId}`);
  });
}

function contentFrom(formData: FormData): Partial<AdaptedContent> {
  const text = (name: string) => String(formData.get(name) ?? "");
  const lines = (name: string) => text(name).split("\n").map((line) => line.trim()).filter(Boolean);
  const count = Number(formData.get("itemCount") ?? 0);
  return {
    title: text("title"),
    instructions: lines("instructions"),
    items: Array.from({ length: Math.min(count, 40) }, (_, index) => ({
      number: index + 1,
      prompt: text(`item-${index}-prompt`),
      answerFormat: text(`item-${index}-format`) as AnswerFormat,
      options: lines(`item-${index}-options`),
      support: text(`item-${index}-support`),
    })),
    teacherNotes: lines("teacherNotes"),
    preserved: text("preserved"),
  };
}

export async function saveTask(scope: TaskScope, taskId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    await saveAdaptedTask(user, scope, taskId, contentFrom(formData), formData.get("intent") === "aprovar");
  });
}

export async function removeStudentTask(studentId: string, taskId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await deleteAdaptedTask(user, { studentId }, taskId);
    redirect(`/estudantes/${studentId}/atividades`);
  });
}
