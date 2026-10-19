"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Check, FileSpreadsheet, Upload } from "lucide-react";
import { importStudents, type ImportState } from "@/actions/student-import";
import { hintCls, inputCls, labelCls, linkCls, primaryButtonCls, quietButtonCls } from "@/components/form-styles";

const SHOWN = 50;

// Planilha em duas fases: conferir (nada é gravado) e importar as linhas prontas.
// "Escolher outro arquivo" e "Importar outra planilha" montam o formulário de novo.
export function StudentImportForm({ schools, fixedSchool }: { schools: { id: string; name: string }[]; fixedSchool: boolean }) {
  const [round, setRound] = useState(0);
  return <ImportSteps key={round} schools={schools} fixedSchool={fixedSchool} onRestart={() => setRound((value) => value + 1)} />;
}

function ImportSteps({ schools, fixedSchool, onRestart }: { schools: { id: string; name: string }[]; fixedSchool: boolean; onRestart: () => void }) {
  const [state, submit, pending] = useActionState(importStudents, {} as ImportState);
  const id = useId();

  if (state.imported !== undefined) {
    return (
      <div role="status" className="grid gap-4">
        <p className="flex items-start gap-2 text-sm font-medium text-ink"><Check size={18} aria-hidden className="mt-0.5 shrink-0 text-green" /> {state.imported === 1 ? "1 estudante importado" : `${state.imported} estudantes importados`} para {state.schoolName}.</p>
        {state.invalid?.length || state.existing?.length ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Ficaram de fora {state.invalid?.length ? `${state.invalid.length} linha(s) com problema` : ""}{state.invalid?.length && state.existing?.length ? " e " : ""}{state.existing?.length ? `${state.existing.length} estudante(s) já cadastrado(s)` : ""}. Corrija a planilha e importe só essas linhas, se precisar.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/estudantes" className={primaryButtonCls}>Ver os estudantes</Link>
          <button type="button" onClick={onRestart} className={quietButtonCls}>Importar outra planilha</button>
        </div>
      </div>
    );
  }

  if (state.csv !== undefined) {
    const ready = state.ready ?? [];
    return (
      <div className="grid gap-5">
        <p className="text-sm leading-relaxed text-ink" role="status">
          Conferido para <strong className="font-medium">{state.schoolName}</strong>: {ready.length} pronto(s) para importar, {state.existing?.length ?? 0} já cadastrado(s) e {state.invalid?.length ?? 0} com problema. Nada foi gravado ainda.
        </p>
        {state.invalid?.length ? (
          <section aria-labelledby={`${id}-invalid`} className="rounded-2xl bg-coral-soft p-4">
            <h3 id={`${id}-invalid`} className="mb-2 text-sm font-medium text-coral">Linhas com problema (ficam de fora)</h3>
            <ul className="grid gap-1.5 text-sm text-ink">
              {state.invalid.map((row) => <li key={row.line}><strong className="font-medium">Linha {row.line}{row.name ? ` · ${row.name}` : ""}:</strong> {row.errors.join("; ")}.</li>)}
            </ul>
          </section>
        ) : null}
        {state.existing?.length ? (
          <section aria-labelledby={`${id}-existing`} className="rounded-2xl bg-surface-muted p-4">
            <h3 id={`${id}-existing`} className="mb-2 text-sm font-medium text-ink">Já cadastrados nesta escola (mesmo nome e nascimento; ficam de fora)</h3>
            <ul className="grid gap-1 text-sm text-ink-soft">
              {state.existing.map((row) => <li key={row.line}>Linha {row.line} · {row.name}</li>)}
            </ul>
          </section>
        ) : null}
        {ready.some((row) => row.similar) ? (
          <section aria-labelledby={`${id}-similar`} className="rounded-2xl bg-amber-soft p-4">
            <h3 id={`${id}-similar`} className="mb-2 text-sm font-medium text-amber">Confira antes de importar: nome igual, nascimento diferente</h3>
            <p className="mb-2 text-sm leading-relaxed text-ink">A escola já tem um estudante com o mesmo nome e outro nascimento. Se for a mesma pessoa, corrija a data na planilha; se for outra (homônimo), pode importar.</p>
            <ul className="grid gap-1 text-sm text-ink">
              {ready.filter((row) => row.similar).map((row) => <li key={row.line}>Linha {row.line} · {row.name} · {row.detail}</li>)}
            </ul>
          </section>
        ) : null}
        {ready.length ? (
          <section aria-labelledby={`${id}-ready`}>
            <h3 id={`${id}-ready`} className="mb-2 text-sm font-medium text-ink">Prontos para importar</h3>
            <ul className="grid gap-1 text-sm">
              {ready.slice(0, SHOWN).map((row) => <li key={row.line} className="min-w-0 break-words"><span className="font-medium text-ink">{row.name}</span> <span className="text-ink-soft">· {row.detail}</span></li>)}
            </ul>
            {ready.length > SHOWN ? <p className="mt-2 text-sm text-ink-soft">E mais {ready.length - SHOWN}.</p> : null}
          </section>
        ) : null}
        <form action={submit} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="intent" value="importar" />
          <input type="hidden" name="csv" value={state.csv} />
          <input type="hidden" name="schoolId" value={state.schoolId} />
          {ready.length ? (
            <button type="submit" disabled={pending} className={primaryButtonCls}>
              <Upload size={16} aria-hidden /> {pending ? "Importando…" : ready.length === 1 ? "Importar 1 estudante" : `Importar ${ready.length} estudantes`}
            </button>
          ) : null}
          <button type="button" onClick={onRestart} className={quietButtonCls}>Escolher outro arquivo</button>
        </form>
      </div>
    );
  }

  return (
    <form action={submit} className="grid max-w-xl gap-5">
      <input type="hidden" name="intent" value="conferir" />
      {fixedSchool ? null : (
        <div>
          <label htmlFor={`${id}-school`} className={labelCls}>Escola dos estudantes</label>
          <select id={`${id}-school`} name="schoolId" required defaultValue="" className={inputCls}>
            <option value="">Escolha a escola</option>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${id}-file`} className={labelCls}>Arquivo da planilha (.csv)</label>
        <p id={`${id}-hint`} className={hintCls}>No Excel ou no LibreOffice: Arquivo › Salvar como › CSV. Até 500 estudantes por vez.</p>
        <input
          id={`${id}-file`} name="file" type="file" required accept=".csv,text/csv" aria-describedby={`${id}-hint`}
          className={`${inputCls} py-2 file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-medium file:text-brand-strong`}
        />
      </div>
      {state.problem ? <p role="alert" className="text-sm font-medium text-coral">{state.problem}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonCls}>
          <FileSpreadsheet size={16} aria-hidden /> {pending ? "Conferindo…" : "Conferir a planilha"}
        </button>
        <a href="/estudantes/importar/modelo" download className={`text-sm ${linkCls}`}>Baixar o modelo (.csv)</a>
      </div>
    </form>
  );
}
