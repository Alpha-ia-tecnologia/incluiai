"use client";

import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { saveAeeSessionAction } from "@/actions/aee-sessions";
import { AEE_SESSION_STATUSES, AEE_SESSION_STATUS_LABEL, type AeeSessionStatus } from "@/lib/dua/domain";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, inputCls, labelCls, textareaCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

const STATUS_HINT: Record<AeeSessionStatus, string> = {
  realizado: "Aconteceu.",
  falta: "Estava previsto e o estudante não veio.",
  cancelamento: "Foi desmarcado.",
};

const dateLabel = (value: string) => value.split("-").reverse().join("/");

export function AeeSessionForm({ studentId, today }: { studentId: string; today: string }) {
  const { result, pending, submit } = useActionResult();
  const [status, setStatus] = useState<AeeSessionStatus>("realizado");
  const needsReason = status !== "realizado";

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const date = String(form.get("date") ?? "");
    const chosen = status;
    submit(() => saveAeeSessionAction({
      studentId,
      date,
      status: chosen,
      reason: needsReason ? String(form.get("reason") ?? "") : "",
      note: String(form.get("note") ?? ""),
    }), {
      message: `Atendimento de ${dateLabel(date)} registrado como ${AEE_SESSION_STATUS_LABEL[chosen].toLowerCase()}.`,
      onSuccess: () => {
        formElement.reset();
        setStatus("realizado");
      },
    });
  }

  return (
    <form onSubmit={save} className="grid min-w-0 gap-5" aria-busy={pending}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id="aee-data" label="Data do atendimento" hint="Um por dia: registrar de novo na mesma data corrige.">
          {(control) => <input {...control} name="date" type="date" required defaultValue={today} className={inputCls} />}
        </Field>
        <fieldset className="min-w-0">
          <legend className={labelCls}>Situação</legend>
          <div className="grid gap-1">
            {AEE_SESSION_STATUSES.map((option) => (
              <label key={option} className="flex min-h-11 items-start gap-2 py-1 text-sm text-ink">
                <input type="radio" name="status" value={option} checked={status === option} onChange={() => setStatus(option)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                <span className="min-w-0">
                  {AEE_SESSION_STATUS_LABEL[option]}
                  <span className="block text-xs text-ink-soft">{STATUS_HINT[option]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {needsReason ? (
        <Field id="aee-motivo" label={status === "falta" ? "Motivo da falta (obrigatório)" : "Motivo do cancelamento (obrigatório)"}>
          {(control) => <input {...control} name="reason" required maxLength={300} className={inputCls} placeholder={status === "falta" ? "Ex.: consulta médica informada pela família" : "Ex.: reunião pedagógica no horário"} />}
        </Field>
      ) : null}

      <Field id="aee-nota" label="Observação (opcional)" hint="Algo a lembrar sobre o encontro.">
        {(control) => <textarea {...control} name="note" maxLength={1200} className={`${textareaCls} min-h-16`} />}
      </Field>

      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS.primary}>
          <Save size={16} aria-hidden /> {pending ? "Salvando…" : "Registrar atendimento"}
        </button>
        <FormResult result={result} />
      </div>
    </form>
  );
}
