"use client";

import { useId, type FormEvent } from "react";
import { CircleCheck, Save } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { ANSWER_FORMATS, ANSWER_FORMAT_LABEL, type AdaptedContent } from "@/lib/adapted-tasks-core";
import { Field, FormResult } from "@/components/form-kit";
import { inputCls, labelCls, BUTTON_CLS, textareaCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

export function AdaptedEditor({ action, content, approveLabel = "Aprovar para usar" }: { action: (formData: FormData) => Promise<ActionResult>; content: AdaptedContent; approveLabel?: string }) {
  const { result, pending, submit } = useActionResult();
  const id = useId();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    submit(() => action(data), { message: "Salvo." });
  }

  return (
    <form onSubmit={save} className="grid min-w-0 gap-5" aria-busy={pending}>
      <input type="hidden" name="itemCount" value={content.items.length} />
      <input type="hidden" name="teacherNotes" value={content.teacherNotes.join("\n")} />
      <div>
        <label htmlFor={`${id}-title`} className={labelCls}>Título</label>
        <input id={`${id}-title`} name="title" defaultValue={content.title} maxLength={160} className={inputCls} />
      </div>
      <div>
        <label htmlFor={`${id}-instructions`} className={labelCls}>Orientações para o estudante (uma por linha)</label>
        <textarea id={`${id}-instructions`} name="instructions" rows={3} defaultValue={content.instructions.join("\n")} className={textareaCls} />
      </div>
      <ol className="grid min-w-0 gap-4">
        {content.items.map((item, index) => (
          <li key={index} className="grid min-w-0 gap-3 rounded-2xl bg-surface-muted/60 p-4">
            <p className="text-sm font-medium text-ink">Questão {item.number}</p>
            <div>
              <label htmlFor={`${id}-${index}-prompt`} className={labelCls}>Enunciado</label>
              <textarea id={`${id}-${index}-prompt`} name={`item-${index}-prompt`} rows={3} defaultValue={item.prompt} className={textareaCls} />
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-${index}-format`} className={labelCls}>Forma de responder</label>
                <select id={`${id}-${index}-format`} name={`item-${index}-format`} defaultValue={item.answerFormat} className={inputCls}>
                  {ANSWER_FORMATS.map((format) => <option key={format} value={format}>{ANSWER_FORMAT_LABEL[format]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-${index}-support`} className={labelCls}>Apoio (para o professor)</label>
                <input id={`${id}-${index}-support`} name={`item-${index}-support`} defaultValue={item.support} maxLength={400} className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor={`${id}-${index}-options`} className={labelCls}>Alternativas (uma por linha, se houver)</label>
              <textarea id={`${id}-${index}-options`} name={`item-${index}-options`} rows={2} defaultValue={item.options.join("\n")} className={textareaCls} />
            </div>
          </li>
        ))}
      </ol>
      <Field id={`${id}-preserved`} label="O que continua igual ao original" hint="Na prova, o que é avaliado. Confira antes de aprovar.">
        {(control) => <textarea {...control} name="preserved" rows={2} defaultValue={content.preserved} className={textareaCls} />}
      </Field>
      <FormResult result={result} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="salvar" disabled={pending} className={BUTTON_CLS.secondary}><Save size={16} aria-hidden /> Salvar ajustes</button>
        <button type="submit" name="intent" value="aprovar" disabled={pending} className={BUTTON_CLS.primary}><CircleCheck size={16} aria-hidden /> {approveLabel}</button>
      </div>
    </form>
  );
}
