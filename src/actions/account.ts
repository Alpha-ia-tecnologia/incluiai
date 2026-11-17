"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { getPendingLogin } from "@/lib/auth";
import * as security from "@/lib/account-security";
import { readForm } from "@/lib/form-data";
import { runFormAction, runWithoutSession } from "@/lib/server-action";
import { homeAfterLogin } from "@/lib/tenant";

const newPassword = z.object({ password: z.string().catch(""), confirm: z.string().catch("") });
const passwordChange = newPassword.extend({ current: z.string().catch("") });

export async function setPasswordAtLogin(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runWithoutSession(async () => {
    const pending = await getPendingLogin();
    if (!pending) redirect("/login");
    if (!pending.user.mustChangePassword) redirect("/login/duas-etapas");
    const next = await security.createOwnPassword(pending, readForm(formData, newPassword));
    redirect(next ? `/login/${next}` : await homeAfterLogin());
  });
}

export async function changeOwnPassword(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, passwordChange, async (user, data) => {
    await security.changeOwnPassword(user, data);
    revalidatePath("/conta/seguranca");
  });
}
