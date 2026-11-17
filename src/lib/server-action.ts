import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod/v4";
import { getCurrentUser, type SessionUser } from "./auth";
import { FALLBACK, SESSION_ENDED, failureOf, type ActionResult } from "./action-result";
import { readForm } from "./form-data";

export async function runAction<T>(work: (user: SessionUser) => Promise<T>): Promise<ActionResult<T>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: SESSION_ENDED };
  try {
    return { ok: true, value: await work(user) };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureOf(error);
    if (failure) return failure;
    console.error("[ação] falhou:", error);
    return { ok: false, message: FALLBACK };
  }
}

export function runFormAction<S extends z.ZodObject, T>(formData: FormData, schema: S, work: (user: SessionUser, data: z.output<S>) => Promise<T>): Promise<ActionResult<T>> {
  return runAction((user) => work(user, readForm(formData, schema)));
}
