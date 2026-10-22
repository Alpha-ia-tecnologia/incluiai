"use client";

import { Plus, Trash2 } from "lucide-react";
import type { DuaContent } from "@/lib/dua/domain";
import { Field, hintCls, inputCls, labelCls, secondaryCls, textareaCls } from "./dua-ui";
import { BnccPicker } from "@/components/bncc-picker";

export type StepProps = { content: DuaContent; update: (next: DuaContent) => void; readOnly: boolean };

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Etapa 1 (3.1): o objetivo vem antes de qualquer recurso. Objetivo de aprendizagem
// ≠ meio de acesso ≠ forma de resposta ≠ apoio — a tela ajuda a separar.
export function StepObjective({ content, update, readOnly }: StepProps) {
  const set = (patch: Partial<DuaContent>) => update({ ...content, ...patch });
  return (
    <div className="mt-4 grid min-w-0 gap-6">
      <p className="text-sm leading-relaxed text-ink-soft">O que os estudantes precisam aprender, e o que vai permitir ver essa aprendizagem? Recursos e formas de participação vêm depois, na etapa 3.</p>
      <Field id="dua-titulo" label="Título da atividade" required>
        <input id="dua-titulo" className={inputCls} value={content.title} readOnly={readOnly} onChange={(event) => set({ title: event.target.value })} maxLength={160} />
      </Field>
      <Field id="dua-objetivo" label="O que os estudantes precisam aprender?" required hint="A aprendizagem pretendida: o que se quer desenvolver ou compreender. Não descreva aqui como a informação será apresentada nem como o estudante vai responder.">
        <textarea id="dua-objetivo" aria-describedby="dua-objetivo-dica" className={textareaCls} value={content.objective.learning} readOnly={readOnly} onChange={(event) => set({ objective: { ...content.objective, learning: event.target.value } })} maxLength={2000} placeholder="Ex.: identificar dois personagens principais e ordenar três acontecimentos de uma história." />
      </Field>
      <BnccPicker
        multiple
        label="Habilidades da BNCC (quando houver)"
        hint="Busque por código ou palavra, ou peça uma sugestão pelo que os estudantes precisam aprender."
        value={content.objective.bnccCodes}
        onChange={(bnccCodes) => set({ objective: { ...content.objective, bnccCodes } })}
        readOnly={readOnly}
        suggestFrom={() => content.objective.learning}
      />
      <Field id="dua-curriculo" label="Outra referência curricular (quando houver)" hint="Ex.: a habilidade do currículo municipal.">
        <input id="dua-curriculo" aria-describedby="dua-curriculo-dica" className={inputCls} value={content.objective.curriculum} readOnly={readOnly} onChange={(event) => set({ objective: { ...content.objective, curriculum: event.target.value } })} maxLength={300} />
      </Field>

      <fieldset className="min-w-0">
        <legend className={labelCls}>Critérios observáveis <span className="font-normal text-ink-soft">(ao menos um para validar)</span></legend>
        <p className={hintCls}>O que você vai poder ver ou ouvir quando a aprendizagem acontecer. Mudar a forma de resposta não pode impedir de observar o critério.</p>
        {content.criteria.length === 0 ? <p className="mb-3 text-sm text-ink-soft">Nenhum critério ainda.</p> : null}
        <ol className="grid gap-3">
          {content.criteria.map((criterion, index) => (
            <li key={criterion.id} className="flex min-w-0 flex-wrap items-start gap-2 rounded-xl bg-surface-muted/60 p-3">
              <label htmlFor={`criterio-${criterion.id}`} className="w-full text-sm font-medium text-ink">Critério {index + 1}</label>
              <textarea
                id={`criterio-${criterion.id}`}
                className={`${textareaCls} min-h-16 flex-1`}
                value={criterion.description}
                readOnly={readOnly}
                maxLength={600}
                placeholder="Ex.: diz ou aponta os dois personagens principais."
                onChange={(event) => set({ criteria: content.criteria.map((item) => (item.id === criterion.id ? { ...item, description: event.target.value } : item)) })}
              />
              {!readOnly ? (
                <button type="button" className={secondaryCls} onClick={() => set({ criteria: content.criteria.filter((item) => item.id !== criterion.id) })}>
                  <Trash2 size={16} aria-hidden /> Remover o critério {index + 1}
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {!readOnly ? (
          <button type="button" className={`${secondaryCls} mt-3`} onClick={() => set({ criteria: [...content.criteria, { id: newId(), description: "" }] })}>
            <Plus size={16} aria-hidden /> Adicionar critério observável
          </button>
        ) : null}
      </fieldset>
    </div>
  );
}
