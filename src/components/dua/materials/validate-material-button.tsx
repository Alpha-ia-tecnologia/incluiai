"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { validateDuaMaterial, type DuaResult } from "@/actions/dua";
import { ResultMessage, secondaryCls } from "../dua-ui";

// Validação profissional do material para uso pedagógico. O servidor recusa
// quando a versão de origem ainda não foi validada; a mensagem aparece aqui.
export function ValidateMaterialButton({ planningId, materialId, revision, title }: { planningId: string; materialId: string; revision: number; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DuaResult | null>(null);

  function validate() {
    start(async () => {
      const outcome = await validateDuaMaterial({ planningId, materialId, revision });
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <button type="button" onClick={validate} disabled={pending} aria-busy={pending} className={secondaryCls}>
        <CircleCheck size={16} aria-hidden /> {pending ? "Validando…" : "Validar material"}<span className="sr-only">: {title}</span>
      </button>
      <ResultMessage result={result && !result.ok ? result : null} />
    </div>
  );
}
