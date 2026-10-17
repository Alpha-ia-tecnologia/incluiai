"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { validateDuaSupport } from "@/actions/dua";
import { ResultMessage, buttonCls } from "../dua-ui";
import type { Outcome } from "./support-form";

// "Validar apoio": confirma o apoio para esta atividade. O componente continua
// montado depois de validar para a mensagem chegar ao leitor de tela.
export function ValidateSupport({ planningId, studentId, supportId, revision, validated }: { planningId: string; studentId: string; supportId: string; revision: number; validated: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Outcome | null>(null);

  function validate() {
    start(async () => {
      const outcome = await validateDuaSupport({ planningId, studentId, supportId, revision });
      setResult(outcome.ok ? { ok: true, message: "Apoio validado para esta atividade." } : outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      {validated ? null : (
        <button type="button" onClick={validate} disabled={pending} aria-busy={pending} className={buttonCls}>
          <CircleCheck size={16} aria-hidden /> {pending ? "Validando…" : "Validar apoio"}
        </button>
      )}
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        Validar confirma o apoio só para esta atividade. Não altera a matrícula, a classificação na educação especial, o perfil nem o Plano de ensino.
      </p>
      <ResultMessage result={result} />
    </div>
  );
}
