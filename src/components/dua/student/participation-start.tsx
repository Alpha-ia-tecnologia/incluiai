"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { startStudentParticipation } from "@/actions/dua";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, inputCls, labelCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

type PlanningOption = { id: string; label: string };

export function ParticipationStart({ studentId, plannings }: { studentId: string; plannings: PlanningOption[] }) {
  const { result, pending, submit } = useActionResult<{ planningId: string }>();
  const [mode, setMode] = useState<"existente" | "nova">(plannings.length ? "existente" : "nova");

  function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const planningId = String(form.get("planningId") ?? "");
    const title = String(form.get("title") ?? "");
    submit(() => (mode === "existente" ? startStudentParticipation({ studentId, planningId }) : startStudentParticipation({ studentId, title })), {
      goTo: (value) => `/planejamento/${value.planningId}/apoios?estudante=${encodeURIComponent(studentId)}`,
    });
  }

  return (
    <form onSubmit={open} className="grid min-w-0 gap-4" aria-busy={pending}>
      <fieldset className="min-w-0">
        <legend className={labelCls}>Como você quer começar?</legend>
        <div className="grid gap-1">
          <label className={`flex min-h-11 items-center gap-2 text-sm ${plannings.length ? "text-ink" : "text-ink-soft"}`}>
            <input type="radio" name="modo" value="existente" checked={mode === "existente"} disabled={!plannings.length} onChange={() => setMode("existente")} className="size-4 accent-[var(--brand)]" />
            Em uma atividade já planejada{plannings.length ? "" : " (nenhuma disponível para você)"}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="radio" name="modo" value="nova" checked={mode === "nova"} onChange={() => setMode("nova")} className="size-4 accent-[var(--brand)]" />
            Começando uma nova atividade
          </label>
        </div>
      </fieldset>

      {mode === "existente" ? (
        <Field id="participacao-atividade" label="Atividade">
          {(control) => (
            <select {...control} name="planningId" required defaultValue="" className={inputCls}>
              <option value="" disabled>Escolha a atividade</option>
              {plannings.map((planning) => <option key={planning.id} value={planning.id}>{planning.label}</option>)}
            </select>
          )}
        </Field>
      ) : (
        <Field id="participacao-titulo" label="Título da nova atividade">
          {(control) => <input {...control} name="title" required minLength={3} maxLength={160} className={inputCls} placeholder="Ex.: Compreensão de uma narrativa" />}
        </Field>
      )}

      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS.primary}>
          {pending ? "Abrindo…" : "Planejar a participação"} <ArrowRight size={16} aria-hidden />
        </button>
        <FormResult result={result} />
      </div>
    </form>
  );
}
