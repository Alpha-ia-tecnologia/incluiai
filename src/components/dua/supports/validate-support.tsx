"use client";

import { CircleCheck } from "lucide-react";
import { validateDuaSupport } from "@/actions/dua";
import { FormResult } from "@/components/form-kit";
import { BUTTON_CLS } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

export function ValidateSupport({ planningId, studentId, supportId, revision, validated }: { planningId: string; studentId: string; supportId: string; revision: number; validated: boolean }) {
  const { result, pending, submit } = useActionResult();

  function validate() {
    submit(() => validateDuaSupport({ planningId, studentId, supportId, revision }), { message: "Apoio validado para esta atividade." });
  }

  return (
    <div className="min-w-0">
      {validated ? null : (
        <button type="button" onClick={validate} disabled={pending} aria-busy={pending} className={BUTTON_CLS.primary}>
          <CircleCheck size={16} aria-hidden /> {pending ? "Validando…" : "Validar apoio"}
        </button>
      )}
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Validar confirma o apoio só para esta atividade. Não altera a matrícula, a classificação na educação especial, o perfil nem o Plano de ensino.
      </p>
      <FormResult result={result} />
    </div>
  );
}
