"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import type { NominalAccessState } from "@/actions/access";
import { ChoiceField } from "@/components/choice-field";
import { hintCls, inputCls, labelCls, primaryButtonCls, textareaCls } from "@/components/form-styles";

const REASONS = [
  "Demanda da família ou da escola",
  "Transferência entre escolas",
  "Acompanhamento de caso pela equipe da Secretaria",
  "Requisição de órgão de proteção (Conselho Tutelar, Ministério Público)",
];

export function NominalAccessForm({ action }: { action: (previous: NominalAccessState, formData: FormData) => Promise<NominalAccessState> }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="grid gap-5">
      <ChoiceField name="reason" label="Motivo do acesso (obrigatório)" options={REASONS} required otherPlaceholder="Descreva o motivo" labelClassName={labelCls} inputClassName={inputCls} />
      <div>
        <label htmlFor="access-detail" className={labelCls}>O que você precisa ver e por quê (obrigatório)</label>
        <p id="access-detail-hint" className={hintCls}>A família vê este texto no histórico de quem acessou os dados do estudante.</p>
        <textarea id="access-detail" name="detail" required minLength={10} maxLength={240} rows={3} aria-describedby="access-detail-hint" className={textareaCls} />
      </div>
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonCls}>
          <KeyRound size={16} aria-hidden /> {pending ? "Registrando o acesso…" : "Registrar o motivo e abrir a ficha"}
        </button>
      </div>
    </form>
  );
}
