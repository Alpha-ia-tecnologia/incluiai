"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { login } from "@/actions/auth";
import { FormResult } from "@/components/form-kit";

const inputCls = "w-full rounded-2xl border border-line bg-paper-raised py-3.5 pl-11 pr-4 text-sm text-ink transition-colors hover:border-ink/25 focus:border-ink";
const labelCls = "mb-2 block text-sm font-medium text-ink";

export function LoginForm() {
  const [result, action, pending] = useActionState(login, null);
  const [email, setEmail] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result && !result.ok) passwordRef.current?.focus();
  }, [result]);

  return (
    <div className="w-full">
      <form action={action} className="space-y-5" aria-label="Entrar na plataforma">
        <div>
          <label htmlFor="email" className={labelCls}>E-mail</label>
          <div className="relative">
            <Mail size={17} strokeWidth={1.6} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <input id="email" name="email" type="email" required autoComplete="username" placeholder="Seu e-mail de acesso" value={email} onChange={(event) => setEmail(event.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>Senha</label>
          <div className="relative">
            <LockKeyhole size={17} strokeWidth={1.6} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <input ref={passwordRef} id="password" name="password" type="password" required autoComplete="current-password" placeholder="Sua senha" className={inputCls} />
          </div>
        </div>
        <FormResult result={result} />
        <button type="submit" disabled={pending} className="flex w-full items-center justify-between rounded-full bg-brand px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60">
          <span>{pending ? "Entrando…" : "Entrar na plataforma"}</span>
          {pending ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={18} strokeWidth={1.6} aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}
