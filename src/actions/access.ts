"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runFormAction } from "@/lib/server-action";
import { grantNominalAccess } from "@/lib/nominal-access";

const accessForm = z.object({ reason: formField.text(), detail: formField.text() });

export async function requestNominalAccess(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, accessForm, async (user, request) => {
    await grantNominalAccess(user, studentId, request);
    redirect(`/estudantes/${studentId}`);
  });
}
