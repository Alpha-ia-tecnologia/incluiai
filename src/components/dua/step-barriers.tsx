"use client";

import { Plus, Trash2 } from "lucide-react";
import { BARRIER_CATEGORIES, BARRIER_CATEGORY_LABEL, BARRIER_STATUSES, BARRIER_STATUS_LABEL, type BarrierCategory, type BarrierStatus, type DuaBarrier } from "@/lib/dua/domain";
import { Field, OriginBadge, hintCls, inputCls, labelCls, linesToList, listToLines, secondaryCls, textareaCls } from "./dua-ui";
import { newId, type StepProps } from "./step-objective";

// Etapa 2 (3.2): barreiras da TAREFA e do CONTEXTO, nunca do estudante. Prevista,
// observada e hipótese ficam separadas: uma sugestão nunca vira "observada" sozinha.
export function StepBarriers({ content, update, readOnly }: StepProps) {
  const setContext = (patch: Partial<typeof content.context>) => update({ ...content, context: { ...content.context, ...patch } });
  const setBarrier = (id: string, patch: Partial<DuaBarrier>) => update({ ...content, barriers: content.barriers.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const addBarrier = (category: BarrierCategory = "outra") => update({ ...content, barriers: [...content.barriers, { id: newId(), description: category === "outra" ? "" : BARRIER_CATEGORY_LABEL[category], category, status: "prevista", origin: { kind: "professor" } }] });
  const removeBarrier = (id: string) => update({ ...content, barriers: content.barriers.filter((item) => item.id !== id), strategies: content.strategies.map((strategy) => ({ ...strategy, barrierIds: strategy.barrierIds.filter((barrierId) => barrierId !== id) })) });

  return (
    <div className="mt-4 grid min-w-0 gap-6">
      <p className="text-sm leading-relaxed text-ink-soft">Quais barreiras a atividade e o contexto podem apresentar? Registre também o que ainda é incerto, como hipótese a verificar, sem inventar observações.</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id="dua-publico" label="Turma ou grupo (quando definido)">
          <input id="dua-publico" className={inputCls} value={content.context.audience} readOnly={readOnly} maxLength={300} onChange={(event) => setContext({ audience: event.target.value })} placeholder="Ex.: 3º ano B, em duplas" />
        </Field>
        <Field id="dua-recursos" label="Recursos disponíveis" hint="Um por linha.">
          <textarea id="dua-recursos" aria-describedby="dua-recursos-dica" className={`${textareaCls} min-h-16`} value={listToLines(content.context.resources)} readOnly={readOnly} onChange={(event) => setContext({ resources: linesToList(event.target.value) })} placeholder={"Livro da turma\nCartões ilustrados"} />
        </Field>
      </div>
      <Field id="dua-organizacao" label="Organização prevista" hint="Tempo, espaço, agrupamentos e momentos da atividade.">
        <textarea id="dua-organizacao" aria-describedby="dua-organizacao-dica" className={textareaCls} value={content.context.organization} readOnly={readOnly} maxLength={1200} onChange={(event) => setContext({ organization: event.target.value })} />
      </Field>
      <Field id="dua-notas" label="Informações pertinentes do contexto" hint="Sem dados de estudantes: o que for individual entra nos apoios individuais, que têm acesso restrito.">
        <textarea id="dua-notas" aria-describedby="dua-notas-dica" className={`${textareaCls} min-h-16`} value={content.context.notes} readOnly={readOnly} maxLength={2000} onChange={(event) => setContext({ notes: event.target.value })} />
      </Field>

      <fieldset className="min-w-0">
        <legend className={labelCls}>Barreiras da atividade e do contexto <span className="font-normal text-ink-soft">(ao menos uma para validar)</span></legend>
        <p className={hintCls}>Descreva a barreira na tarefa ou no ambiente. Ex.: “instruções longas, apresentadas em uma única etapa”, e não características do estudante.</p>
        {!readOnly ? (
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Começar por uma barreira comum">
            {BARRIER_CATEGORIES.filter((category) => category !== "outra").map((category) => (
              <button key={category} type="button" onClick={() => addBarrier(category)} className="inline-flex min-h-11 items-center rounded-full bg-surface-muted px-4 py-2 text-left text-xs text-ink hover:bg-line">
                <Plus size={14} aria-hidden className="mr-1 shrink-0" /> {BARRIER_CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
        ) : null}
        <ol className="grid gap-4">
          {content.barriers.map((barrier, index) => (
            <li key={barrier.id} className="grid min-w-0 gap-3 rounded-xl bg-surface-muted/60 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">Barreira {index + 1}</span>
                <OriginBadge origin={barrier.origin} />
              </div>
              <Field id={`barreira-${barrier.id}`} label="Descrição">
                <textarea id={`barreira-${barrier.id}`} className={`${textareaCls} min-h-16`} value={barrier.description} readOnly={readOnly} maxLength={600} onChange={(event) => setBarrier(barrier.id, { description: event.target.value })} />
              </Field>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Field id={`categoria-${barrier.id}`} label="Tipo de barreira">
                  <select id={`categoria-${barrier.id}`} className={inputCls} value={barrier.category} disabled={readOnly} onChange={(event) => setBarrier(barrier.id, { category: event.target.value as BarrierCategory })}>
                    {BARRIER_CATEGORIES.map((category) => <option key={category} value={category}>{BARRIER_CATEGORY_LABEL[category]}</option>)}
                  </select>
                </Field>
                <fieldset className="min-w-0">
                  <legend className={labelCls}>Situação</legend>
                  <div className="grid gap-1">
                    {BARRIER_STATUSES.map((status) => (
                      <label key={status} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                        <input type="radio" name={`situacao-${barrier.id}`} value={status} checked={barrier.status === status} disabled={readOnly} onChange={() => setBarrier(barrier.id, { status: status as BarrierStatus })} className="size-4 accent-[var(--brand)]" />
                        {BARRIER_STATUS_LABEL[status]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              {!readOnly ? (
                <button type="button" className={`${secondaryCls} justify-self-start`} onClick={() => removeBarrier(barrier.id)}>
                  <Trash2 size={16} aria-hidden /> Remover a barreira {index + 1}
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {!readOnly ? (
          <button type="button" className={`${secondaryCls} mt-3`} onClick={() => addBarrier("outra")}>
            <Plus size={16} aria-hidden /> Adicionar outra barreira
          </button>
        ) : null}
      </fieldset>
    </div>
  );
}
