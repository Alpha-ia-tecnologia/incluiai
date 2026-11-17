"use client";

import { useActionState, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, KeyRound, TriangleAlert } from "lucide-react";
import { createMunicipality, suggestColors, type CreateState } from "@/actions/platform";
import { DEFAULT_BRAND } from "@/lib/branding/palette";
import { SLUG_MAX, UFS, defaultNetworkName, suggestSlug } from "@/lib/tenancy-core";
import { BrandEditor } from "@/components/plataforma/brand-editor";
import { PendingButton } from "@/components/pending-button";
import { PrintButton } from "@/components/print-button";
import { choiceCls, hintCls, inputCls, labelCls, linkCls, primaryButtonCls } from "@/components/form-styles";

export function MunicipalityForm({ domain }: { domain: string }) {
  const [state, submit] = useActionState(createMunicipality, {});
  const values = state.values;
  const id = useId();
  const [name, setName] = useState(values?.name ?? "");
  const [slug, setSlug] = useState(values?.slug ?? "");
  const slugTouched = useRef(false);
  const networkTouched = useRef(false);
  const slugInput = useRef<HTMLInputElement>(null);
  const networkInput = useRef<HTMLInputElement>(null);
  if (state.created) return <Created created={state.created} />;

  const onName = (value: string) => {
    setName(value);
    if (!slugTouched.current && slugInput.current) {
      slugInput.current.value = suggestSlug(value);
      setSlug(slugInput.current.value);
    }
    if (!networkTouched.current && networkInput.current) networkInput.current.value = value.trim() ? defaultNetworkName(value) : "";
  };

  return (
    <form action={submit} className="grid gap-6">
      {state.failed ? (
        <div role="alert" className="rounded-2xl bg-coral-soft p-4 text-sm leading-relaxed text-ink">
          <p className="flex items-start gap-2 font-medium"><TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-coral" /> {state.failed.name} foi cadastrado, mas a preparação do ambiente falhou.</p>
          <p className="mt-2 break-words font-mono text-xs">{state.failed.error}</p>
          <p className="mt-2">Confira o motivo e <Link href={`/plataforma/municipios/${state.failed.slug}`} className={linkCls}>tente de novo na página do município</Link>.</p>
        </div>
      ) : null}

      <fieldset className="grid min-w-0 gap-5">
        <legend className="mb-1 text-base font-semibold text-ink">Município</legend>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div>
            <label htmlFor={`${id}-name`} className={labelCls}>Nome do município</label>
            <input id={`${id}-name`} name="name" required maxLength={80} defaultValue={values?.name} autoComplete="off" onChange={(event) => onName(event.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor={`${id}-uf`} className={labelCls}>UF</label>
            <select id={`${id}-uf`} name="uf" required defaultValue={values?.uf ?? ""} className={inputCls}>
              <option value="" disabled>Escolha</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-network`} className={labelCls}>Nome da rede de ensino</label>
          <p id={`${id}-network-hint`} className={hintCls}>Sai no cabeçalho dos documentos impressos.</p>
          <input id={`${id}-network`} ref={networkInput} name="networkName" required maxLength={160} defaultValue={values?.networkName} aria-describedby={`${id}-network-hint`} autoComplete="off" onChange={() => { networkTouched.current = true; }} className={inputCls} />
        </div>
        <div>
          <label htmlFor={`${id}-slug`} className={labelCls}>Endereço (subdomínio)</label>
          <p id={`${id}-slug-hint`} className={hintCls}>Letras minúsculas sem acento, números e hífen, de 3 a {SLUG_MAX}. Não muda depois de criado.</p>
          <input
            id={`${id}-slug`} ref={slugInput} name="slug" required minLength={3} maxLength={SLUG_MAX} pattern="[a-z0-9\-]+" defaultValue={values?.slug}
            aria-describedby={`${id}-slug-hint ${id}-slug-preview`} autoComplete="off" spellCheck={false}
            onChange={(event) => { slugTouched.current = true; setSlug(event.target.value); }} className={`${inputCls} font-mono`}
          />
          <p id={`${id}-slug-preview`} className="mt-2 break-all text-sm text-ink-soft">O endereço será <strong className="font-medium text-ink">{slug || "nome-do-municipio"}.{domain}</strong></p>
        </div>
      </fieldset>

      <BrandEditor suggest={suggestColors} initial={{ primary: DEFAULT_BRAND.primary, menu: DEFAULT_BRAND.menu, logoUrl: null, source: null }} municipalityName={name || "Município"} />

      <fieldset className="grid min-w-0 gap-5">
        <legend className="mb-1 text-base font-semibold text-ink">Primeira conta da Secretaria de Educação</legend>
        <p className={hintCls}>Ela recebe uma senha temporária, cria a própria no primeiro acesso e depois cadastra as demais pessoas da rede.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-admin-name`} className={labelCls}>Nome completo</label>
            <input id={`${id}-admin-name`} name="adminName" maxLength={120} defaultValue={values?.adminName} autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label htmlFor={`${id}-admin-email`} className={labelCls}>E-mail de acesso</label>
            <input id={`${id}-admin-email`} name="adminEmail" type="email" maxLength={160} defaultValue={values?.adminEmail} autoComplete="off" className={inputCls} />
          </div>
        </div>
      </fieldset>

      <details className="rounded-2xl bg-surface-muted p-4" open={values?.existingDatabase}>
        <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Opção avançada: usar um banco já existente</summary>
        <div className="mt-4 grid gap-4">
          <p className="text-sm leading-relaxed text-ink-soft">Para trazer para a plataforma a implantação que hoje atende um município só: o banco não é criado, as tabelas são atualizadas e, se ele já tem contas, nenhuma conta nova é criada.</p>
          <label className={choiceCls}>
            <input type="checkbox" name="existingDatabase" defaultChecked={values?.existingDatabase} className="size-5 shrink-0 accent-[var(--brand)]" />
            Usar um banco já existente
          </label>
          <div>
            <label htmlFor={`${id}-db`} className={labelCls}>Nome do banco</label>
            <input id={`${id}-db`} name="dbName" maxLength={63} defaultValue={values?.dbName} autoComplete="off" spellCheck={false} className={`${inputCls} font-mono`} />
          </div>
        </div>
      </details>

      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div>
        <PendingButton className={primaryButtonCls} pendingText="Preparando o ambiente: banco, tabelas, catálogo de recursos e a primeira conta. Costuma levar até um minuto; mantenha esta página aberta.">
          <Check size={16} aria-hidden /> Cadastrar e preparar o ambiente
        </PendingButton>
      </div>
    </form>
  );
}

function Created({ created }: { created: NonNullable<CreateState["created"]> }) {
  return (
    <div role="status" className="grid max-w-2xl gap-4">
      <p className="flex items-start gap-2 text-base font-medium text-ink"><Check size={20} aria-hidden className="mt-0.5 shrink-0 text-green" /> O ambiente de {created.name} está pronto.</p>
      <div className="rounded-2xl bg-surface-muted p-4">
        <p className="text-sm text-ink-soft">Endereço</p>
        <a id="endereco-municipio" href={created.address} className={`break-all text-sm ${linkCls}`}>{created.address}</a>
        {created.password ? (
          <>
            <p className="mt-3 text-sm text-ink-soft">E-mail da Secretaria</p>
            <p className="break-all text-sm font-medium text-ink">{created.adminEmail}</p>
            <p className="mt-3 text-sm text-ink-soft">Senha temporária</p>
            <p id="senha-temporaria" className="font-mono text-xl tracking-wider text-ink">{created.password}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">O banco já tinha contas: nenhuma conta nova foi criada.</p>
        )}
      </div>
      {created.password ? (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
          <KeyRound size={16} aria-hidden className="mt-0.5 shrink-0" />
          Entregue o endereço e a senha à Secretaria por um canal seguro. A senha aparece só agora; no primeiro acesso, a pessoa cria a própria.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton label="Imprimir" />
        <a href={created.address} className={`inline-flex min-h-11 items-center gap-2 ${linkCls}`}>Abrir o endereço <ExternalLink size={16} aria-hidden /></a>
        <Link href={`/plataforma/municipios/${created.slug}`} className={`inline-flex min-h-11 items-center ${linkCls}`}>Ver o município</Link>
      </div>
    </div>
  );
}
