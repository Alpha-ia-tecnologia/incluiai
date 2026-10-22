"use client";

import { useActionState } from "react";
import { Check, FileUp, RefreshCw } from "lucide-react";
import type { CensusState } from "@/actions/census";
import type { MonitorConfig } from "@/lib/census-rules";
import { choiceCls, hintCls, inputCls, labelCls, primaryButtonCls, secondaryButtonCls, textareaCls } from "@/components/form-styles";

type Action = (previous: CensusState, formData: FormData) => Promise<CensusState>;

const Feedback = ({ state, saved }: { state: CensusState; saved?: string }) => (
  <>
    {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
    {state.saved && saved ? <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-green"><Check size={16} aria-hidden /> {saved}</p> : null}
  </>
);

// Arquivo de migração do Educacenso: vira uma prévia para revisar antes de aplicar.
export function CensusUploadForm({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="grid gap-3">
      <div>
        <label htmlFor="censo-arquivo" className={labelCls}>Arquivo de migração do Educacenso (.txt)</label>
        <p id="censo-arquivo-dica" className={hintCls}>Exporte pelo Educacenso ou pelo sistema de gestão da escola. A plataforma lê o arquivo, mostra a prévia e não guarda o arquivo.</p>
        <input id="censo-arquivo" name="file" type="file" accept=".txt,text/plain" required aria-describedby="censo-arquivo-dica" className={`${inputCls} file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:text-brand-strong`} />
      </div>
      <Feedback state={state} />
      <div><button type="submit" disabled={pending} className={primaryButtonCls}><FileUp size={16} aria-hidden /> {pending ? "Lendo o arquivo…" : "Ler o arquivo e ver a prévia"}</button></div>
    </form>
  );
}

// Revisão manual de uma pessoa do arquivo.
export function CensusDecisionForm({ action, personKey, candidates, canCreate }: { action: Action; personKey: string; candidates: { id: string; name: string; birthDate: string }[]; canCreate: boolean }) {
  const [state, submit, pending] = useActionState(action, {});
  const id = (suffix: string) => `decisao-${personKey.replace(/\W/g, "")}-${suffix}`;
  return (
    <form action={submit} className="grid gap-3">
      <fieldset className="grid gap-2">
        <legend className={labelCls}>O que fazer com esta pessoa?</legend>
        {candidates.map((candidate) => (
          <label key={candidate.id} className={choiceCls}>
            <input type="radio" name="decision" value={`link:${candidate.id}`} required className="size-5 shrink-0 accent-[var(--brand)]" />
            <span>Vincular a {candidate.name}{candidate.birthDate ? ` (nascimento ${candidate.birthDate.split("-").reverse().join("/")})` : ""}</span>
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
      <Feedback state={state} />
      <div><button type="submit" disabled={pending} className={secondaryButtonCls}>Salvar a decisão</button></div>
    </form>
  );
}

export function CensusApplyForm({ action, blocked }: { action: (previous: CensusState) => Promise<CensusState>; blocked: string | null }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="grid gap-2">
      {blocked ? <p className={hintCls}>{blocked}</p> : null}
      <Feedback state={state} />
      <div><button type="submit" disabled={pending || Boolean(blocked)} className={primaryButtonCls}><Check size={16} aria-hidden /> {pending ? "Aplicando…" : "Aplicar e guardar como referência"}</button></div>
    </form>
  );
}

export function CensusVerifyForm({ action }: { action: (previous: CensusState) => Promise<CensusState> }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="grid gap-2">
      <div><button type="submit" disabled={pending} className={secondaryButtonCls}><RefreshCw size={16} aria-hidden /> {pending ? "Verificando…" : "Verificar agora"}</button></div>
      <Feedback state={state} saved="Verificação registrada no histórico." />
    </form>
  );
}

// Janela do Censo: datas e até quatro horários (Brasília). Padrão: 8h e 16h.
export function CensusWindowForm({ action, config }: { action: Action; config: MonitorConfig }) {
  const [state, submit, pending] = useActionState(action, {});
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
        <p className={hintCls}>Duas por dia bastam: de manhã e no fim da tarde. Deixe vazio o que não usar.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {times.map((time, index) => (
            <div key={index}>
              <label htmlFor={`censo-hora-${index}`} className="sr-only">Horário {index + 1}</label>
              <input id={`censo-hora-${index}`} name="times" type="time" defaultValue={time} className={inputCls} />
            </div>
          ))}
        </div>
      </fieldset>
      <Feedback state={state} saved="Janela salva. A próxima verificação já foi reagendada." />
      <div><button type="submit" disabled={pending} className={secondaryButtonCls}>Salvar a janela</button></div>
    </form>
  );
}

export function FndeForm({ action, value, year }: { action: Action; value: number | null; year: number }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)]">
        <div>
          <label htmlFor="fnde-aee" className={labelCls}>Matrículas de AEE consideradas pelo FNDE</label>
          <p id="fnde-aee-dica" className={hintCls}>Da lista de matrículas do Fundeb publicada pelo FNDE para a rede. Deixe vazio para apagar.</p>
          <input id="fnde-aee" name="fndeAee" type="number" min={0} inputMode="numeric" defaultValue={value ?? ""} aria-describedby="fnde-aee-dica" className={inputCls} />
        </div>
        <div className="self-end">
          <label htmlFor="fnde-ano" className={labelCls}>Fundeb de</label>
          <input id="fnde-ano" name="fndeYear" type="number" min={2020} max={2100} defaultValue={year} className={inputCls} />
        </div>
      </div>
      <Feedback state={state} saved="Número do FNDE salvo." />
      <div><button type="submit" disabled={pending} className={secondaryButtonCls}>Salvar</button></div>
    </form>
  );
}

// Código INEP (da escola, 8 números, ou do estudante, 12 números).
export function InepForm({ action, id, label, name, length, value }: { action: Action; id: string; label: string; name: string; length: 8 | 12; value?: string | null }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-0">
        <label htmlFor={id} className={labelCls}>{label}</label>
        <input id={id} name={name} inputMode="numeric" pattern={`\\d{${length}}`} maxLength={length} required defaultValue={value ?? ""} className={`${inputCls.replace("w-full ", "")} w-40`} />
      </div>
      <button type="submit" disabled={pending} className={secondaryButtonCls}>Salvar</button>
      <div className="basis-full"><Feedback state={state} saved="Salvo." /></div>
    </form>
  );
}
