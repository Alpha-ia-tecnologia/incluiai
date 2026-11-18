"use client";

import { useActionState, useId } from "react";
import { KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { PASSWORD_MIN } from "@/lib/accounts-core";
import { Field, FormResult } from "@/components/form-kit";
import { inputCls, BUTTON_CLS } from "@/components/form-styles";

export function PasswordForm({ action, askCurrent = false, button, pendingLabel, savedMessage }: {
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  askCurrent?: boolean;
  button: string;
  pendingLabel: string;
  savedMessage?: string;
}) {
  const [result, submit, pending] = useActionState(action, null);
  const id = useId();
  return (
    <form action={submit} className="grid max-w-sm gap-4">
      {askCurrent ? (
        <Field id={`${id}-current`} label="Senha atual">
          {(control) => <input {...control} name="current" type="password" required autoComplete="current-password" className={inputCls} />}
        </Field>
      ) : null}
      <Field id={`${id}-password`} label="Senha nova" hint={<>Pelo menos {PASSWORD_MIN} caracteres, sem seu nome ou e-mail. Uma frase curta funciona bem: &ldquo;girassol no pátio azul&rdquo;.</>}>
        {(control) => <input {...control} name="password" type="password" required minLength={PASSWORD_MIN} maxLength={128} autoComplete="new-password" className={inputCls} />}
      </Field>
      <Field id={`${id}-confirm`} label="Repita a senha nova">
        {(control) => <input {...control} name="confirm" type="password" required minLength={PASSWORD_MIN} maxLength={128} autoComplete="new-password" className={inputCls} />}
      </Field>
      <FormResult result={result} success={savedMessage} />
      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS.primary}>
          <KeyRound size={16} aria-hidden /> {pending ? pendingLabel : button}
        </button>
      </div>
    </form>
  );
}
