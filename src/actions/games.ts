"use server";

import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runFormAction } from "@/lib/server-action";
import { saveDiaryEntry } from "@/lib/records";

const gameForm = z.object({ participation: formField.text(20), criterionMet: formField.text(20), supportLevel: z.coerce.number(), nota: formField.text(500) });

export async function recordGameSession(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, gameForm, async (user, data) => {
    await saveDiaryEntry(user, studentId, {
      participation: data.participation,
      supportLevel: data.supportLevel,
      criterionMet: data.criterionMet,
      note: data.nota || "Jogo educativo.",
      authorRole: user.role,
    });
  });
}
