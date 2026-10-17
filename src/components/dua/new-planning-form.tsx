"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createDuaPlanning, type DuaResult } from "@/actions/dua";
import { Field, ResultMessage, buttonCls, inputCls } from "./dua-ui";

type Option = { value: string; label: string };

// "Planejar atividade com DUA" (RF01, entrada pelo planejamento pedagógico).
// Não exige estudo de caso, diagnóstico, laudo, PAEE nem PEI (CA01).
export function NewPlanningForm({ classes, reusable, defaultReuse }: { classes: Option[]; reusable: Option[]; defaultReuse?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DuaResult<{ id: string }> | null>(null);

  function submit(formData: FormData) {
    start(async () => {
      const outcome = await createDuaPlanning({
        title: String(formData.get("title") ?? ""),
        className: String(formData.get("className") ?? ""),
        reuseFromId: String(formData.get("reuseFromId") ?? "") || undefined,
      });
      setResult(outcome);
      if (outcome.ok) router.push(`/planejamento/${outcome.value.id}`);
    });
  }

  return (
    <form action={submit} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field id="novo-titulo" label="Título da atividade">
          <input id="novo-titulo" name="title" required minLength={3} maxLength={160} className={inputCls} placeholder="Ex.: Compreensão de uma narrativa" />
        </Field>
      </div>
      <Field id="novo-turma" label="Turma (opcional)">
        <select id="novo-turma" name="className" className={inputCls} defaultValue="">
          <option value="">Sem turma definida</option>
          {classes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Field>
      <Field id="novo-reaproveitar" label="Partir de uma atividade existente (opcional)">
        <select id="novo-reaproveitar" name="reuseFromId" className={inputCls} defaultValue={defaultReuse ?? ""}>
          <option value="">Começar do zero</option>
          {reusable.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Field>
      <p className="text-xs leading-relaxed text-ink-soft sm:col-span-2">Ao partir de uma atividade existente, só o planejamento da turma é copiado: apoios individuais, evidências e materiais de estudantes ficam na atividade de origem.</p>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} aria-busy={pending} className={buttonCls}>
          {pending ? "Criando…" : "Começar o planejamento"} <ArrowRight size={16} aria-hidden />
        </button>
        <ResultMessage result={result && !result.ok ? result : null} />
      </div>
    </form>
  );
}
