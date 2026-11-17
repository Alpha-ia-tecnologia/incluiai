"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runFormAction } from "@/lib/server-action";
import { createStudent } from "@/lib/students";

const studentForm = z.object({
  schoolId: formField.text(64),
  name: formField.text(),
  birthDate: formField.text(10),
  stage: formField.text(60),
  gradeYear: formField.text(),
  className: formField.text(),
  shift: formField.text(),
  guardianName: formField.text(),
  guardianPhone: formField.text(),
  aeeFrequency: formField.text(),
  accessibilityNotes: formField.text(),
  supportProfessional: formField.checkbox(),
});

export async function createStudentAction(formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, studentForm, async (user, { schoolId, ...fields }) => {
    const student = await createStudent(user, schoolId, fields);
    redirect(`/estudantes/${student.id}`);
  });
}
