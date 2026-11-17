"use server";

import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { illustrateActivity, removeActivityImage as removeImage } from "@/lib/activities";

const imageRequest = z.object({ kind: formField.text(500) });

export async function generateActivityImage(studentId: string, activityId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, imageRequest, async (user, data) => {
    await illustrateActivity(user, studentId, activityId, data.kind);
  });
}

export async function removeActivityImage(studentId: string, activityId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await removeImage(user, studentId, activityId);
  });
}
