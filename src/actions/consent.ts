"use server";

import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { setStudentConsent } from "@/lib/consent";

export async function setFamilyConsent(studentId: string, field: string, value: boolean): Promise<ActionResult> {
  return runAction((user) => setStudentConsent(user, studentId, field, value));
}
