"use client";

import { useId, useState, type FormEvent } from "react";
import { EyeOff, FileUp, ShieldCheck, Wand2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { TaskText } from "@/lib/adapted-tasks";
import { ADAPT_OPTIONS } from "@/lib/adapted-tasks-core";
import { UPLOAD_LIMIT_BYTES, megabytes } from "@/lib/uploads";
import { Field, FormResult } from "@/components/form-kit";
import { choiceCls, hintCls, inputCls, labelCls, BUTTON_CLS, textareaCls } from "@/components/form-styles";
import { Assurances } from "@/components/explain";
import { useActionResult } from "@/components/use-action-result";

export function AdaptForm({ action, canRead, aiOn, objectives, showOptions = true, adaptLabel = "Adaptar" }: {
  action: (formData: FormData) => Promise<ActionResult<TaskText>>;
  canRead: boolean;
  aiOn: boolean;
  objectives?: { id: string; description: string }[];
  showOptions?: boolean;
  adaptLabel?: string;
}) {
  const { result, pending, submit } = useActionResult<TaskText>();
  const [read, setRead] = useState<TaskText | null>(null);
  const id = useId();

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    submit(() => action(data), { onSuccess: setRead });
  }

  return (
    <form onSubmit={send} className="grid max-w-3xl gap-5" aria-busy={pending}>
      <fieldset className="grid gap-2">
        <legend className={labelCls}>É uma atividade ou uma prova?</legend>
        <div className="flex flex-wrap gap-2">
          {[["atividade", "Atividade"], ["prova", "Prova"]].map(([value, label]) => (
            <label key={value} className={`${choiceCls} min-w-36`}>
              <input type="radio" name="kind" value={value} defaultChecked={value === "atividade"} className="size-5 accent-[var(--brand)]" /> {label}
            </label>
          ))}
        </div>
        <Assurances label="Na prova" items={[{ icon: ShieldCheck, text: "Prova mantém o que é avaliado" }]} />
      </fieldset>
      <div>
        <label htmlFor={`${id}-title`} className={labelCls}>Título</label>
        <input key={read ? "lido" : "novo"} id={`${id}-title`} name="title" defaultValue={read?.title} maxLength={160} placeholder="Ex.: Prova de Ciências, os animais" className={inputCls} />
      </div>
      {read ? (
        <Field id={`${id}-text`} label="Confira o texto lido do arquivo" hint="Corrija o que a leitura errou. Nomes de pessoas aparecem como [nome].">
          {(control) => (
            <>
              <textarea {...control} name="text" required rows={14} defaultValue={read.text} className={textareaCls} />
              <input type="hidden" name="intent" value="adaptar" />
            </>
          )}
        </Field>
      ) : (
        <>
          {canRead ? (
            <div>
              <label htmlFor={`${id}-file`} className={labelCls}>Foto ou PDF da atividade</label>
              <div id={`${id}-file-hint`} className="mb-3 grid gap-2">
                <p className={`${hintCls} mb-0`}>Até {megabytes(UPLOAD_LIMIT_BYTES.taskFile)} MB.</p>
                <Assurances
                  label="Cuidados com o arquivo"
                  items={[
                    { icon: EyeOff, text: "Cubra os nomes dos alunos" },
                    { icon: ShieldCheck, text: "Arquivo só lido, não guardado" },
                  ]}
                />
              </div>
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
                <input type="checkbox" name="options" value={option.key} defaultChecked={option.key !== "menos_itens" && option.key !== "letra_ampliada"} className="size-5 shrink-0 accent-[var(--brand)]" />
                <span>{option.label}{option.aiOnly && !aiOn ? " (com IA)" : ""}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {objectives?.length ? (
        <div>
          <label htmlFor={`${id}-objective`} className={labelCls}>Objetivo do plano (opcional)</label>
          <select id={`${id}-objective`} name="objectiveId" defaultValue="" className={inputCls}>
            <option value="">Sem objetivo ligado</option>
            {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.description.slice(0, 120)}</option>)}
          </select>
        </div>
      ) : null}
      <FormResult result={result} />
      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS.primary}>
          {read ? <Wand2 size={16} aria-hidden /> : <FileUp size={16} aria-hidden />}
          {pending ? (read ? "Adaptando…" : "Enviando…") : read ? adaptLabel : canRead ? "Ler o arquivo ou adaptar o texto" : adaptLabel}
        </button>
      </div>
    </form>
  );
}
