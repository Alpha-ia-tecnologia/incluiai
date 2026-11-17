"use client";

import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { updateDuaApplication } from "@/actions/dua";
import { EXECUTION_STATES, EXECUTION_STATE_LABEL, type ExecutionState } from "@/lib/dua/domain";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, hintCls, labelCls, inputCls, textareaCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";
import { ParticipantPicker, type StudentOption } from "./participant-picker";

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
  const { result, pending, submit } = useActionResult();
  const [nextState, setNextState] = useState<ExecutionState>(state);
  const [remove, setRemove] = useState<string[]>([]);
  const [add, setAdd] = useState<string[]>([]);
  const prefix = `ap-${applicationId}`;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    submit(() => updateDuaApplication({ planningId, applicationId, revision, state: nextState, notes: String(data.get("notes") ?? ""), addParticipantIds: add, removeParticipantIds: remove }), {
      message: "Aplicação atualizada.",
      onSuccess: () => {
        setAdd([]);
        setRemove([]);
      },
    });
  }

  return (
    <form onSubmit={save} className="grid min-w-0 gap-4">
      <Field id={`${prefix}-situacao`} label="Situação de execução" hint="Concluir não registra presença, não cria atendimento do AEE e não é conclusão sobre a aprendizagem. Com a aplicação cancelada, não há evidência a registrar.">
        {(control) => (
          <select {...control} value={nextState} onChange={(event) => setNextState(event.target.value as ExecutionState)} className={inputCls}>
            {EXECUTION_STATES.map((item) => <option key={item} value={item}>{EXECUTION_STATE_LABEL[item]}</option>)}
          </select>
        )}
      </Field>
      <Field id={`${prefix}-notas`} label="Observações da aplicação">
        {(control) => <textarea {...control} name="notes" defaultValue={notes} maxLength={2000} className={textareaCls} />}
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
        <button type="submit" disabled={pending} aria-busy={pending} className={BUTTON_CLS.quiet}>
          <Save size={16} aria-hidden /> {pending ? "Salvando…" : "Salvar a aplicação"}
        </button>
        <FormResult result={result} />
      </div>
    </form>
  );
}
