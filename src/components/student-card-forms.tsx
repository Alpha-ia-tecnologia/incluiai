"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import { Field, FormResult } from "@/components/form-kit";
import { choiceCls, inputCls, labelCls, BUTTON_CLS } from "@/components/form-styles";
import type { ActionResult } from "@/lib/action-result";
import { CARD_PHOTO_UPLOAD } from "@/lib/student-card-core";
import { FAMILY_MEMBER_OPTIONS } from "@/lib/form-options";

type CardAction = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const MAX_SIDE = 800;

// Reduz a foto no próprio aparelho e a recodifica em JPG: sai sem os
// metadados do celular (a localização, por exemplo).
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
  const [result, formAction] = useActionState(action, null);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const shown: ActionResult | null = localError ? { ok: false, message: localError } : result;

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setLocalError(null);
    if (!file) return;
    if (file.size > CARD_PHOTO_UPLOAD.maxBytes) {
      setLocalError(CARD_PHOTO_UPLOAD.tooLarge);
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
      <Field id="carteirinha-foto" label={hasPhoto ? "Trocar a foto" : "Foto do estudante"} hint="JPG ou PNG, de frente. A localização do celular sai da foto.">
        {(control) => (
          <input
            {...control} name="foto" type="file" required accept="image/jpeg,image/png" capture="user"
            aria-invalid={shown && !shown.ok ? true : undefined} onChange={onChange}
            className={`${inputCls} py-2 file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-medium file:text-brand-strong`}
          />
        )}
      </Field>
      <FormResult result={shown} success="Foto salva na carteirinha." />
      <PendingButton className={BUTTON_CLS.primary} pendingText="Enviando a foto…" disabled={preparing}>
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
  const [result, formAction, pending] = useActionState(action, null);
  // Com action={...}, o React limparia o formulário depois de salvar.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }
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
      <FormResult result={pending ? null : result} success="Carteirinha atualizada." />
      <button type="submit" disabled={pending} className={`${BUTTON_CLS.primary} disabled:cursor-wait`}>
        {pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {pending ? "Salvando…" : "Salvar a carteirinha"}
      </button>
    </form>
  );
}
