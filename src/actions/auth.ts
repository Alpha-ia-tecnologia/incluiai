"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { destroySession } from "@/lib/auth";
import { signIn } from "@/lib/account-security";
import { formField, readForm } from "@/lib/form-data";
import { runWithoutSession } from "@/lib/server-action";
import { homeAfterLogin } from "@/lib/tenant";

const credentials = z.object({ email: formField.text(), password: z.string().catch("") });

export async function login(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runWithoutSession(async () => {
    const { email, password } = readForm(formData, credentials);
    const step = await signIn(email, password);
    redirect(step ? `/login/${step}` : await homeAfterLogin());
  });
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
