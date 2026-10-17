"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { updateDuaApplication } from "@/actions/dua";
import { EXECUTION_STATES, EXECUTION_STATE_LABEL, type ExecutionState } from "@/lib/dua/domain";
import { Field, ResultMessage, hintCls, labelCls, inputCls, secondaryCls, textareaCls } from "../dua-ui";
import { ParticipantPicker, type StudentOption } from "./participant-picker";

type Feedback = { ok: boolean; message?: string; problems?: { field: string; message: string }[] } | null;

// Situação de execução e participantes de uma aplicação. A situação é separada
// da revisão pedagógica; quem está fora do seu acesso não aparece e não é retirado.
export function ApplicationManager({ planningId, applicationId, revision, state, notes, className, participants, students }: {
  planningId: string;
  applicationId: string;
  revision: number;
  state: ExecutionState;
  notes: string;
  className: string;
  participants: { id: string; name: string }[];
  students: StudentOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [nextState, setNextState] = useState<ExecutionState>(state);
  const [remove, setRemove] = useState<string[]>([]);
  const [add, setAdd] = useState<string[]>([]);
  const prefix = `ap-${applicationId}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      // As observações seguem junto: a ação grava o texto inteiro de novo.
      const outcome = await updateDuaApplication({ planningId, applicationId, revision, state: nextState, notes: String(data.get("notes") ?? ""), addParticipantIds: add, removeParticipantIds: remove });
      if (!outcome.ok) {
        setFeedback(outcome);
        return;
      }
      setFeedback({ ok: true, message: "Aplicação atualizada." });
      setAdd([]);
      setRemove([]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-4">
      <Field id={`${prefix}-situacao`} label="Situação de execução" hint="Concluir não registra presença, não cria atendimento do AEE e não é conclusão sobre a aprendizagem. Com a aplicação cancelada, não há evidência a registrar.">
        <select id={`${prefix}-situacao`} value={nextState} onChange={(event) => setNextState(event.target.value as ExecutionState)} className={inputCls} aria-describedby={`${prefix}-situacao-dica`}>
          {EXECUTION_STATES.map((item) => <option key={item} value={item}>{EXECUTION_STATE_LABEL[item]}</option>)}
        </select>
      </Field>
      <Field id={`${prefix}-notas`} label="Observações da aplicação">
        <textarea id={`${prefix}-notas`} name="notes" defaultValue={notes} maxLength={2000} className={textareaCls} />
      </Field>
      {participants.length ? (
        <fieldset className="min-w-0">
          <legend className={labelCls}>Retirar da aplicação</legend>
          <p className={hintCls}>Retirar não apaga a evidência já registrada: ela continua na memória educacional do estudante.</p>
          <ul className="grid min-w-0 gap-1 sm:grid-cols-2">
            {participants.map((person) => (
              <li key={person.id} className="min-w-0">
                <label className="flex min-h-11 min-w-0 items-start gap-2 py-1 text-sm text-ink">
                  <input type="checkbox" checked={remove.includes(person.id)} onChange={(event) => setRemove((list) => (event.target.checked ? [...list, person.id] : list.filter((item) => item !== person.id)))} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                  <span className="min-w-0 break-words">{person.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
      <ParticipantPicker
        idPrefix={`${prefix}-incluir`}
        legend="Incluir participantes"
        students={students}
        className={className}
        selected={add}
        onChange={setAdd}
        exclude={participants.map((person) => person.id)}
      />
      <div>
        <button type="submit" disabled={pending} aria-busy={pending} className={secondaryCls}>
          <Save size={16} aria-hidden /> {pending ? "Salvando…" : "Salvar a aplicação"}
        </button>
        <ResultMessage result={feedback} />
      </div>
    </form>
  );
}
