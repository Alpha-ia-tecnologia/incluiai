"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { login } from "@/actions/auth";

const inputCls = "w-full rounded-2xl border border-line bg-paper-raised py-3.5 pl-11 pr-4 text-sm text-ink transition-colors hover:border-ink/25 focus:border-ink";
const labelCls = "mb-2 block text-xs font-medium text-ink";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full">
      <form action={action} className="space-y-5" aria-label="Entrar na plataforma">
        <div>
          <label htmlFor="email" className={labelCls}>E-mail</label>
          <div className="relative">
            <Mail size={17} strokeWidth={1.6} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            {/* A chave recria o campo com o e-mail devolvido após um erro. */}
            <input key={state.email ?? ""} id="email" name="email" type="email" required autoComplete="username" defaultValue={state.email ?? ""} placeholder="Seu e-mail de acesso" aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "login-erro" : undefined} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>Senha</label>
          <div className="relative">
            <LockKeyhole size={17} strokeWidth={1.6} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <input id="password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Sua senha" aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "login-erro" : undefined} className={`${inputCls} !pr-14`} />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-pressed={showPassword}
              aria-controls="password"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-soft hover:bg-surface-muted hover:text-ink"
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {state.error ? <p id="login-erro" className="rounded-xl bg-coral-soft px-4 py-3 text-sm text-coral" role="alert">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="flex w-full items-center justify-between rounded-full bg-brand px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">
          <span>{pending ? "Entrando…" : "Entrar na plataforma"}</span>
          {pending ? <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight size={18} strokeWidth={1.6} aria-hidden="true" />}
        </button>
      </form>
      <details className="mt-4 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-brand-strong underline-offset-4 hover:underline">Esqueci minha senha</summary>
        <p className="mt-1 leading-relaxed text-ink-soft">
          Fale com a coordenação da sua escola para trocar a senha. Famílias e terapeutas podem pedir à escola do estudante. Por segurança, a plataforma não envia senhas por e-mail.
        </p>
      </details>
    </div>
  );
}
