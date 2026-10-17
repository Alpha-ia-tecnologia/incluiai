"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { startStudentParticipation, type DuaResult } from "@/actions/dua";
import { Field, ResultMessage, buttonCls, inputCls, labelCls } from "../dua-ui";

type PlanningOption = { id: string; label: string };

// "Planejar participação em atividade" (RF01, entrada pelo estudante). Escolher
// uma atividade existente ou começar uma nova leva ao MESMO planejamento, na aba
// de apoios individuais, com o estudante já escolhido: não há plano paralelo.
export function ParticipationStart({ studentId, plannings }: { studentId: string; plannings: PlanningOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"existente" | "nova">(plannings.length ? "existente" : "nova");
  const [result, setResult] = useState<DuaResult<{ planningId: string }> | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const planningId = String(form.get("planningId") ?? "");
    const title = String(form.get("title") ?? "");
    start(async () => {
      const outcome = mode === "existente"
        ? await startStudentParticipation({ studentId, planningId })
        : await startStudentParticipation({ studentId, title });
      setResult(outcome);
      if (outcome.ok) router.push(`/planejamento/${outcome.value.planningId}/apoios?estudante=${encodeURIComponent(studentId)}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-4" aria-busy={pending}>
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
          <select id="participacao-atividade" name="planningId" required defaultValue="" className={inputCls}>
            <option value="" disabled>Escolha a atividade</option>
            {plannings.map((planning) => <option key={planning.id} value={planning.id}>{planning.label}</option>)}
          </select>
        </Field>
      ) : (
        <Field id="participacao-titulo" label="Título da nova atividade" hint="A atividade é planejada para a turma; o apoio de cada estudante fica dentro dela.">
          <input id="participacao-titulo" name="title" required minLength={3} maxLength={160} aria-describedby="participacao-titulo-dica" className={inputCls} placeholder="Ex.: Compreensão de uma narrativa" />
        </Field>
      )}

      <p className="text-xs leading-relaxed text-ink-soft">
        Os dois caminhos usam o mesmo planejamento da atividade, sem plano paralelo. Em seguida, você vai para os apoios individuais da atividade para planejar o apoio deste estudante.
      </p>
      <div>
        <button type="submit" disabled={pending} className={buttonCls}>
          {pending ? "Abrindo…" : "Planejar a participação"} <ArrowRight size={16} aria-hidden />
        </button>
        <ResultMessage result={result && !result.ok ? result : null} />
      </div>
    </form>
  );
}
