"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { ChoiceField } from "@/components/choice-field";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, textareaCls } from "@/components/form-styles";

const REASONS = [
  "Demanda da família ou da escola",
  "Transferência entre escolas",
  "Acompanhamento de caso pela equipe da Secretaria",
  "Requisição de órgão de proteção (Conselho Tutelar, Ministério Público)",
];

export function NominalAccessForm({ action }: { action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult> }) {
  const [result, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="grid gap-5">
      <ChoiceField name="reason" label="Motivo do acesso (obrigatório)" options={REASONS} required otherPlaceholder="Descreva o motivo" />
      <Field id="access-detail" label="O que você precisa ver e por quê (obrigatório)" hint="A família vê este texto no histórico de quem acessou os dados do estudante.">
        {(control) => <textarea {...control} name="detail" required minLength={10} maxLength={240} rows={3} className={textareaCls} />}
      </Field>
      <FormResult result={result} />
      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS.primary}>
          <KeyRound size={16} aria-hidden /> {pending ? "Registrando o acesso…" : "Registrar o motivo e abrir a ficha"}
        </button>
      </div>
    </form>
  );
}
