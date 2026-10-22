"use client";

import { useActionState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { AssessmentState } from "@/actions/assessments";
import { AREAS, ITEMS, type Answers } from "@/lib/assessment";
import { SUPPORT_LEVELS } from "@/lib/scale";
import { hintCls, inputCls, labelCls, primaryButtonCls, textareaCls } from "@/components/form-styles";

// Aplicar a sondagem: cada item recebe o apoio de que o estudante precisa hoje
// (ou fica como não observado). Na reavaliação, começa com as últimas respostas.
export function AssessmentForm({ action, previous }: { action: (state: AssessmentState, formData: FormData) => Promise<AssessmentState>; previous: Answers | null }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="grid min-w-0 gap-6">
      {previous ? <p className="rounded-xl bg-sky-soft/60 px-4 py-3 text-sm leading-relaxed text-ink">Os campos começam com as respostas da última sondagem. Mude o que mudou e deixe como não observado o que você não viu nesta aplicação.</p> : null}
      {AREAS.map((area) => (
        <fieldset key={area.key} className="grid min-w-0 gap-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-base font-medium text-ink">{area.label}</legend>
          {ITEMS.filter((item) => item.area === area.key).map((item) => (
            <div key={item.id} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-center">
              <label htmlFor={`item-${item.id}`} className="text-sm leading-relaxed text-ink">{item.text}</label>
              <select id={`item-${item.id}`} name={`item-${item.id}`} defaultValue={previous?.[item.id] ?? ""} className={inputCls}>
                <option value="">Não observado</option>
                {SUPPORT_LEVELS.map((level) => <option key={level.level} value={level.level}>{level.level}. {level.label}</option>)}
              </select>
            </div>
          ))}
        </fieldset>
      ))}
      <div>
        <label htmlFor="sondagem-notas" className={labelCls}>Observações (opcional)</label>
        <p id="sondagem-notas-dica" className={hintCls}>Onde e como a observação foi feita, quem participou.</p>
        <textarea id="sondagem-notas" name="notes" rows={3} maxLength={2000} aria-describedby="sondagem-notas-dica" className={textareaCls} />
      </div>
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonCls}><ClipboardCheck size={16} aria-hidden /> {pending ? "Salvando…" : "Salvar a sondagem"}</button>
      </div>
    </form>
  );
}
