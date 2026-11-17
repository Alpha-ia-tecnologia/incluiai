"use client";

import { ArrowRight } from "lucide-react";
import { createDuaPlanning } from "@/actions/dua";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, inputCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

type Option = { value: string; label: string };

export function NewPlanningForm({ classes, reusable, defaultReuse }: { classes: Option[]; reusable: Option[]; defaultReuse?: string }) {
  const { result, pending, submit } = useActionResult<{ id: string }>();

  function create(formData: FormData) {
    submit(() => createDuaPlanning({
      title: String(formData.get("title") ?? ""),
      className: String(formData.get("className") ?? ""),
      reuseFromId: String(formData.get("reuseFromId") ?? "") || undefined,
    }), { goTo: (value) => `/planejamento/${value.id}` });
  }

  return (
    <form action={create} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field id="novo-titulo" label="Título da atividade">
          {(control) => <input {...control} name="title" required minLength={3} maxLength={160} className={inputCls} placeholder="Ex.: Compreensão de uma narrativa" />}
        </Field>
      </div>
      <Field id="novo-turma" label="Turma (opcional)">
        {(control) => (
          <select {...control} name="className" className={inputCls} defaultValue="">
            <option value="">Sem turma definida</option>
            {classes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        )}
      </Field>
      <Field id="novo-reaproveitar" label="Partir de uma atividade existente (opcional)">
        {(control) => (
          <select {...control} name="reuseFromId" className={inputCls} defaultValue={defaultReuse ?? ""}>
            <option value="">Começar do zero</option>
            {reusable.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        )}
      </Field>
      <p className="text-xs leading-relaxed text-ink-soft sm:col-span-2">Ao partir de outra atividade, só o planejamento da turma é copiado, sem dados dos estudantes.</p>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} aria-busy={pending} className={BUTTON_CLS.primary}>
          {pending ? "Criando…" : "Começar o planejamento"} <ArrowRight size={16} aria-hidden />
        </button>
        <FormResult result={result} />
      </div>
    </form>
  );
}
