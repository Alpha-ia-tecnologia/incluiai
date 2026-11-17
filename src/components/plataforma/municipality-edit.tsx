"use client";

import { useActionState, useId } from "react";
import { Check, KeyRound, RotateCcw } from "lucide-react";
import { retryProvisioning, suggestColors, updateMunicipality } from "@/actions/platform";
import { UFS } from "@/lib/tenancy-core";
import { BrandEditor } from "@/components/plataforma/brand-editor";
import { PendingButton } from "@/components/pending-button";
import { hintCls, inputCls, labelCls, linkCls, primaryButtonCls } from "@/components/form-styles";

type Defaults = { slug: string; name: string; uf: string; networkName: string; primaryColor: string; menuColor: string; colorSource: string; logoUrl: string | null };
const SOURCES = new Set(["ia", "regras", "manual"]);

export function MunicipalityEditForm({ defaults }: { defaults: Defaults }) {
  const [state, submit] = useActionState(updateMunicipality, {});
  const id = useId();
  const source = SOURCES.has(defaults.colorSource) ? (defaults.colorSource as "ia" | "regras" | "manual") : null;
  return (
    <form action={submit} className="grid gap-6">
      <input type="hidden" name="slug" value={defaults.slug} />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div>
          <label htmlFor={`${id}-name`} className={labelCls}>Nome do município</label>
          <input id={`${id}-name`} name="name" required maxLength={80} defaultValue={defaults.name} autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor={`${id}-uf`} className={labelCls}>UF</label>
          <select id={`${id}-uf`} name="uf" required defaultValue={defaults.uf} className={inputCls}>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-network`} className={labelCls}>Nome da rede de ensino</label>
        <p id={`${id}-network-hint`} className={hintCls}>Sai no cabeçalho dos documentos impressos.</p>
        <input id={`${id}-network`} name="networkName" required maxLength={160} defaultValue={defaults.networkName} aria-describedby={`${id}-network-hint`} autoComplete="off" className={inputCls} />
      </div>
      <BrandEditor
        suggest={suggestColors}
        initial={{ primary: defaults.primaryColor, menu: defaults.menuColor, logoUrl: defaults.logoUrl, source }}
        municipalityName={defaults.name}
      />
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      {state.saved ? <p role="status" className="flex items-center gap-2 text-sm font-medium text-green"><Check size={16} aria-hidden /> Alterações salvas. O ambiente do município já mostra a marca nova.</p> : null}
      <div>
        <PendingButton className={primaryButtonCls} pendingText="Salvando…"><Check size={16} aria-hidden /> Salvar as alterações</PendingButton>
      </div>
    </form>
  );
}

export function RetryProvisioningForm({ slug, address }: { slug: string; address: string }) {
  const [state, submit] = useActionState(retryProvisioning, {});
  if (state.done) {
    return (
      <div role="status" className="grid gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink"><Check size={18} aria-hidden className="text-green" /> O ambiente está pronto.</p>
        {state.password ? (
          <div className="rounded-2xl bg-surface-muted p-4">
            <p className="text-sm text-ink-soft">E-mail da Secretaria</p>
            <p className="break-all text-sm font-medium text-ink">{state.adminEmail}</p>
            <p className="mt-3 text-sm text-ink-soft">Senha temporária</p>
            <p id="senha-temporaria" className="font-mono text-xl tracking-wider text-ink">{state.password}</p>
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-ink-soft"><KeyRound size={16} aria-hidden className="mt-0.5 shrink-0" /> A senha aparece só agora; no primeiro acesso, a pessoa cria a própria.</p>
          </div>
        ) : null}
        <p className="text-sm"><a href={address} className={linkCls}>Abrir o endereço do município</a> · <a href={`/plataforma/municipios/${slug}`} className={linkCls}>Atualizar esta página</a></p>
      </div>
    );
  }
  return (
    <form action={submit} className="grid gap-3">
      <input type="hidden" name="slug" value={slug} />
      {state.error ? <p role="alert" className="break-words rounded-xl bg-coral-soft px-4 py-3 font-mono text-xs text-ink">{state.error}</p> : null}
      <div>
        <PendingButton className={primaryButtonCls} pendingText="Preparando o ambiente: banco, tabelas, catálogo de recursos e a primeira conta. Costuma levar até um minuto; mantenha esta página aberta.">
          <RotateCcw size={16} aria-hidden /> Tentar preparar de novo
        </PendingButton>
      </div>
    </form>
  );
}
