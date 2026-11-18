"use client";

import { useActionState } from "react";
import { Check, FileUp, FileX2, RefreshCw, ShieldCheck } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { MonitorConfig } from "@/lib/census-core";
import { isoToBr } from "@/lib/dates";
import { Field, FormResult } from "@/components/form-kit";
import { choiceCls, hintCls, inputBoxCls, inputCls, labelCls, BUTTON_CLS, textareaCls } from "@/components/form-styles";
import { Assurances } from "@/components/explain";

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function CensusUploadForm({ action }: { action: Action }) {
  const [result, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="grid gap-3">
      <Field id="censo-arquivo" label="Arquivo de migração do Educacenso (.txt)" hint="Do Educacenso ou do sistema de gestão da escola.">
        {(control) => <input {...control} name="file" type="file" accept=".txt,text/plain" required className={`${inputCls} file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:text-brand-strong`} />}
      </Field>
      <Assurances
        label="Cuidados com o arquivo"
        items={[
          { icon: ShieldCheck, text: "Nada muda antes de você aplicar" },
          { icon: FileX2, text: "O arquivo não fica guardado" },
        ]}
      />
      <FormResult result={result} />
      <div><button type="submit" disabled={pending} className={BUTTON_CLS.primary}><FileUp size={16} aria-hidden /> {pending ? "Lendo o arquivo…" : "Ler o arquivo e ver a prévia"}</button></div>
    </form>
  );
}

export function CensusDecisionForm({ action, personKey, candidates, canCreate }: { action: Action; personKey: string; candidates: { id: string; name: string; birthDate: string }[]; canCreate: boolean }) {
  const [result, submit, pending] = useActionState(action, null);
  const id = (suffix: string) => `decisao-${personKey.replace(/\W/g, "")}-${suffix}`;
  return (
    <form action={submit} className="grid gap-3">
      <fieldset className="grid gap-2">
        <legend className={labelCls}>O que fazer com esta pessoa?</legend>
        {candidates.map((candidate) => (
          <label key={candidate.id} className={choiceCls}>
            <input type="radio" name="decision" value={`link:${candidate.id}`} required className="size-5 shrink-0 accent-[var(--brand)]" />
            <span>Vincular a {candidate.name}{candidate.birthDate ? ` (nascimento ${isoToBr(candidate.birthDate)})` : ""}</span>
          </label>
        ))}
        {canCreate ? (
          <label className={choiceCls}>
            <input type="radio" name="decision" value="create" required className="size-5 shrink-0 accent-[var(--brand)]" />
            <span>Cadastrar como novo estudante</span>
          </label>
        ) : null}
        <label className={choiceCls}>
          <input type="radio" name="decision" value="ignore" required className="size-5 shrink-0 accent-[var(--brand)]" />
          <span>Ignorar nesta importação</span>
        </label>
      </fieldset>
      <div>
        <label htmlFor={id("motivo")} className={labelCls}>Motivo, se for ignorar</label>
        <textarea id={id("motivo")} name="reason" rows={2} maxLength={200} className={textareaCls} />
      </div>
      <FormResult result={result} />
      <div><button type="submit" disabled={pending} className={BUTTON_CLS.secondary}>Salvar a decisão</button></div>
    </form>
  );
}

export function CensusApplyForm({ action, blocked }: { action: () => Promise<ActionResult>; blocked: string | null }) {
  const [result, submit, pending] = useActionState<ActionResult | null>(action, null);
  return (
    <form action={submit} className="grid gap-2">
      {blocked ? <p className={hintCls}>{blocked}</p> : null}
      <FormResult result={result} />
      <div><button type="submit" disabled={pending || Boolean(blocked)} className={BUTTON_CLS.primary}><Check size={16} aria-hidden /> {pending ? "Aplicando…" : "Aplicar e guardar como referência"}</button></div>
    </form>
  );
}

export function CensusVerifyForm({ action }: { action: () => Promise<ActionResult> }) {
  const [result, submit, pending] = useActionState<ActionResult | null>(action, null);
  return (
    <form action={submit} className="grid gap-2">
      <div><button type="submit" disabled={pending} className={BUTTON_CLS.secondary}><RefreshCw size={16} aria-hidden /> {pending ? "Verificando…" : "Verificar agora"}</button></div>
      <FormResult result={result} success="Verificação registrada no histórico." />
    </form>
  );
}

export function CensusWindowForm({ action, config }: { action: Action; config: MonitorConfig }) {
  const [result, submit, pending] = useActionState(action, null);
  const times = [...config.times, "", "", "", ""].slice(0, 4);
  return (
    <form action={submit} className="grid gap-4">
      <label className={choiceCls}>
        <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="size-5 shrink-0 accent-[var(--brand)]" />
        <span>Verificar automaticamente nos horários da janela</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="censo-inicio" className={labelCls}>Início da janela</label>
          <input id="censo-inicio" name="periodStart" type="date" required defaultValue={config.periodStart} className={inputCls} />
        </div>
        <div>
          <label htmlFor="censo-fim" className={labelCls}>Fim da janela</label>
          <input id="censo-fim" name="periodEnd" type="date" required defaultValue={config.periodEnd} className={inputCls} />
        </div>
      </div>
      <fieldset className="grid gap-2">
        <legend className={labelCls}>Horários das verificações (Brasília)</legend>
        <p className={hintCls}>Duas por dia bastam (manhã e fim da tarde). Deixe vazio o que não usar.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {times.map((time, index) => (
            <div key={index}>
              <label htmlFor={`censo-hora-${index}`} className="sr-only">Horário {index + 1}</label>
              <input id={`censo-hora-${index}`} name="times" type="time" defaultValue={time} className={inputCls} />
            </div>
          ))}
        </div>
      </fieldset>
      <FormResult result={result} success="Janela salva. A próxima verificação já foi reagendada." />
      <div><button type="submit" disabled={pending} className={BUTTON_CLS.secondary}>Salvar a janela</button></div>
    </form>
  );
}

export function FndeForm({ action, value, year }: { action: Action; value: number | null; year: number }) {
  const [result, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)]">
        <Field id="fnde-aee" label="Matrículas de AEE consideradas pelo FNDE" hint="Da lista do Fundeb publicada pelo FNDE. Vazio apaga o número.">
          {(control) => <input {...control} name="fndeAee" type="number" min={0} inputMode="numeric" defaultValue={value ?? ""} className={inputCls} />}
        </Field>
        <div className="self-end">
          <label htmlFor="fnde-ano" className={labelCls}>Fundeb de</label>
          <input id="fnde-ano" name="fndeYear" type="number" min={2020} max={2100} defaultValue={year} className={inputCls} />
        </div>
      </div>
      <FormResult result={result} success="Número do FNDE salvo." />
      <div><button type="submit" disabled={pending} className={BUTTON_CLS.secondary}>Salvar</button></div>
    </form>
  );
}

export function InepForm({ action, id, label, name, length, value }: { action: Action; id: string; label: string; name: string; length: 8 | 12; value?: string | null }) {
  const [result, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-0">
        <label htmlFor={id} className={labelCls}>{label}</label>
        <input id={id} name={name} inputMode="numeric" pattern={`\\d{${length}}`} maxLength={length} required defaultValue={value ?? ""} className={`${inputBoxCls} w-40`} />
      </div>
      <button type="submit" disabled={pending} className={BUTTON_CLS.secondary}>Salvar</button>
      <div className="basis-full"><FormResult result={result} success="Salvo." /></div>
    </form>
  );
}
