"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { BookOpen, LayoutGrid, ListChecks, ListOrdered, MessagesSquare, Sparkles, Thermometer, type LucideIcon } from "lucide-react";
import { generateMaterial, type MaterialActionState } from "@/actions/materials";
import { ChoiceField } from "@/components/choice-field";
import { PendingButton } from "@/components/pending-button";
import { MATERIAL_CONTEXTS, MATERIAL_KINDS, MATERIAL_TOPICS, type MaterialKind } from "@/lib/material-content";
import { labelCls, inputCls, linkCls, primaryButtonCls } from "@/components/form-styles";

// Formulário "Criar um material": tipo, situação, objetivo do plano, contexto e
// imagens. A geração (IA ou regras) e as conferências ficam no servidor, que ao
// terminar leva à página do material novo; o estado só volta com erro.

const ICONS: Record<MaterialKind, LucideIcon> = {
  rotina_visual: ListOrdered,
  sequencia_tarefa: ListChecks,
  historia_social: BookOpen,
  prancha_caa: MessagesSquare,
  quadro_escolhas: LayoutGrid,
  regulacao: Thermometer,
};


export function MaterialForm({ studentId, objectives, defaultContext, aiOn, imagesOn }: {
  studentId: string;
  objectives: { id: string; description: string }[];
  defaultContext: string;
  aiOn: boolean;
  imagesOn: boolean;
}) {
  const [state, action] = useActionState<MaterialActionState, FormData>(generateMaterial.bind(null, studentId), { status: "idle" });
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== "idle") resultRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="grid min-w-0 gap-6">
      <fieldset className="min-w-0">
        <legend className={labelCls}>Que material você quer criar?</legend>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MATERIAL_KINDS.map((item, index) => {
            const Icon = ICONS[item.kind];
            return (
              <label key={item.kind} className="flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper p-3 transition-colors hover:border-brand/40 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand">
                <input type="radio" name="kind" value={item.kind} defaultChecked={index === 0} required className="sr-only" />
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong"><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{item.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <ChoiceField
          name="topic"
          label="Para qual situação ou conteúdo?"
          options={MATERIAL_TOPICS}
          placeholder="Escolha uma situação"
          otherLabel="Outra situação ou conteúdo"
          otherPlaceholder="Ex.: visita à biblioteca, frações com pizza"
          hint="Quanto mais específica, mais o material serve ao estudante."
          labelClassName={labelCls}
          inputClassName={inputCls}
        />
        <div className="min-w-0">
          <label htmlFor="objectiveId" className={labelCls}>Objetivo do plano (opcional)</label>
          <select id="objectiveId" name="objectiveId" defaultValue="" className={inputCls}>
            <option value="">Sem objetivo específico</option>
            {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.description}</option>)}
          </select>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">As atividades do material passam a apoiar este objetivo.</p>
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className={labelCls}>Onde o material será mais usado?</legend>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_CONTEXTS.map((context) => (
            <label key={context.value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm text-ink has-[:checked]:border-brand has-[:checked]:bg-brand-soft/50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand">
              <input type="radio" name="context" value={context.value} defaultChecked={context.value === defaultContext} className="size-4 accent-[var(--brand)]" />
              {context.label}
            </label>
          ))}
        </div>
      </fieldset>

      {imagesOn ? (
        <label className="flex min-h-11 items-start gap-3 rounded-2xl bg-surface-muted/60 p-3 text-sm text-ink">
          <input type="checkbox" name="gerarImagens" defaultChecked className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
          <span>
            <span className="font-medium">Desenhar um pictograma para cada cartão</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">Pela OpenAI, só com a descrição de cada cartão: nenhum nome ou dado pessoal. Leva de 1 a 3 minutos.</span>
          </span>
        </label>
      ) : (
        <p className="rounded-2xl bg-surface-muted/60 p-3 text-xs leading-relaxed text-ink-soft">As imagens dos cartões estão desligadas nesta instalação (falta a chave OPENAI_API_KEY). O material sai com a descrição de cada pictograma.</p>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <PendingButton
          className={`${primaryButtonCls} shadow-e1`}
          pendingText={aiOn ? "Os agentes de IA estão criando o material e as atividades." : "Preparando o material…"}
          wait="material"
        >
          <Sparkles size={16} aria-hidden /> Criar material
        </PendingButton>
        <p className="min-w-0 basis-full text-xs leading-relaxed text-ink-soft sm:basis-auto sm:flex-1">
          {aiOn
            ? "Os agentes de IA usam o perfil (Como aprende e a parte pedagógica do estudo de caso), sem nomes nem dados pessoais. O material fica como sugestão até você aprovar."
            : "A IA está desligada nesta instalação: o material sai pelas regras da plataforma, a partir do perfil. Fica como sugestão até você aprovar."}
        </p>
      </div>

      <div ref={resultRef} tabIndex={-1} className="outline-none" aria-live="polite">
        {state.status === "ok" ? (
          <p role="status" className="rounded-xl bg-green-soft px-3 py-2 text-sm text-green">
            {state.message} {state.materialId ? <Link href={`/estudantes/${studentId}/materiais/${state.materialId}`} className={linkCls}>Abrir o material</Link> : null}
          </p>
        ) : state.status === "erro" ? (
          <p role="alert" className="rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
