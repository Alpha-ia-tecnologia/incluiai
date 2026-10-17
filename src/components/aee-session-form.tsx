"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveAeeSessionAction } from "@/actions/dua";
import { AEE_SESSION_STATUSES, AEE_SESSION_STATUS_LABEL, type AeeSessionStatus } from "@/lib/dua/domain";
import { Field, ResultMessage, buttonCls, inputCls, labelCls, textareaCls } from "@/components/dua/dua-ui";

// Frequência do AEE (seção 5, CA10): realizado, falta ou cancelamento. Falta e
// cancelamento pedem o motivo. Registrar de novo na mesma data corrige o registro.

type Outcome = { ok: boolean; message?: string; problems?: { field: string; message: string }[] };

const STATUS_HINT: Record<AeeSessionStatus, string> = {
  realizado: "O atendimento aconteceu.",
  falta: "O atendimento estava previsto e o estudante não compareceu.",
  cancelamento: "O atendimento foi desmarcado.",
};

const dateLabel = (value: string) => value.split("-").reverse().join("/");

export function AeeSessionForm({ studentId, today }: { studentId: string; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<AeeSessionStatus>("realizado");
  const [result, setResult] = useState<Outcome | null>(null);
  const needsReason = status !== "realizado";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const date = String(form.get("date") ?? "");
    const chosen = status;
    start(async () => {
      const outcome = await saveAeeSessionAction({
        studentId,
        date,
        status: chosen,
        reason: needsReason ? String(form.get("reason") ?? "") : "",
        note: String(form.get("note") ?? ""),
      });
      setResult(outcome.ok ? { ok: true, message: `Atendimento de ${dateLabel(date)} registrado como ${AEE_SESSION_STATUS_LABEL[chosen].toLowerCase()}.` } : outcome);
      if (outcome.ok) {
        formElement.reset();
        setStatus("realizado");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-5" aria-busy={pending}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id="aee-data" label="Data do atendimento" hint="Um registro por dia: registrar de novo na mesma data corrige o anterior.">
          <input id="aee-data" name="date" type="date" required defaultValue={today} aria-describedby="aee-data-dica" className={inputCls} />
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
          <input id="aee-motivo" name="reason" required maxLength={300} className={inputCls} placeholder={status === "falta" ? "Ex.: consulta médica informada pela família" : "Ex.: reunião pedagógica no horário"} />
        </Field>
      ) : null}

      <Field id="aee-nota" label="Observação (opcional)" hint="O que for preciso lembrar sobre o encontro. O que o estudante aprendeu vai nas evidências e no diário.">
        <textarea id="aee-nota" name="note" maxLength={1200} aria-describedby="aee-nota-dica" className={`${textareaCls} min-h-16`} />
      </Field>

      <div>
        <button type="submit" disabled={pending} className={buttonCls}>
          <Save size={16} aria-hidden /> {pending ? "Salvando…" : "Registrar atendimento"}
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}
