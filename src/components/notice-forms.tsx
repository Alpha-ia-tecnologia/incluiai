"use client";

import { useActionState } from "react";
import { EyeOff, Link2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { FormResult } from "@/components/form-kit";
import { choiceCls, BUTTON_CLS } from "@/components/form-styles";
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
