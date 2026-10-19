"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Check, KeyRound, UserPlus } from "lucide-react";
import type { AccountFormState } from "@/actions/users";
import { choiceCls, hintCls, inputCls, labelCls, linkCls, primaryButtonCls, quietButtonCls } from "@/components/form-styles";
import { PrintButton } from "@/components/print-button";

type Option = { value: string; label: string };
type StudentOption = { id: string; name: string; detail: string };
type Defaults = { name: string; email: string; role: string; schoolId: string | null; studentIds: string[] };

const LINKED = new Set(["familia", "terapeuta"]);

// Dados da conta: nome, e-mail, perfil e, conforme o perfil, a escola (equipe)
// ou os estudantes vinculados (família e terapeuta). Na criação, a senha
// temporária aparece uma vez para a gestão entregar à pessoa.
export function AccountForm({ action, roles, schools, fixedSchool, students, defaults, mode }: {
  action: (previous: AccountFormState, formData: FormData) => Promise<AccountFormState>;
  roles: Option[];
  schools: { id: string; name: string }[];
  // Quem gerencia é de uma escola: a conta nova é dessa escola.
  fixedSchool: boolean;
  students: StudentOption[];
  defaults?: Defaults;
  mode: "create" | "edit";
}) {
  // Depois de criar, "Criar outra conta" monta o formulário de novo, vazio.
  const [round, setRound] = useState(0);
  return <AccountFormBody key={round} {...{ action, roles, schools, fixedSchool, students, defaults, mode }} onAnother={() => setRound((value) => value + 1)} />;
}

function AccountFormBody({ action, roles, schools, fixedSchool, students, defaults, mode, onAnother }: Parameters<typeof AccountForm>[0] & { onAnother: () => void }) {
  const [state, submit, pending] = useActionState(action, {});
  const [role, setRole] = useState(defaults?.role ?? roles[0]?.value ?? "");
  const values = state.values ?? defaults;
  const [filter, setFilter] = useState("");
  const id = useId();
  if (state.created) return <CreatedAccount created={state.created} onAnother={onAnother} />;

  const linked = LINKED.has(role);
  const needsSchool = !linked && role !== "secretaria";
  // Coordenação e gestão criadas pela rede podem acompanhar a rede inteira.
  const networkRole = role === "coordenacao" || role === "gestao";
  const shown = students.filter((student) => !filter.trim() || student.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <form action={submit} className="grid max-w-2xl gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={labelCls}>Nome completo</label>
          <input id={`${id}-name`} name="name" required minLength={3} maxLength={120} defaultValue={values?.name} autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={labelCls}>E-mail de acesso</label>
          <input id={`${id}-email`} name="email" type="email" required maxLength={160} defaultValue={values?.email} autoComplete="off" className={inputCls} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-role`} className={labelCls}>Perfil</label>
          <select id={`${id}-role`} name="role" value={role} onChange={(event) => setRole(event.target.value)} className={inputCls}>
            {roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        {needsSchool ? (
          <div>
            <label htmlFor={`${id}-school`} className={labelCls}>Escola</label>
            {fixedSchool && schools[0] ? (
              <>
                <input type="hidden" name="schoolId" value={schools[0].id} />
                <p id={`${id}-school`} className="flex min-h-11 items-center text-sm text-ink">{schools[0].name}</p>
              </>
            ) : (
              <select id={`${id}-school`} name="schoolId" defaultValue={values?.schoolId ?? ""} required={!networkRole} className={inputCls}>
                <option value="">{networkRole ? "Rede inteira (sem escola)" : "Escolha a escola"}</option>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
            )}
          </div>
        ) : null}
      </div>

      {linked ? (
        <fieldset className="grid min-w-0 gap-3">
          <legend className={labelCls}>Estudantes vinculados</legend>
          <p className={hintCls}>{role === "familia" ? "Marque os filhos que esta família acompanha." : "Marque os estudantes que este terapeuta acompanha."} A pessoa vê só estes estudantes, no portal dela.</p>
          {students.length > 8 ? (
            <div>
              <label htmlFor={`${id}-filter`} className="sr-only">Buscar estudante pelo nome</label>
              <input id={`${id}-filter`} type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar estudante pelo nome" className={inputCls} />
            </div>
          ) : null}
          {students.length ? (
            <ul className="grid min-w-0 gap-2 sm:grid-cols-2">
              {students.map((student) => (
                // Fora do filtro, o estudante só some da vista: a marcação continua valendo.
                <li key={student.id} className={`min-w-0 ${shown.includes(student) ? "" : "hidden"}`}>
                  <label className={choiceCls}>
                    <input type="checkbox" name="studentIds" value={student.id} defaultChecked={values?.studentIds.includes(student.id)} className="size-5 shrink-0 accent-[var(--brand)]" />
                    <span className="min-w-0"><span className="block truncate font-medium">{student.name}</span><span className="block text-xs text-ink-soft">{student.detail}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nenhum estudante ativo para vincular.</p>
          )}
        </fieldset>
      ) : null}

      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      {state.saved ? <p role="status" className="flex items-center gap-2 text-sm font-medium text-green"><Check size={16} aria-hidden /> Alterações salvas.</p> : null}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonCls}>
          {mode === "create" ? <UserPlus size={16} aria-hidden /> : <Check size={16} aria-hidden />}
          {pending ? "Salvando…" : mode === "create" ? "Criar a conta" : "Salvar as alterações"}
        </button>
      </div>
    </form>
  );
}

function CreatedAccount({ created, onAnother }: { created: NonNullable<AccountFormState["created"]>; onAnother: () => void }) {
  return (
    <div role="status" className="grid max-w-2xl gap-4">
      <p className="flex items-start gap-2 text-sm font-medium text-ink"><Check size={18} aria-hidden className="mt-0.5 shrink-0 text-green" /> Conta criada para {created.name}.</p>
      <div className="rounded-2xl bg-surface-muted p-4">
        <p className="text-sm text-ink-soft">E-mail de acesso</p>
        <p className="break-all text-sm font-medium text-ink">{created.email}</p>
        <p className="mt-3 text-sm text-ink-soft">Senha temporária</p>
        <p id="senha-temporaria" className="font-mono text-lg tracking-wider text-ink">{created.password}</p>
      </div>
      <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
        <KeyRound size={16} aria-hidden className="mt-0.5 shrink-0" />
        Entregue a senha temporária pessoalmente ou por um canal seguro. Ela aparece só agora; no primeiro acesso, a pessoa cria a própria senha.
      </p>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton label="Imprimir" />
        <button type="button" onClick={onAnother} className={quietButtonCls}>Criar outra conta</button>
        <Link href={`/usuarios/${created.id}`} className={linkCls}>Abrir a conta</Link>
      </div>
    </div>
  );
}
