"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import { FormResult } from "@/components/form-kit";

type FormAction = (previous: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown>>;

export function ActionForm({ action, success, className, children }: { action: FormAction; success?: string; className?: string; children: ReactNode }) {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormResult result={result} success={success} />
    </form>
  );
}
