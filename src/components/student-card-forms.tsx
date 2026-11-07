"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { ImageUp, LoaderCircle, Sprout } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import { choiceCls, hintCls, inputCls, labelCls, primaryButtonCls } from "@/components/form-styles";
import { MAX_CARD_PHOTO_BYTES, MAX_CARD_PHOTO_MB } from "@/lib/student-card-core";
import { FAMILY_MEMBER_OPTIONS } from "@/lib/form-options";
import type { CardFormState } from "@/actions/student-card";

type CardAction = (state: CardFormState, formData: FormData) => Promise<CardFormState>;

const MAX_SIDE = 800;

// Reduz a foto no próprio aparelho e a recodifica em JPG: o arquivo fica leve e
// sai sem os metadados do celular (a localização, por exemplo). Se o navegador
// não conseguir, a foto original segue, e o servidor tira os metadados.
async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : file;
}

export function CardPhotoForm({ action, hasPhoto }: { action: CardAction; hasPhoto: boolean }) {
  const [state, formAction] = useActionState(action, {});
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? state.error;

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setLocalError(null);
    if (!file) return;
    if (file.size > MAX_CARD_PHOTO_BYTES) {
      setLocalError(`A foto tem mais de ${MAX_CARD_PHOTO_MB} MB. Envie uma menor.`);
      return;
    }
    setPreparing(true);
    try {
      const small = await shrinkPhoto(file);
      const list = new DataTransfer();
      list.items.add(small);
      input.files = list.files;
    } catch {
      // Segue com o arquivo original.
    } finally {
      setPreparing(false);
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="carteirinha-foto" className={labelCls}>{hasPhoto ? "Trocar a foto" : "Foto do estudante"}</label>
        <p id="carteirinha-foto-dica" className={hintCls}>JPG ou PNG, de frente. A localização do celular sai da foto.</p>
        <input
          id="carteirinha-foto" name="foto" type="file" required accept="image/jpeg,image/png" capture="user"
          aria-describedby="carteirinha-foto-dica" aria-invalid={error ? true : undefined} onChange={onChange}
          className={`${inputCls} py-2 file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-medium file:text-brand-strong`}
        />
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-coral">{error}</p> : null}
      {state.saved && !error ? <p role="status" className="flex items-center gap-2 text-sm font-medium text-green"><Sprout size={16} aria-hidden className="sprout-mark" /> Foto salva na carteirinha.</p> : null}
      <PendingButton className={primaryButtonCls} pendingText="Enviando a foto…" disabled={preparing}>
        <ImageUp size={16} aria-hidden /> {preparing ? "Preparando a foto…" : "Enviar a foto"}
      </PendingButton>
    </form>
  );
}

export function CardPreferencesForm({ action, firstName, settings, guardian, hasProfile }: {
  action: CardAction;
  firstName: string;
  settings: { showHelp: boolean; showEmergency: boolean; emergencyName: string; emergencyRelation: string; emergencyPhone: string };
  guardian: { name: string; phone: string };
  hasProfile: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Envio pelo onSubmit (como no registro de aula): com action={...}, o React
  // limparia o formulário depois de salvar, e o parentesco voltaria ao valor
  // da primeira renderização. Assim, a tela continua mostrando o que foi salvo.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }
  // Sem contato salvo, o formulário começa com o responsável do cadastro (só grava ao salvar).
  const name = settings.emergencyName || guardian.name;
  const phone = settings.emergencyPhone || guardian.phone;
  return (
    <form onSubmit={submit} aria-busy={pending} className="space-y-4">
      <label className={`${choiceCls} leading-relaxed`}>
        <input type="checkbox" name="mostrarComoAjudar" defaultChecked={settings.showHelp} disabled={!hasProfile} className="size-5 shrink-0 accent-[var(--brand)]" />
        <span>
          Mostrar no verso como ajudar {firstName}: como se comunica, o que acalma e o que incomoda.
          {hasProfile ? null : <span className="mt-0.5 block text-xs text-ink-soft">Fica disponível quando a escola preencher o &ldquo;Como aprende&rdquo;.</span>}
        </span>
      </label>
      <fieldset className="space-y-3 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-medium text-ink">Contato de emergência</legend>
        <label className={`${choiceCls} leading-relaxed`}>
          <input type="checkbox" name="mostrarContato" defaultChecked={settings.showEmergency} className="size-5 shrink-0 accent-[var(--brand)]" />
          <span>Mostrar este contato na carteirinha. Quem pegar a carteirinha vê o telefone.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="contato-nome" className={labelCls}>Nome</label>
            <input id="contato-nome" name="contatoNome" defaultValue={name} maxLength={60} autoComplete="name" className={inputCls} />
          </div>
          <div>
            <label htmlFor="contato-parentesco" className={labelCls}>Parentesco</label>
            <select id="contato-parentesco" name="contatoParentesco" defaultValue={settings.emergencyRelation} className={inputCls}>
              <option value="">Não mostrar</option>
              {FAMILY_MEMBER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="contato-telefone" className={labelCls}>Telefone com DDD</label>
            <input id="contato-telefone" name="contatoTelefone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={phone} placeholder="(11) 98765-4321" className={inputCls} />
          </div>
        </div>
      </fieldset>
      {state.error && !pending ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <p role="status" aria-live="polite" className={state.saved && !state.error && !pending ? "flex items-center gap-2 text-sm font-medium text-green" : "sr-only"}>
        {pending ? "Salvando a carteirinha…" : state.saved && !state.error ? <><Sprout size={16} aria-hidden className="sprout-mark" /> Carteirinha atualizada.</> : ""}
      </p>
      <button type="submit" disabled={pending} className={`${primaryButtonCls} disabled:cursor-wait`}>
        {pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {pending ? "Salvando…" : "Salvar a carteirinha"}
      </button>
    </form>
  );
}
