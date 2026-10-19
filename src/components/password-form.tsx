"use client";

import { useActionState, useId } from "react";
import { KeyRound } from "lucide-react";
import type { PasswordState } from "@/actions/account";
import { PASSWORD_MIN } from "@/lib/user-admin";
import { hintCls, inputCls, labelCls, primaryButtonCls } from "@/components/form-styles";

// Senha nova com confirmação; com askCurrent, pede também a senha atual.
export function PasswordForm({ action, askCurrent = false, button, pendingLabel, savedMessage }: {
  action: (previous: PasswordState, formData: FormData) => Promise<PasswordState>;
  askCurrent?: boolean;
  button: string;
  pendingLabel: string;
  savedMessage?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const id = useId();
  return (
    <form action={submit} className="grid max-w-sm gap-4">
      {askCurrent ? (
        <div>
          <label htmlFor={`${id}-current`} className={labelCls}>Senha atual</label>
          <input id={`${id}-current`} name="current" type="password" required autoComplete="current-password" className={inputCls} />
        </div>
      ) : null}
      <div>
        <label htmlFor={`${id}-password`} className={labelCls}>Senha nova</label>
        <p id={`${id}-hint`} className={hintCls}>Pelo menos {PASSWORD_MIN} caracteres. Uma frase curta funciona bem, como &quot;girassol no pátio azul&quot;. Não use seu nome nem seu e-mail.</p>
        <input id={`${id}-password`} name="password" type="password" required minLength={PASSWORD_MIN} maxLength={128} autoComplete="new-password" aria-describedby={`${id}-hint`} className={inputCls} />
      </div>
      <div>
        <label htmlFor={`${id}-confirm`} className={labelCls}>Repita a senha nova</label>
        <input id={`${id}-confirm`} name="confirm" type="password" required minLength={PASSWORD_MIN} maxLength={128} autoComplete="new-password" className={inputCls} />
      </div>
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      {state.saved && savedMessage ? <p role="status" className="text-sm font-medium text-green">{savedMessage}</p> : null}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonCls}>
          <KeyRound size={16} aria-hidden /> {pending ? pendingLabel : button}
        </button>
      </div>
    </form>
  );
}
