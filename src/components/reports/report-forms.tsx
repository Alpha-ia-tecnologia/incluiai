"use client";

import { useActionState } from "react";
import { CircleCheck, FilePlus2, Save } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { Field, FormResult } from "@/components/form-kit";
import { inputCls, labelCls, BUTTON_CLS, textareaCls } from "@/components/form-styles";

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function NewReportForm({ action, start, end }: { action: Action; start: string; end: string }) {
  const [result, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="grid max-w-xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="relatorio-inicio" className={labelCls}>Começo do período</label>
          <input id="relatorio-inicio" name="start" type="date" required defaultValue={start} className={inputCls} />
        </div>
        <div>
          <label htmlFor="relatorio-fim" className={labelCls}>Fim do período</label>
          <input id="relatorio-fim" name="end" type="date" required defaultValue={end} className={inputCls} />
        </div>
      </div>
      <FormResult result={result} />
      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS.primary}><FilePlus2 size={16} aria-hidden /> {pending ? "Juntando os registros…" : "Montar o relatório do período"}</button>
      </div>
    </form>
  );
}

export function OpinionEditor({ action, opinion, canValidate }: { action: Action; opinion: string; canValidate: boolean }) {
  const [result, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="grid gap-4">
      <Field id="relatorio-parecer-texto" label="Parecer da equipe" hint="A plataforma escreveu um rascunho com os registros do período. Leia, corrija e complete o trecho entre colchetes. A família lê este texto no portal: use palavras simples.">
        {(control) => <textarea {...control} name="opinion" rows={12} defaultValue={opinion} maxLength={8000} className={textareaCls} />}
      </Field>
      <FormResult result={result} success="Parecer salvo." />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="salvar" disabled={pending} className={BUTTON_CLS.secondary}><Save size={16} aria-hidden /> Salvar o rascunho</button>
        {canValidate ? (
          <button type="submit" name="intent" value="validar" disabled={pending} className={BUTTON_CLS.primary}><CircleCheck size={16} aria-hidden /> Validar e publicar para a família</button>
        ) : (
          <p className="text-sm text-ink-soft">Quem valida é o professor do AEE ou a coordenação.</p>
        )}
      </div>
    </form>
  );
}
