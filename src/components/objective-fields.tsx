"use client";

import { useRef, useState } from "react";
import { ChoiceField } from "@/components/choice-field";
import { BnccPicker } from "@/components/bncc-picker";
import { ACTION_SUGGESTIONS, CONDITION_SUGGESTIONS, CRITERION_SUGGESTIONS } from "@/lib/objective";
import { DIMENSIONS } from "@/lib/scale";

const dimensionOptions = Object.entries(DIMENSIONS).map(([value, label]) => ({ value, label }));
const allActions = [...new Set(Object.values(ACTION_SUGGESTIONS).flat())];
const SENTENCE = ["action", "condition", "criterion"] as const;

export function ObjectiveFields({ studentId }: { studentId: string }) {
  const [dimension, setDimension] = useState("comunicacao");
  const box = useRef<HTMLDivElement>(null);
  const actions = ACTION_SUGGESTIONS[dimension] ?? allActions;
  const objectiveText = () => {
    const form = box.current?.closest("form");
    if (!form) return "";
    const data = new FormData(form);
    return SENTENCE.map((field) => String(data.get(field) ?? "")).join(" ");
  };
  return (
    <>
      <ChoiceField name="dimension" label="Área de desenvolvimento *" options={dimensionOptions} defaultValue="comunicacao" required onValueChange={setDimension} />
      <div className="min-w-0 sm:col-span-2">
        <ChoiceField key={dimension} name="action" label="O que o estudante vai fazer? *" options={actions} required placeholder="Escolha uma ação observável" otherPlaceholder="Ex.: identificará seu nome entre 5 opções" />
      </div>
      <div ref={box} className="min-w-0 sm:col-span-2">
        <BnccPicker
          name="bnccCode"
          label="Habilidade da BNCC (opcional)"
          hint="Busque por código ou palavra. As do ano do estudante vêm primeiro."
          studentId={studentId}
          dimension={dimension}
          suggestFrom={objectiveText}
        />
      </div>
      <ChoiceField name="condition" label="Com qual apoio ou condição? *" options={CONDITION_SUGGESTIONS} required otherPlaceholder="Ex.: com apoio de um colega" />
      <ChoiceField name="criterion" label="Como saberemos que conseguiu? *" options={CRITERION_SUGGESTIONS} required otherPlaceholder="Ex.: 3 de 4 tentativas" />
    </>
  );
}
