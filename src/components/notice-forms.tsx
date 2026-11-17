"use client";

import { useActionState } from "react";
import { Check, EyeOff, Link2, Send } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { CHECKIN_OPTIONS } from "@/lib/family-contact";
import { Field, FormResult } from "@/components/form-kit";
import { choiceCls, labelCls, BUTTON_CLS, textareaCls } from "@/components/form-styles";
import { Assurances } from "@/components/explain";

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function NoticePrefsForm({ action, notifyByEmail, weeklyCheckIn, emailOn, family }: { action: Action; notifyByEmail: boolean; weeklyCheckIn: boolean; emailOn: boolean; family: boolean }) {
  const [result, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="grid gap-3">
      <label className={choiceCls}>
        <input type="checkbox" name="notifyByEmail" defaultChecked={notifyByEmail} disabled={!emailOn} className="size-5 shrink-0 accent-[var(--brand)]" />
        <span>Receber os avisos também por e-mail{emailOn ? "" : " (o e-mail não está configurado nesta instalação)"}</span>
      </label>
      {family ? (
        <label className={choiceCls}>
          <input type="checkbox" name="weeklyCheckIn" defaultChecked={weeklyCheckIn} className="size-5 shrink-0 accent-[var(--brand)]" />
          <span>Mostrar a pergunta da semana no portal</span>
        </label>
      ) : <input type="hidden" name="weeklyCheckIn" value={weeklyCheckIn ? "on" : ""} />}
      <Assurances
        label="O que vai no e-mail"
        items={[
          { icon: Link2, text: "O e-mail só traz o link" },
          { icon: EyeOff, text: "Sem nome, escola ou assunto" },
        ]}
      />
      <FormResult result={result} success="Preferências salvas." />
      <div><button type="submit" disabled={pending} className={BUTTON_CLS.secondary}>Salvar as preferências</button></div>
    </form>
  );
}

export function CheckInForm({ action, firstName, previous }: { action: Action; firstName: string; previous: { answers: string[]; note: string } | null }) {
  const [result, submit, pending] = useActionState(action, null);
  if (result?.ok) return <p role="status" className="flex items-center gap-2 text-sm font-medium text-green"><Check size={16} aria-hidden /> Obrigado! A escola vai ver a sua resposta no próximo registro de aula.</p>;
  const form = (
    <form action={submit} className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className={labelCls}>Como foi a semana de {firstName} em casa? Marque o que aconteceu.</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECKIN_OPTIONS.map((option) => (
            <label key={option} className={choiceCls}>
              <input type="checkbox" name="answers" value={option} defaultChecked={previous?.answers.includes(option)} className="size-5 shrink-0 accent-[var(--brand)]" /> {option}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="checkin-nota" label="Quer contar mais? (opcional)">
        {(control) => <textarea {...control} name="note" rows={3} maxLength={1000} defaultValue={previous?.note} className={textareaCls} />}
      </Field>
      <FormResult result={result} />
      <div><button type="submit" disabled={pending} className={BUTTON_CLS.primary}><Send size={16} aria-hidden /> {previous ? "Atualizar a resposta" : "Enviar para a escola"}</button></div>
    </form>
  );
  if (!previous) return form;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink"><span className="font-medium">Você já contou como foi esta semana:</span> {[previous.answers.join(", "), previous.note].filter(Boolean).join(". ")}</p>
      <details>
        <summary className={`${BUTTON_CLS.secondary} w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Mudar a resposta</summary>
        <div className="mt-4">{form}</div>
      </details>
    </div>
  );
}
