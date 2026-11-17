"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { FormResult } from "@/components/form-kit";
import { BUTTON_CLS } from "@/components/form-styles";

export function ResetPassword({ action }: { action: () => Promise<ActionResult<string>> }) {
  const [result, submit, pending] = useActionState<ActionResult<string> | null>(action, null);
  if (result?.ok) {
    return (
      <div role="status" className="grid gap-2">
        <p className="text-sm text-ink-soft">Senha temporária (aparece só agora):</p>
        <p id="senha-temporaria" className="font-mono text-xl tracking-wider text-ink">{result.value}</p>
        <p className="text-sm text-ink-soft">Sessões abertas encerradas. No próximo acesso, a pessoa cria a própria senha.</p>
      </div>
    );
  }
  return (
    <form action={submit} className="grid gap-2">
      <FormResult result={result} />
      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS.secondary}>
          <KeyRound size={16} aria-hidden /> {pending ? "Gerando…" : "Gerar senha temporária"}
        </button>
      </div>
    </form>
  );
}
