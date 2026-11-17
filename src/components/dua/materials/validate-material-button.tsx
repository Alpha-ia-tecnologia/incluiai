"use client";

import { CircleCheck } from "lucide-react";
import { validateDuaMaterial } from "@/actions/dua";
import { FormResult } from "@/components/form-kit";
import { BUTTON_CLS } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

export function ValidateMaterialButton({ planningId, materialId, revision, title }: { planningId: string; materialId: string; revision: number; title: string }) {
  const { result, pending, submit } = useActionResult();

  function validate() {
    submit(() => validateDuaMaterial({ planningId, materialId, revision }));
  }

  return (
    <div className="min-w-0">
      <button type="button" onClick={validate} disabled={pending} aria-busy={pending} className={BUTTON_CLS.quiet}>
        <CircleCheck size={16} aria-hidden /> {pending ? "Validando…" : "Validar material"}<span className="sr-only">: {title}</span>
      </button>
      <FormResult result={result} />
    </div>
  );
}
