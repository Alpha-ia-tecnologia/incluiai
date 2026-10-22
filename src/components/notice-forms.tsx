"use client";

import { useActionState } from "react";
import { Check, Send } from "lucide-react";
import type { NoticeState } from "@/actions/notifications";
import { CHECKIN_OPTIONS } from "@/lib/family-contact";
import { choiceCls, hintCls, labelCls, primaryButtonCls, secondaryButtonCls, textareaCls } from "@/components/form-styles";

type Action = (previous: NoticeState, formData: FormData) => Promise<NoticeState>;

// Preferências dos avisos: e-mail (se houver na instalação) e pergunta da semana (família).
export function NoticePrefsForm({ action, notifyByEmail, weeklyCheckIn, emailOn, family }: { action: Action; notifyByEmail: boolean; weeklyCheckIn: boolean; emailOn: boolean; family: boolean }) {
  const [state, submit, pending] = useActionState(action, {});
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
      <p className={hintCls}>O e-mail só diz que há novidade e leva o link: nunca o nome, a escola ou o assunto do estudante.</p>
      {state.saved ? <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-green"><Check size={16} aria-hidden /> Preferências salvas.</p> : null}
      <div><button type="submit" disabled={pending} className={secondaryButtonCls}>Salvar as preferências</button></div>
    </form>
  );
}

// Pergunta da semana à família: opções e um campo livre. Depois de responder,
// a resposta fica resumida e pode ser mudada até domingo.
export function CheckInForm({ action, firstName, previous }: { action: Action; firstName: string; previous: { answers: string[]; note: string } | null }) {
  const [state, submit, pending] = useActionState(action, {});
  if (state.saved) return <p role="status" className="flex items-center gap-2 text-sm font-medium text-green"><Check size={16} aria-hidden /> Obrigado! A escola vai ver a sua resposta no próximo registro de aula.</p>;
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
      <div>
        <label htmlFor="checkin-nota" className={labelCls}>Quer contar mais? (opcional)</label>
        <textarea id="checkin-nota" name="note" rows={3} maxLength={1000} defaultValue={previous?.note} className={textareaCls} />
      </div>
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div><button type="submit" disabled={pending} className={primaryButtonCls}><Send size={16} aria-hidden /> {previous ? "Atualizar a resposta" : "Enviar para a escola"}</button></div>
    </form>
  );
  if (!previous) return form;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink"><span className="font-medium">Você já contou como foi esta semana:</span> {[previous.answers.join(", "), previous.note].filter(Boolean).join(". ")}</p>
      <details>
        <summary className={`${secondaryButtonCls} w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Mudar a resposta</summary>
        <div className="mt-4">{form}</div>
      </details>
    </div>
  );
}
