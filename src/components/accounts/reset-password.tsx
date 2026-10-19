"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import type { ResetState } from "@/actions/users";
import { secondaryButtonCls } from "@/components/form-styles";

// Redefinir a senha: a temporária aparece uma vez, para a gestão entregar.
export function ResetPassword({ action }: { action: (previous: ResetState) => Promise<ResetState> }) {
  const [state, submit, pending] = useActionState(action, {});
  if (state.password) {
    return (
      <div role="status" className="grid gap-2">
        <p className="text-sm text-ink-soft">Senha temporária (aparece só agora):</p>
        <p id="senha-temporaria" className="font-mono text-lg tracking-wider text-ink">{state.password}</p>
        <p className="text-sm leading-relaxed text-ink-soft">As sessões abertas foram encerradas. No próximo acesso, a pessoa entra com esta senha e cria a própria.</p>
      </div>
    );
  }
  return (
    <form action={submit} className="grid gap-2">
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div>
        <button type="submit" disabled={pending} className={secondaryButtonCls}>
          <KeyRound size={16} aria-hidden /> {pending ? "Gerando…" : "Gerar senha temporária"}
        </button>
      </div>
    </form>
  );
}
