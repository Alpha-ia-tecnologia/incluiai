"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { addDuaStudentVoice, removeDuaStudentVoice } from "@/actions/dua";
import {
  STUDENT_VOICE_KINDS, STUDENT_VOICE_LABEL, VOICE_ORIGINS, VOICE_ORIGIN_LABEL,
  type StudentVoiceEntry, type StudentVoiceKind, type VoiceOrigin,
} from "@/lib/dua/domain";
import { Field, ResultMessage, dangerCls, inputCls, labelCls, secondaryCls, textareaCls } from "../dua-ui";
import type { Outcome } from "./support-form";

// Participação do estudante (3.4): o que ele disse ou mostrou, sempre com contexto,
// origem e data. Registros revisáveis, nunca uma classificação do estudante.

const dateLabel = (value: string) => value.split("-").reverse().join("/");

type Props = { planningId: string; studentId: string; supportId: string; entries: StudentVoiceEntry[]; canEdit: boolean; today: string };

export function StudentVoice({ planningId, studentId, supportId, entries, canEdit, today }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [removal, setRemoval] = useState<Outcome | null>(null);
  const [addition, setAddition] = useState<Outcome | null>(null);
  const prefix = `voz-${supportId}`;
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  function remove(entry: StudentVoiceEntry) {
    start(async () => {
      const outcome = await removeDuaStudentVoice({ planningId, studentId, supportId, entryId: entry.id });
      setRemoval(outcome.ok ? { ok: true, message: "Registro de participação removido." } : outcome);
      if (outcome.ok) router.refresh();
    });
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) ?? "");
    start(async () => {
      const outcome = await addDuaStudentVoice({
        planningId, studentId, supportId,
        kind: value("kind") as StudentVoiceKind,
        text: value("text"),
        context: value("context"),
        origin: value("origin") as VoiceOrigin,
        date: value("date"),
      });
      setAddition(outcome.ok ? { ok: true, message: "Participação registrada." } : outcome);
      if (outcome.ok) {
        formElement.reset();
        router.refresh();
      }
    });
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
                <button type="button" onClick={() => remove(entry)} disabled={pending} className={`${dangerCls} mt-2`} aria-label={`Remover o registro de ${dateLabel(entry.date)}: ${STUDENT_VOICE_LABEL[entry.kind] ?? entry.kind}`}>
                  <Trash2 size={16} aria-hidden /> Remover
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">Ainda não há registro do que o estudante disse ou mostrou sobre esta atividade.</p>
      )}
      <ResultMessage result={removal} />

      {canEdit ? (
        <details className="mt-3 min-w-0 rounded-xl border border-line px-4">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-strong">Registrar a participação do estudante</summary>
          <form onSubmit={add} className="grid min-w-0 gap-4 pb-4" aria-busy={pending}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id={`${prefix}-tipo`} label="O que foi registrado">
                <select id={`${prefix}-tipo`} name="kind" required defaultValue="interesse" className={inputCls}>
                  {STUDENT_VOICE_KINDS.map((kind) => <option key={kind} value={kind}>{STUDENT_VOICE_LABEL[kind]}</option>)}
                </select>
              </Field>
              <Field id={`${prefix}-data`} label="Data">
                <input id={`${prefix}-data`} name="date" type="date" required defaultValue={today} className={inputCls} />
              </Field>
            </div>
            <Field id={`${prefix}-texto`} label="O que o estudante disse ou mostrou" hint="Com as palavras ou os gestos dele, sem interpretar.">
              <textarea id={`${prefix}-texto`} name="text" required aria-describedby={`${prefix}-texto-dica`} maxLength={600} className={`${textareaCls} min-h-16`} />
            </Field>
            <Field id={`${prefix}-contexto`} label="Em que situação" hint="Ex.: na leitura do conto, em dupla, na sala comum.">
              <input id={`${prefix}-contexto`} name="context" required aria-describedby={`${prefix}-contexto-dica`} maxLength={300} className={inputCls} />
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
              <button type="submit" disabled={pending} className={secondaryCls}>
                <Plus size={16} aria-hidden /> {pending ? "Salvando…" : "Salvar registro"}
              </button>
            </div>
            <ResultMessage result={addition} />
          </form>
        </details>
      ) : null}
    </div>
  );
}
