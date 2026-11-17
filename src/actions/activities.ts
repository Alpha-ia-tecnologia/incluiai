"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { invalidateStudent } from "@/lib/invalidate";
import { runAction, runFormAction } from "@/lib/server-action";
import { decideActivity } from "@/lib/records";
import { generateActivities, generateClassActivities } from "@/lib/activities";

const activityRequest = z.object({ objectiveId: formField.text(), lessonTopic: formField.text(), gerarImagens: formField.checkbox() });

export async function generateActivitiesAction(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, activityRequest, async (user, data) => {
    await generateActivities(user, studentId, { objectiveId: data.objectiveId, lessonTopic: data.lessonTopic, withImages: data.gerarImagens });
    invalidateStudent(studentId);
  });
}

export async function acceptActivity(studentId: string, activityId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await decideActivity(user, studentId, activityId, "aceita");
    invalidateStudent(studentId);
  });
}

const rejection = z.object({ reason: formField.text() });

export async function rejectActivity(studentId: string, activityId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, rejection, async (user, data) => {
    await decideActivity(user, studentId, activityId, "rejeitada", data.reason);
    invalidateStudent(studentId);
  });
}

const classRequest = z.object({ turma: formField.text(), lessonTopic: formField.text() });

export async function generateBatchForClass(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, classRequest, async (user, data) => {
    const [schoolId = "", className = ""] = data.turma.split("|");
    const students = await generateClassActivities(user, schoolId, className, data.lessonTopic);
    for (const studentId of students) invalidateStudent(studentId);
    revalidatePath("/estudantes");
    redirect(`/estudantes?lote=${students.length}`);
  });
}
