"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { getPendingLogin, upgradeSession } from "@/lib/auth";
import * as security from "@/lib/account-security";
import { formField, readForm } from "@/lib/form-data";
import { runAction, runFormAction, runWithoutSession } from "@/lib/server-action";
import { homeAfterLogin } from "@/lib/tenant";
import { RECOVERY_CODE_USED_HREF } from "@/lib/search-params";

const codeForm = z.object({ code: formField.text(20) });

export async function verifySecondStep(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runWithoutSession(async () => {
    const pending = await getPendingLogin();
    if (!pending) redirect("/login");
    if (pending.user.mustChangePassword) redirect("/login/nova-senha");
    if (!pending.user.totpEnabledAt) redirect("/login/duas-etapas");
    const kind = await security.confirmSecondStep(pending, readForm(formData, codeForm).code);
    const home = await homeAfterLogin();
    redirect(kind === "recuperacao" && home === "/" ? RECOVERY_CODE_USED_HREF : home);
  });
}

async function setupUser(): Promise<security.SetupUser> {
  const user = await security.twoFactorSetupUser();
  if (!user) redirect("/login");
  return user;
}

export async function startTwoFactorSetup(): Promise<ActionResult> {
  return runWithoutSession(async () => {
    await security.startTwoFactorSetup(await setupUser());
    revalidatePath("/conta/seguranca");
    revalidatePath("/login/duas-etapas");
  });
}

export async function cancelTwoFactorSetup(): Promise<ActionResult> {
  return runWithoutSession(async () => {
    await security.cancelTwoFactorSetup(await setupUser());
    revalidatePath("/conta/seguranca");
  });
}

export async function confirmTwoFactorSetup(_previous: unknown, formData: FormData): Promise<ActionResult<string[]>> {
  return runWithoutSession(async () => security.confirmTwoFactorSetup(await setupUser(), readForm(formData, codeForm).code));
}

export async function finishSecondStepSetup(): Promise<ActionResult> {
  return runWithoutSession(async () => {
    const pending = await getPendingLogin();
    if (!pending) redirect("/login");
    if (pending.user.mustChangePassword) redirect("/login/nova-senha");
    if (!pending.user.totpEnabledAt || pending.user.totpEnabledAt < pending.startedAt) redirect("/login/duas-etapas");
    await upgradeSession(pending.sessionId, pending.user.id);
    redirect(await homeAfterLogin());
  });
}

export async function regenerateRecoveryCodes(_previous: unknown, formData: FormData): Promise<ActionResult<string[]>> {
  return runFormAction(formData, codeForm, (user, data) => security.regenerateRecoveryCodes(user, data.code));
}

export async function disableTwoFactor(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, codeForm, async (user, data) => {
    await security.disableTwoFactor(user, data.code);
    revalidatePath("/conta/seguranca");
  });
}

export async function endOtherSessions(): Promise<ActionResult> {
  return runAction(async (user) => {
    await security.endOtherSessions(user.id);
    revalidatePath("/conta/seguranca");
  });
}
