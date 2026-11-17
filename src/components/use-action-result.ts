"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";

type SubmitOptions<T> = {
  message?: string | ((value: T) => string);
  onSuccess?: (value: T) => void;
  goTo?: (value: T) => string;
};

export function useActionResult<T = void>() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult<T> | null>(null);

  function submit(call: () => Promise<ActionResult<T>>, options: SubmitOptions<T> = {}) {
    start(async () => {
      const outcome = await call();
      if (!outcome.ok) {
        setResult(outcome);
        return;
      }
      const message = typeof options.message === "function" ? options.message(outcome.value) : options.message;
      setResult(message ? { ...outcome, message } : outcome);
      options.onSuccess?.(outcome.value);
      if (options.goTo) router.push(options.goTo(outcome.value));
      else router.refresh();
    });
  }

  return { result, pending, submit };
}
