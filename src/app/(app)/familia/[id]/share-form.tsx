"use client";

import { useActionState, useState } from "react";
import { Check, ChevronDown, Send, Trophy } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { CHECKIN_OPTIONS } from "@/lib/family-contact";
import { FAMILY_ACHIEVEMENT_OPTIONS, FAMILY_MEMBER_OPTIONS } from "@/lib/form-options";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, textareaCls } from "@/components/form-styles";

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
type Props = {
  action: Action;
  firstName: string;
  /** A pergunta da semana entra no formulário (só para a família, e se ela não desligou em Avisos). */
  weekly: boolean;
  /** A resposta desta semana, se já houve. */
  previous: { answers: string[]; note: string } | null;
};

const CHECKIN_CHOICES = [...CHECKIN_OPTIONS];

/** "Contar para a escola": a pergunta da semana e a conquista de casa num formulário só. */
export function ShareForm(props: Props) {
  const [round, setRound] = useState(0);
  return <ShareRound key={round} {...props} again={() => setRound((value) => value + 1)} />;
}

function ShareRound({ action, firstName, weekly, previous, again }: Props & { again: () => void }) {
  const [result, submit, pending] = useActionState(action, null);
  if (result?.ok) {
    return (
      <div className="grid justify-items-start gap-3">
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-green"><Check size={16} aria-hidden /> Obrigado! A escola vai ver o que vocês contaram.</p>
        <button type="button" onClick={again} className={BUTTON_CLS.secondary}>Contar mais uma coisa</button>
      </div>
    );
  }

  const week = (
    <div className="grid gap-4">
      <MultiChoiceField name="answers" label={`Como foi a semana de ${firstName} em casa?`} options={CHECKIN_CHOICES} defaultValue={previous?.answers ?? []} submit="multiple" allowOther={false} />
      <Field id="checkin-nota" label="Quer contar mais? (opcional)">
        {(control) => <textarea {...control} name="note" rows={3} maxLength={1000} defaultValue={previous?.note} className={textareaCls} />}
      </Field>
    </div>
  );
  const achievement = (
    <div className="grid gap-4">
      <MultiChoiceField name="achievement" label={weekly ? "Qual conquista?" : "O que aconteceu em casa?"} options={FAMILY_ACHIEVEMENT_OPTIONS} otherPlaceholder={`Ex.: ${firstName} pediu água durante o jantar`} />
      <ChoiceField name="author" label="Quem viu" options={FAMILY_MEMBER_OPTIONS} placeholder="Escolha (opcional)" otherPlaceholder="Ex.: madrinha" />
    </div>
  );

  return (
    <form action={submit} className="grid gap-5">
      {weekly && previous ? (
        <div id="pergunta-da-semana" className="grid gap-3">
          <p className="text-sm leading-relaxed text-ink"><span className="font-medium">Você já contou como foi esta semana:</span> {[previous.answers.join(", "), previous.note].filter(Boolean).join(". ")}</p>
          <details className="group/semana">
            <summary className={`${BUTTON_CLS.quiet} w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
              Mudar a resposta <ChevronDown size={16} aria-hidden className="transition-transform group-open/semana:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="mt-4">{week}</div>
          </details>
        </div>
      ) : weekly ? <div id="pergunta-da-semana">{week}</div> : null}
      {weekly ? (
        <details className="group/conquista border-t border-line pt-4">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 text-sm font-medium text-brand-strong [&::-webkit-details-marker]:hidden">
            <Trophy size={16} aria-hidden /> Teve uma conquista em casa? <ChevronDown size={16} aria-hidden className="transition-transform group-open/conquista:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="mt-3">{achievement}</div>
        </details>
      ) : achievement}
      <FormResult result={result} />
      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS.primary}><Send size={16} aria-hidden /> {pending ? "Enviando…" : "Enviar para a escola"}</button>
      </div>
    </form>
  );
}
