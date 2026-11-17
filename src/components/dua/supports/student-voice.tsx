"use client";

import type { FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addDuaStudentVoice, removeDuaStudentVoice } from "@/actions/dua";
import {
  STUDENT_VOICE_KINDS, STUDENT_VOICE_LABEL, VOICE_ORIGINS, VOICE_ORIGIN_LABEL,
  type StudentVoiceEntry, type StudentVoiceKind, type VoiceOrigin,
} from "@/lib/dua/domain";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, inputCls, labelCls, textareaCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

const dateLabel = (value: string) => value.split("-").reverse().join("/");

type Props = { planningId: string; studentId: string; supportId: string; entries: StudentVoiceEntry[]; canEdit: boolean; today: string };

export function StudentVoice({ planningId, studentId, supportId, entries, canEdit, today }: Props) {
  const removal = useActionResult();
  const addition = useActionResult();
  const pending = removal.pending || addition.pending;
  const prefix = `voz-${supportId}`;
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  function remove(entry: StudentVoiceEntry) {
    removal.submit(() => removeDuaStudentVoice({ planningId, studentId, supportId, entryId: entry.id }), { message: "Registro de participação removido." });
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) ?? "");
    addition.submit(() => addDuaStudentVoice({
      planningId, studentId, supportId,
      kind: value("kind") as StudentVoiceKind,
      text: value("text"),
      context: value("context"),
      origin: value("origin") as VoiceOrigin,
      date: value("date"),
    }), { message: "Participação registrada.", onSuccess: () => formElement.reset() });
  }

  return (
    <div className="min-w-0">
      <p className="text-sm leading-relaxed text-ink-soft">
        Uma escolha pontual vale para a situação em que aconteceu: não classifica o estudante de forma permanente. Escolher o áudio hoje, por exemplo, não faz dele um estudante “auditivo”. Preferências mudam e podem ser revistas.
      </p>

      {sorted.length ? (
        <ul className="mt-3 grid min-w-0 gap-2">
          {sorted.map((entry) => (
            <li key={entry.id} className="min-w-0 rounded-xl bg-surface-muted/60 p-3">
              <p className="text-xs font-medium text-ink-soft">{STUDENT_VOICE_LABEL[entry.kind] ?? entry.kind}</p>
              <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">{entry.text}</p>
              <p className="mt-1 break-words text-xs text-ink-soft">
                Contexto: {entry.context} · {VOICE_ORIGIN_LABEL[entry.origin] ?? entry.origin} · {dateLabel(entry.date)}
              </p>
              {canEdit ? (
                <button type="button" onClick={() => remove(entry)} disabled={pending} className={`${BUTTON_CLS.dangerOutline} mt-2`} aria-label={`Remover o registro de ${dateLabel(entry.date)}: ${STUDENT_VOICE_LABEL[entry.kind] ?? entry.kind}`}>
                  <Trash2 size={16} aria-hidden /> Remover
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">Ainda não há registro do que o estudante disse ou mostrou sobre esta atividade.</p>
      )}
      <FormResult result={removal.result} />

      {canEdit ? (
        <details className="mt-3 min-w-0 rounded-xl border border-line px-4">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-strong">Registrar a participação do estudante</summary>
          <form onSubmit={add} className="grid min-w-0 gap-4 pb-4" aria-busy={pending}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id={`${prefix}-tipo`} label="O que foi registrado">
                {(control) => (
                  <select {...control} name="kind" required defaultValue="interesse" className={inputCls}>
                    {STUDENT_VOICE_KINDS.map((kind) => <option key={kind} value={kind}>{STUDENT_VOICE_LABEL[kind]}</option>)}
                  </select>
                )}
              </Field>
              <Field id={`${prefix}-data`} label="Data">
                {(control) => <input {...control} name="date" type="date" required defaultValue={today} className={inputCls} />}
              </Field>
            </div>
            <Field id={`${prefix}-texto`} label="O que o estudante disse ou mostrou" hint="Com as palavras ou os gestos dele, sem interpretar.">
              {(control) => <textarea {...control} name="text" required maxLength={600} className={`${textareaCls} min-h-16`} />}
            </Field>
            <Field id={`${prefix}-contexto`} label="Em que situação" hint="Ex.: na leitura do conto, em dupla, na sala comum.">
              {(control) => <input {...control} name="context" required maxLength={300} className={inputCls} />}
            </Field>
            <fieldset className="min-w-0">
              <legend className={labelCls}>Origem da informação</legend>
              <div className="grid gap-1">
                {VOICE_ORIGINS.map((origin) => (
                  <label key={origin} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                    <input type="radio" name="origin" value={origin} required defaultChecked={origin === "estudante"} className="size-4 accent-[var(--brand)]" />
                    {VOICE_ORIGIN_LABEL[origin]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <button type="submit" disabled={pending} className={BUTTON_CLS.quiet}>
                <Plus size={16} aria-hidden /> {pending ? "Salvando…" : "Salvar registro"}
              </button>
            </div>
            <FormResult result={addition.result} />
          </form>
        </details>
      ) : null}
    </div>
  );
}
