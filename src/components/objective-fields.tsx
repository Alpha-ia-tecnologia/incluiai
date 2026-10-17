"use client";

import { useState } from "react";
import { ChoiceField } from "@/components/choice-field";
import { ACTION_SUGGESTIONS } from "@/lib/objective";
import { DIMENSIONS } from "@/lib/scale";

const dimensionOptions = Object.entries(DIMENSIONS).map(([value, label]) => ({ value, label }));
const allActions = [...new Set(Object.values(ACTION_SUGGESTIONS).flat())];

// Área de desenvolvimento + ação observável: as ações sugeridas acompanham a
// área escolhida; em "Outro", mostramos todas as sugestões.
export function ObjectiveFields({ inputClassName, labelClassName }: { inputClassName: string; labelClassName: string }) {
  const [dimension, setDimension] = useState("comunicacao");
  const actions = ACTION_SUGGESTIONS[dimension] ?? allActions;
  const style = { inputClassName, labelClassName };
  return (
    <>
      <ChoiceField name="dimension" label="Área de desenvolvimento *" options={dimensionOptions} defaultValue="comunicacao" required onValueChange={setDimension} {...style} />
      <div className="min-w-0">
        <label htmlFor="bnccCode" className={labelClassName}>Habilidade da BNCC (opcional)</label>
        <input id="bnccCode" name="bnccCode" placeholder="Ex.: EF01LP04" className={inputClassName} />
      </div>
      <div className="min-w-0 sm:col-span-2">
        <ChoiceField key={dimension} name="action" label="O que o estudante vai fazer? *" options={actions} required placeholder="Escolha uma ação observável" otherPlaceholder="Ex.: identificará seu nome entre 5 opções" {...style} />
      </div>
    </>
  );
}
