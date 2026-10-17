"use client";

import Link from "next/link";
import { Plus, Trash2, Users } from "lucide-react";
import { DUA_PRINCIPLES, PRINCIPLE_EXAMPLES, PRINCIPLE_LABEL, PRINCIPLE_QUESTION, emptyStrategyDetails, type DuaPrinciple, type DuaStrategy } from "@/lib/dua/domain";
import type { PlanningAccess } from "@/lib/dua/access";
import type { SuggestionView } from "@/lib/dua/suggestions";
import { Field, OriginBadge, hintCls, inputCls, labelCls, linesToList, linkCls, listToLines, secondaryCls, textareaCls } from "./dua-ui";
import { newId, type StepProps } from "./step-objective";
import { SuggestionReview } from "./suggestion-review";

// Etapa 3 (3.3, RF03): cada opção diz a que barreira responde, o princípio, os
// recursos, o contexto de uso e o critério que ajuda a observar. Planejamento
// intencional: não é preciso cobrir todos os formatos nem todas as diretrizes.
export function StepOptions({ content, update, readOnly, planningId, access, suggestions, aiOn, flush, supportsCount }: StepProps & { planningId: string; access: PlanningAccess; suggestions: SuggestionView[]; aiOn: boolean; flush: () => Promise<void>; supportsCount: number }) {
  const setStrategy = (id: string, patch: Partial<DuaStrategy>) => update({ ...content, strategies: content.strategies.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const addStrategy = (principle?: DuaPrinciple, description = "") => update({
    ...content,
    strategies: [...content.strategies, { id: newId(), description, principles: principle ? [principle] : [], barrierIds: [], criterionIds: [], resources: [], context: "", details: emptyStrategyDetails(), origin: { kind: "professor" } }],
  });
  const toggle = (list: string[], value: string, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((item) => item !== value));

  return (
    <div className="mt-4 grid min-w-0 gap-6">
      <p className="text-sm leading-relaxed text-ink-soft">Quais opções de acesso e participação serão oferecidas à turma? Relacione cada opção à barreira que ela reduz e ao critério que ajuda a observar.</p>

      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        {DUA_PRINCIPLES.map((principle) => (
          <div key={principle} className="min-w-0 rounded-xl bg-surface-muted/60 p-3">
            <p className="text-sm font-medium text-ink">{PRINCIPLE_LABEL[principle]}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{PRINCIPLE_QUESTION[principle]}</p>
            {!readOnly ? (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Exemplos de ${PRINCIPLE_LABEL[principle]}`}>
                {PRINCIPLE_EXAMPLES[principle].map((example) => (
                  <button key={example} type="button" onClick={() => addStrategy(principle, example)} className="inline-flex min-h-11 items-center rounded-full bg-paper-raised px-3 py-1.5 text-xs text-ink hover:bg-line">
                    <Plus size={12} aria-hidden className="mr-1" /> {example}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-soft">Exemplos: {PRINCIPLE_EXAMPLES[principle].join(", ")}.</p>
            )}
          </div>
        ))}
      </div>

      <section aria-labelledby="opcoes-titulo" className="min-w-0">
        <h3 id="opcoes-titulo" className={labelCls}>Opções planejadas <span className="font-normal text-ink-soft">(ao menos uma para validar)</span></h3>
        {content.strategies.length === 0 ? <p className="mb-3 text-sm text-ink-soft">Nenhuma opção ainda. Comece por um exemplo acima, escreva a sua ou peça sugestões para revisão.</p> : null}
        <ol className="grid gap-4">
          {content.strategies.map((strategy, index) => (
            <li key={strategy.id} className="grid min-w-0 gap-4 rounded-xl border border-line bg-paper-raised p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">Opção {index + 1}</span>
                <OriginBadge origin={strategy.origin} />
              </div>
              <Field id={`opcao-${strategy.id}`} label="Descrição da opção oferecida">
                <textarea id={`opcao-${strategy.id}`} className={`${textareaCls} min-h-16`} value={strategy.description} readOnly={readOnly} maxLength={1200} onChange={(event) => setStrategy(strategy.id, { description: event.target.value })} />
              </Field>
              <fieldset className="min-w-0">
                <legend className={labelCls}>Princípio(s) relacionado(s)</legend>
                <div className="flex flex-wrap gap-x-5">
                  {DUA_PRINCIPLES.map((principle) => (
                    <label key={principle} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                      <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={strategy.principles.includes(principle)} disabled={readOnly} onChange={(event) => setStrategy(strategy.id, { principles: toggle(strategy.principles, principle, event.target.checked) as DuaPrinciple[] })} />
                      {PRINCIPLE_LABEL[principle]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <fieldset className="min-w-0">
                  <legend className={labelCls}>Barreira que pretende reduzir</legend>
                  {content.barriers.length === 0 ? <p className={hintCls}>Registre as barreiras na etapa 2 para relacioná-las aqui.</p> : null}
                  {content.barriers.map((barrier, barrierIndex) => (
                    <label key={barrier.id} className="flex min-h-11 items-start gap-2 py-1 text-sm text-ink">
                      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" checked={strategy.barrierIds.includes(barrier.id)} disabled={readOnly} onChange={(event) => setStrategy(strategy.id, { barrierIds: toggle(strategy.barrierIds, barrier.id, event.target.checked) })} />
                      <span className="min-w-0">{barrierIndex + 1}. {barrier.description || "Barreira sem descrição"}</span>
                    </label>
                  ))}
                </fieldset>
                <fieldset className="min-w-0">
                  <legend className={labelCls}>Critério de observação relacionado</legend>
                  {content.criteria.length === 0 ? <p className={hintCls}>Os critérios são definidos na etapa 1.</p> : null}
                  {content.criteria.map((criterion, criterionIndex) => (
                    <label key={criterion.id} className="flex min-h-11 items-start gap-2 py-1 text-sm text-ink">
                      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" checked={strategy.criterionIds.includes(criterion.id)} disabled={readOnly} onChange={(event) => setStrategy(strategy.id, { criterionIds: toggle(strategy.criterionIds, criterion.id, event.target.checked) })} />
                      <span className="min-w-0">{criterionIndex + 1}. {criterion.description || "Critério sem descrição"}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field id={`recursos-${strategy.id}`} label="Recursos necessários" hint="Um por linha.">
                  <textarea id={`recursos-${strategy.id}`} aria-describedby={`recursos-${strategy.id}-dica`} className={`${textareaCls} min-h-16`} value={listToLines(strategy.resources)} readOnly={readOnly} onChange={(event) => setStrategy(strategy.id, { resources: linesToList(event.target.value) })} />
                </Field>
                <Field id={`contexto-${strategy.id}`} label="Contexto de utilização">
                  <input id={`contexto-${strategy.id}`} className={inputCls} value={strategy.context} readOnly={readOnly} maxLength={300} onChange={(event) => setStrategy(strategy.id, { context: event.target.value })} placeholder="Ex.: na leitura coletiva, no início da aula" />
                </Field>
              </div>
              <details className="min-w-0 rounded-xl bg-surface-muted/60 p-3" open={Boolean(strategy.details.what || strategy.details.purpose || strategy.details.when || strategy.details.how)}>
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand-strong">Detalhar a opção (quais, para quê, quando e como)</summary>
                <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2">
                  {([["what", "Quais (materiais, imagens, objetos)"], ["purpose", "Para qual finalidade"], ["when", "Em que momento"], ["how", "Como será usada"]] as const).map(([key, label]) => (
                    <Field key={key} id={`detalhe-${key}-${strategy.id}`} label={label}>
                      <textarea id={`detalhe-${key}-${strategy.id}`} className={`${textareaCls} min-h-16`} value={strategy.details[key]} readOnly={readOnly} maxLength={600} onChange={(event) => setStrategy(strategy.id, { details: { ...strategy.details, [key]: event.target.value } })} />
                    </Field>
                  ))}
                </div>
              </details>
              {!readOnly ? (
                <button type="button" className={`${secondaryCls} justify-self-start`} onClick={() => update({ ...content, strategies: content.strategies.filter((item) => item.id !== strategy.id) })}>
                  <Trash2 size={16} aria-hidden /> Remover a opção {index + 1}
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {!readOnly ? (
          <button type="button" className={`${secondaryCls} mt-3`} onClick={() => addStrategy()}>
            <Plus size={16} aria-hidden /> Escrever uma nova opção
          </button>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sky-soft/60 p-4">
        <p className="flex max-w-xl items-start gap-2 text-sm leading-relaxed text-ink">
          <Users size={16} aria-hidden className="mt-0.5 shrink-0 text-sky-ink" />
          <span>Apoios individuais ficam separados do planejamento da turma, com acesso restrito a quem acompanha cada estudante. {supportsCount ? `Há ${supportsCount} apoio(s) que você pode ver.` : ""}</span>
        </p>
        <Link href={`/planejamento/${planningId}/apoios`} className={linkCls}>Abrir os apoios individuais</Link>
      </div>

      <SuggestionReview planningId={planningId} purpose="opcoes" suggestions={suggestions.filter((item) => item.purpose === "opcoes")} canRequest={access.edit && !readOnly} canDecide={access.edit && !readOnly} aiOn={aiOn} beforeChange={flush} />
    </div>
  );
}
