"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { saveAeeSession } from "@/lib/aee-sessions";

const session = z.object({ studentId: z.string().trim().min(1).max(64), date: z.string().max(10), status: z.string().max(20), reason: z.string().max(600).default(""), note: z.string().max(2400).default("") });

export async function saveAeeSessionAction(input: z.input<typeof session>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = session.parse(input);
    await saveAeeSession(user, data.studentId, data);
    revalidatePath(`/estudantes/${data.studentId}`, "layout");
  });
}
