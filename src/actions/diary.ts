"use server";

import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { recordHomeActivity, saveDiaryEntry, saveFamilyNote, savedLesson } from "@/lib/records";
import { supportFromInput, type SavedLesson } from "@/lib/lesson-log";

const diaryForm = z.object({
  objectiveId: formField.text(64),
  activityId: formField.text(64),
  participation: formField.text(20),
  supportLevel: z.unknown().transform(supportFromInput),
  criterionMet: formField.text(20),
  note: formField.text(),
  whatWorked: formField.text(),
  recommendation: formField.text(),
  authorRole: formField.text(60),
});

export async function createDiaryEntry(studentId: string, formData: FormData): Promise<ActionResult<SavedLesson>> {
  return runFormAction(formData, diaryForm, async (user, entry) => {
    const saved = await saveDiaryEntry(user, studentId, entry);
    return savedLesson(user, studentId, saved.objectiveId);
  });
}

export async function markHomeActivityDone(activityId: string): Promise<ActionResult> {
  return runAction((user) => recordHomeActivity(user, activityId));
}

const familyNoteForm = z.object({ note: formField.text(), author: formField.text(120) });

export async function createFamilyNote(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, familyNoteForm, async (user, data) => {
    await saveFamilyNote(user, studentId, data.note, data.author);
  });
}
