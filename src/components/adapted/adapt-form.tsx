"use client";

import { useActionState, useId } from "react";
import { FileUp, Wand2 } from "lucide-react";
import type { AdaptState } from "@/actions/adapted-tasks";
import { ADAPT_OPTIONS } from "@/lib/task-adaptation";
import { choiceCls, hintCls, inputCls, labelCls, primaryButtonCls, textareaCls } from "@/components/form-styles";

type Action = (previous: AdaptState, formData: FormData) => Promise<AdaptState>;

// Enviar a atividade da turma (foto, PDF ou texto colado). Com arquivo, o
// primeiro envio só transcreve; o professor confere o texto e então adapta.
export function AdaptForm({ action, canRead, aiOn, objectives, showOptions = true, adaptLabel = "Adaptar" }: {
  action: Action;
  canRead: boolean;
  aiOn: boolean;
  objectives?: { id: string; description: string }[];
  showOptions?: boolean;
  adaptLabel?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const id = useId();
  const checking = state.step === "conferir";
  return (
    <form action={submit} className="grid max-w-3xl gap-5">
      <fieldset className="grid gap-2">
        <legend className={labelCls}>É uma atividade ou uma prova?</legend>
        <div className="flex flex-wrap gap-2">
          {[["atividade", "Atividade"], ["prova", "Prova"]].map(([value, label]) => (
            <label key={value} className={`${choiceCls} min-w-36`}>
              <input type="radio" name="kind" value={value} defaultChecked={value === (state.kind ?? "atividade")} className="size-5 accent-[var(--brand)]" /> {label}
            </label>
          ))}
        </div>
        <p className={hintCls}>Na prova, a adaptação muda a forma das questões, não o que elas avaliam.</p>
      </fieldset>
      <div>
        <label htmlFor={`${id}-title`} className={labelCls}>Título</label>
        <input id={`${id}-title`} name="title" defaultValue={state.title} maxLength={160} placeholder="Ex.: Prova de Ciências, os animais" className={inputCls} />
      </div>
      {checking ? (
        <div>
          <label htmlFor={`${id}-text`} className={labelCls}>Confira o texto lido do arquivo</label>
          <p id={`${id}-text-hint`} className={hintCls}>Corrija o que a leitura errou. Nomes de pessoas aparecem como [nome].</p>
          <textarea id={`${id}-text`} name="text" required rows={14} defaultValue={state.text} aria-describedby={`${id}-text-hint`} className={textareaCls} />
          <input type="hidden" name="intent" value="adaptar" />
        </div>
      ) : (
        <>
          {canRead ? (
            <div>
              <label htmlFor={`${id}-file`} className={labelCls}>Foto ou PDF da atividade</label>
              <p id={`${id}-file-hint`} className={hintCls}>Até 10 MB. Antes de fotografar, cubra os nomes dos alunos escritos na folha. O arquivo só é usado para ler o texto e não fica guardado.</p>
              <input id={`${id}-file`} name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" aria-describedby={`${id}-file-hint`} className={`${inputCls} py-2 file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-medium file:text-brand-strong`} />
            </div>
          ) : (
            <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-soft">Ler foto ou PDF usa IA, que não está disponível aqui {aiOn ? "" : "(IA desligada ou sem a autorização da família)"}. Cole o texto da atividade abaixo.</p>
          )}
          <div>
            <label htmlFor={`${id}-text`} className={labelCls}>{canRead ? "Ou cole o texto da atividade" : "Texto da atividade"}</label>
            <textarea id={`${id}-text`} name="text" rows={10} placeholder={"1) Leia o texto e circule os animais.\n2) Ligue cada animal ao lugar onde vive.\n3) Qual é o alimento da vaca?\na) capim\nb) carne"} className={textareaCls} />
          </div>
        </>
      )}
      {showOptions ? (
        <fieldset className="grid gap-2">
          <legend className={labelCls}>O que adaptar</legend>
          {!aiOn ? <p className={hintCls}>Sem IA, a plataforma organiza a apresentação; linguagem simples e resposta por escolha precisam da IA.</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {ADAPT_OPTIONS.map((option) => (
              <label key={option.key} className={choiceCls}>
                <input type="checkbox" name="options" value={option.key} defaultChecked={state.options ? state.options.includes(option.key) : option.key !== "menos_itens" && option.key !== "letra_ampliada"} className="size-5 shrink-0 accent-[var(--brand)]" />
                <span>{option.label}{option.aiOnly && !aiOn ? " (com IA)" : ""}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {objectives?.length ? (
        <div>
          <label htmlFor={`${id}-objective`} className={labelCls}>Objetivo do plano (opcional)</label>
          <select id={`${id}-objective`} name="objectiveId" defaultValue={state.objectiveId ?? ""} className={inputCls}>
            <option value="">Sem objetivo ligado</option>
            {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.description.slice(0, 120)}</option>)}
          </select>
        </div>
      ) : null}
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonCls}>
          {checking ? <Wand2 size={16} aria-hidden /> : <FileUp size={16} aria-hidden />}
          {pending ? (checking ? "Adaptando…" : "Enviando…") : checking ? adaptLabel : canRead ? "Ler o arquivo ou adaptar o texto" : adaptLabel}
        </button>
      </div>
    </form>
  );
}
