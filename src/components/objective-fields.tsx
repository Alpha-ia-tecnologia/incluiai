"use client";

import { useRef, useState } from "react";
import { ChoiceField } from "@/components/choice-field";
import { BnccPicker } from "@/components/bncc-picker";
import { ACTION_SUGGESTIONS } from "@/lib/objective";
import { DIMENSIONS } from "@/lib/scale";

const dimensionOptions = Object.entries(DIMENSIONS).map(([value, label]) => ({ value, label }));
const allActions = [...new Set(Object.values(ACTION_SUGGESTIONS).flat())];

// Área de desenvolvimento + ação observável: as ações sugeridas acompanham a
// área escolhida; em "Outro", mostramos todas as sugestões. A habilidade da
// BNCC vem da base oficial, com as do ano do estudante primeiro.
export function ObjectiveFields({ inputClassName, labelClassName, studentId }: { inputClassName: string; labelClassName: string; studentId: string }) {
  const [dimension, setDimension] = useState("comunicacao");
  const box = useRef<HTMLDivElement>(null);
  const actions = ACTION_SUGGESTIONS[dimension] ?? allActions;
  const style = { inputClassName, labelClassName };
  // A sugestão sai do que já foi escrito no objetivo (ação, condição e critério).
  const objectiveText = () => {
    const form = box.current?.closest("form");
    if (!form) return "";
    const data = new FormData(form);
    return ["action", "condition", "criterion"].map((field) => String(data.get(field) ?? "")).join(" ");
  };
  return (
    <>
      <ChoiceField name="dimension" label="Área de desenvolvimento *" options={dimensionOptions} defaultValue="comunicacao" required onValueChange={setDimension} {...style} />
      <div className="min-w-0 sm:col-span-2">
        <ChoiceField key={dimension} name="action" label="O que o estudante vai fazer? *" options={actions} required placeholder="Escolha uma ação observável" otherPlaceholder="Ex.: identificará seu nome entre 5 opções" {...style} />
      </div>
      <div ref={box} className="min-w-0 sm:col-span-2">
        <BnccPicker
          name="bnccCode"
          label="Habilidade da BNCC (opcional)"
          hint="Busque por código ou palavra, ou peça uma sugestão depois de escrever o objetivo. Aparecem primeiro as do ano do estudante."
          studentId={studentId}
          dimension={dimension}
          suggestFrom={objectiveText}
        />
      </div>
    </>
  );
}
