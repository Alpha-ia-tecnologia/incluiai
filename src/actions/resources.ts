"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runFormAction } from "@/lib/server-action";
import { registerResourceUse as registerUse } from "@/lib/resources";

const outcome = z.object({ worked: formField.text() });

export async function registerResourceUse(resourceId: string, activityId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, outcome, async (user, data) => {
    await registerUse(user, resourceId, activityId, data.worked === "sim");
    revalidatePath(`/recursos/${resourceId}`);
    revalidatePath("/recursos");
  });
}
