"use client";

import { useActionState, useId } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import type { CodeState } from "@/actions/two-factor";
import { confirmTwoFactorSetup, finishSecondStepSetup } from "@/actions/two-factor";
import { BUTTON_CLS, type ButtonVariant, hintCls, inputCls, labelCls } from "@/components/form-styles";
import { PrintButton } from "@/components/print-button";

type CodeAction = (previous: CodeState, formData: FormData) => Promise<CodeState>;

type FormText = { label: string; hint?: string; button: string; pendingLabel: string; kind?: "app" | "recovery"; variant?: ButtonVariant };

// Campo de código (aplicativo ou recuperação) com o envio e o erro. Quando a
// ação devolve códigos de recuperação, eles aparecem no lugar do formulário.
export function CodeForm({ action, finish = "refresh", ...text }: FormText & { action: CodeAction; finish?: "refresh" | "enter" }) {
  const [state, submit, pending] = useActionState(action, {});
  if (state.codes) return <RecoveryCodes codes={state.codes} finish={finish} />;
  return <CodeFields state={state} submit={submit} pending={pending} {...text} />;
}

// Ligar as duas etapas: passos, QR code (desenhado no servidor) e o segredo para
// digitar. Confirmado o primeiro código, tudo isso sai da tela e ficam só os
// códigos de recuperação (o segredo não vai junto se a pessoa imprimir).
export function SetupFlow({ svg, secret, account, finish }: { svg: string; secret: string; account: string; finish: "refresh" | "enter" }) {
  const [state, submit, pending] = useActionState(confirmTwoFactorSetup, {});
  if (state.codes) return <RecoveryCodes codes={state.codes} finish={finish} />;
  return (
    <div className="grid gap-6">
      <ol className="grid gap-2 text-sm leading-relaxed text-ink">
        <li><strong className="font-medium">1.</strong> Instale no celular um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, FreeOTP ou outro).</li>
        <li><strong className="font-medium">2.</strong> No aplicativo, escolha adicionar conta e leia o QR code abaixo.</li>
        <li><strong className="font-medium">3.</strong> Digite o código de 6 números que o aplicativo mostrar.</li>
      </ol>
      <div className="flex flex-wrap items-start gap-6">
        <div
          role="img"
          aria-label="QR code para o aplicativo autenticador"
          className="size-44 shrink-0 rounded-2xl bg-white p-2 [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="min-w-0 flex-1 basis-56">
          <p className="mb-2 text-sm text-ink-soft">Sem câmera? Digite este código no aplicativo:</p>
          <p id="totp-secret" className="break-all rounded-xl bg-surface-muted px-3 py-2 font-mono text-sm tracking-wider text-ink">{secret}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">Conta: {account}. Tipo: baseado em tempo.</p>
        </div>
      </div>
      <CodeFields state={state} submit={submit} pending={pending} label="Código do aplicativo (6 números)" button="Confirmar e ligar" pendingLabel="Conferindo o código…" />
    </div>
  );
}

function CodeFields({ state, submit, pending, label, hint, button, pendingLabel, kind = "app", variant = "primary" }: FormText & { state: CodeState; submit: (formData: FormData) => void; pending: boolean }) {
  const id = useId();
  return (
    <form action={submit} className="grid max-w-sm gap-3">
      <div>
        <label htmlFor={`${id}-code`} className={labelCls}>{label}</label>
        {hint ? <p id={`${id}-hint`} className={hintCls}>{hint}</p> : null}
        <input
          id={`${id}-code`}
          name="code"
          required
          autoComplete="one-time-code"
          inputMode={kind === "app" ? "numeric" : "text"}
          maxLength={kind === "app" ? 7 : 12}
          placeholder={kind === "app" ? "000000" : "XXXX-XXXX"}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={state.error ? true : undefined}
          className={`${inputCls} font-mono tracking-widest`}
        />
      </div>
      {state.error ? <p role="alert" className="text-sm font-medium text-coral">{state.error}</p> : null}
      <div>
        <button type="submit" disabled={pending} className={BUTTON_CLS[variant]}>
          <KeyRound size={16} aria-hidden /> {pending ? pendingLabel : button}
        </button>
      </div>
    </form>
  );
}

// Códigos de recuperação, mostrados uma vez: cada um vale uma entrada sem o celular.
function RecoveryCodes({ codes, finish }: { codes: string[]; finish: "refresh" | "enter" }) {
  const router = useRouter();
  return (
    <div className="grid gap-4" role="status">
      <p className="flex items-start gap-2 text-sm font-medium text-ink">
        <ShieldCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-green" />
        Pronto. Guarde estes códigos de recuperação em lugar seguro (anote ou imprima).
      </p>
      <p className="text-sm leading-relaxed text-ink-soft">
        Cada código vale uma entrada, se você estiver sem o celular. Eles não aparecem de novo: se perder, gere novos em Segurança da conta (no menu com o seu nome).
      </p>
      <ul aria-label="Códigos de recuperação" className="grid max-w-sm grid-cols-2 gap-2">
        {codes.map((code) => (
          <li key={code} className="rounded-xl bg-surface-muted px-3 py-2 text-center font-mono text-sm tracking-widest text-ink">{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 print:hidden">
        <PrintButton label="Imprimir os códigos" />
        {finish === "enter" ? (
          <form action={finishSecondStepSetup}>
            <button type="submit" className={BUTTON_CLS.primary}>Já guardei: entrar na plataforma</button>
          </form>
        ) : (
          <button type="button" onClick={() => router.refresh()} className={BUTTON_CLS.primary}>Já guardei os códigos</button>
        )}
      </div>
    </div>
  );
}
