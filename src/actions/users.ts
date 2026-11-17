"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import * as accounts from "@/lib/accounts";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";

const accountForm = z.object({ name: formField.text(), email: formField.text(), role: formField.text(), schoolId: formField.optionalText(), studentIds: formField.list() });

export async function createAccount(formData: FormData): Promise<ActionResult<accounts.CreatedAccount>> {
  return runFormAction(formData, accountForm, async (manager, input) => {
    const created = await accounts.createAccount(manager, input);
    revalidatePath("/usuarios");
    return created;
  });
}

export async function updateAccount(id: string, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, accountForm, async (manager, input) => {
    await accounts.updateAccount(manager, id, input);
    revalidatePath("/usuarios");
    revalidatePath(`/usuarios/${id}`);
  });
}

export async function resetAccountPassword(id: string): Promise<ActionResult<string>> {
  return runAction(async (manager) => {
    const password = await accounts.resetAccountPassword(manager, id);
    revalidatePath(`/usuarios/${id}`);
    return password;
  });
}

export async function resetAccountTwoFactor(id: string): Promise<ActionResult> {
  return runAction(async (manager) => {
    await accounts.resetAccountTwoFactor(manager, id);
    revalidatePath(`/usuarios/${id}`);
  });
}

export async function setAccountActive(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async (manager) => {
    await accounts.setAccountActive(manager, id, active);
    revalidatePath("/usuarios");
    revalidatePath(`/usuarios/${id}`);
  });
}
