"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { profileFromForm } from "@/lib/functional-profile";
import { saveProfile } from "@/lib/records";
import { profileSavedHref } from "@/lib/search-params";

export async function upsertProfile(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    await saveProfile(user, studentId, profileFromForm((name) => formData.get(name), (name) => formData.getAll(name)));
    redirect(profileSavedHref(studentId));
  });
}
