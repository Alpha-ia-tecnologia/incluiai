"use client";

import { useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import { setDuaCollaborators } from "@/actions/dua";
import { FormResult } from "@/components/form-kit";
import { BUTTON_CLS, hintCls, labelCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

export function CollaboratorsForm({ planningId, options, selected }: { planningId: string; options: { id: string; name: string; roleLabel: string }[]; selected: string[] }) {
  const { result, pending, submit } = useActionResult();
  const [chosen, setChosen] = useState<string[]>(selected);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(() => setDuaCollaborators({ planningId, userIds: chosen }), { message: chosen.length ? "Colaboradores salvos." : "O planejamento ficou sem colaboradores." });
  }

  return (
    <form onSubmit={save} className="grid min-w-0 gap-4">
      <fieldset className="min-w-0">
        <legend className={labelCls}>Quem colabora neste planejamento</legend>
        <p className={hintCls}>Até 30 pessoas. Desmarque para retirar a colaboração.</p>
        {options.length ? (
          <ul className="grid min-w-0 gap-1 sm:grid-cols-2">
            {options.map((option) => (
              <li key={option.id} className="min-w-0">
                <label className="flex min-h-11 min-w-0 items-start gap-2 py-1 text-sm text-ink">
                  <input type="checkbox" checked={chosen.includes(option.id)} onChange={(event) => setChosen((list) => (event.target.checked ? [...list, option.id] : list.filter((item) => item !== option.id)))} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                  <span className="min-w-0 break-words">{option.name} <span className="text-ink-soft">· {option.roleLabel}</span></span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-soft">Não há outros profissionais da escola que planejam atividades.</p>}
      </fieldset>
      <div>
        <button type="submit" disabled={pending || !options.length} aria-busy={pending} className={BUTTON_CLS.quiet}>
          <Users size={16} aria-hidden /> {pending ? "Salvando…" : "Salvar colaboradores"}
        </button>
        <FormResult result={result} />
      </div>
    </form>
  );
}
