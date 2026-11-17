"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runFormAction } from "@/lib/server-action";
import { saveCheckIn, saveNoticePrefs } from "@/lib/notifications";

const prefsForm = z.object({ notifyByEmail: formField.checkbox(), weeklyCheckIn: formField.checkbox() });

export async function setNoticePrefs(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, prefsForm, async (user, data) => {
    await saveNoticePrefs(user, data);
    revalidatePath("/avisos");
  });
}

const checkInForm = z.object({ answers: formField.list(), note: formField.text() });

export async function answerCheckIn(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, checkInForm, async (user, data) => {
    await saveCheckIn(user, studentId, data.answers, data.note);
  });
}
