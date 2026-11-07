"use client";

import { startTransition, useActionState, useMemo, type FormEvent, type ReactNode } from "react";
import { LoaderCircle, Sprout } from "lucide-react";
import { choiceCls, inputCls, labelCls, primaryButtonCls, textareaCls } from "@/components/form-styles";
import { SUPPORT_LEVELS } from "@/lib/scale";
import { suggestedRecord, type GameResult } from "@/lib/games/games-core";
import { recordGameSession } from "@/actions/games";

// Registro da aula no fim de um jogo, com a sugestão vinda das dicas e das
// tentativas. Serve aos jogos em tela cheia e aos jogos de fotografias.
export function GameRecordForm({ student, result, note, actions }: {
  student: { id: string; firstName: string };
  result: GameResult;
  note: string;
  actions: ReactNode;
}) {
  const record = useMemo(() => recordGameSession.bind(null, student.id), [student.id]);
  const [state, formAction, pending] = useActionState(record, {});
  const suggestion = suggestedRecord(result);
  // Envio pelo onSubmit: com action={...}, o React limparia o formulário depois de salvar.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.saved) {
    return (
      <section className="grid justify-items-center gap-4 rounded-2xl bg-green-soft p-5 text-center">
        <p role="status" className="flex items-center gap-2 text-base font-medium text-green"><Sprout size={18} aria-hidden className="sprout-mark" /> Aula registrada. Aparece em Registrar aula e na Evolução de {student.firstName}.</p>
        {actions}
      </section>
    );
  }
  return (
    <form onSubmit={submit} aria-busy={pending} className="ui-card grid gap-5 text-left">
      <h2 className="text-base font-semibold text-ink">Registrar a aula de {student.firstName}</h2>
      <fieldset>
        <legend className={labelCls}>Participação</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {([["total", "De toda a atividade"], ["parcial", "De parte"], ["recusou", "Recusou"]] as const).map(([value, label]) => (
            <label key={value} className={choiceCls}><input type="radio" name="participation" value={value} defaultChecked={value === suggestion.participation} required className="size-4 shrink-0 accent-[var(--brand)]" />{label}</label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="jogo-apoio" className={labelCls}>Apoio necessário</label>
        <select id="jogo-apoio" name="supportLevel" defaultValue={suggestion.supportLevel} className={inputCls}>
          {SUPPORT_LEVELS.map((item) => <option key={item.level} value={item.level}>{item.description}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className={labelCls}>Realizou o que era esperado?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {([["sim", "Sim"], ["parcial", "Uma parte"], ["nao", "Ainda não"]] as const).map(([value, label]) => (
            <label key={value} className={choiceCls}><input type="radio" name="criterionMet" value={value} defaultChecked={value === suggestion.criterionMet} required className="size-4 shrink-0 accent-[var(--brand)]" />{label}</label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="jogo-nota" className={labelCls}>O que aconteceu</label>
        <textarea id="jogo-nota" name="nota" rows={3} maxLength={500} defaultValue={note} className={textareaCls} />
      </div>
      {state.error && !pending ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="submit" disabled={pending} className={`${primaryButtonCls} disabled:cursor-wait`}>
          {pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {pending ? "Registrando…" : "Registrar a aula"}
        </button>
        {actions}
      </div>
    </form>
  );
}
