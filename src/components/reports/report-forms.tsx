"use client";

import { useActionState } from "react";
import { CircleCheck, FilePlus2, Save } from "lucide-react";
import type { ReportState } from "@/actions/reports";
import { hintCls, inputCls, labelCls, primaryButtonCls, secondaryButtonCls, textareaCls } from "@/components/form-styles";

type Action = (previous: ReportState, formData: FormData) => Promise<ReportState>;

// Novo relatório: o período (semestre atual por padrão).
export function NewReportForm({ action, start, end }: { action: Action; start: string; end: string }) {
  const [state, submit, pending] = useActionState(action, {});
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
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonCls}><FilePlus2 size={16} aria-hidden /> {pending ? "Juntando os registros…" : "Montar o relatório do período"}</button>
      </div>
    </form>
  );
}

// Parecer: salvar o rascunho ou validar e publicar para a família.
export function OpinionEditor({ action, opinion, canValidate }: { action: Action; opinion: string; canValidate: boolean }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="grid gap-4">
      <div>
        <label htmlFor="relatorio-parecer-texto" className={labelCls}>Parecer da equipe</label>
        <p id="relatorio-parecer-dica" className={hintCls}>A plataforma escreveu um rascunho com os registros do período. Leia, corrija e complete o trecho entre colchetes. A família lê este texto no portal: use palavras simples.</p>
        <textarea id="relatorio-parecer-texto" name="opinion" rows={12} defaultValue={opinion} maxLength={8000} aria-describedby="relatorio-parecer-dica" className={textareaCls} />
      </div>
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      {state.saved ? <p role="status" className="text-sm font-medium text-green">Parecer salvo.</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="salvar" disabled={pending} className={secondaryButtonCls}><Save size={16} aria-hidden /> Salvar o rascunho</button>
        {canValidate ? (
          <button type="submit" name="intent" value="validar" disabled={pending} className={primaryButtonCls}><CircleCheck size={16} aria-hidden /> Validar e publicar para a família</button>
        ) : (
          <p className="text-sm text-ink-soft">Quem valida é o professor do AEE ou a coordenação.</p>
        )}
      </div>
    </form>
  );
}
