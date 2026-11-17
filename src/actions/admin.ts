"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import * as schools from "@/lib/schools";

const schoolForm = z.object({ name: formField.text(), region: formField.text() });

export async function createSchool(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, schoolForm, async (user, data) => {
    await schools.createSchool(user, data);
    revalidatePath("/cadastros");
  });
}

const classForm = z.object({ schoolId: formField.text(), name: formField.text(), gradeYear: formField.optionalText(), shift: formField.text() });

export async function createClass(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, classForm, async (user, data) => {
    await schools.saveClass(user, data);
    revalidatePath("/cadastros");
    revalidatePath("/estudantes/novo");
  });
}

export async function deleteClass(classId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await schools.deleteClass(user, classId);
    revalidatePath("/cadastros");
  });
}
