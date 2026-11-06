"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

// Falha ao abrir ou salvar uma página do app. Em produção a mensagem do servidor
// não chega aqui (só o código), então o texto diz o que fazer, não o que falhou.
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section aria-labelledby="erro-titulo" className="mx-auto max-w-xl py-14">
      <h1 id="erro-titulo" className="font-display text-3xl leading-tight text-ink sm:text-4xl">Não foi possível concluir</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
        Algo falhou ao abrir ou salvar esta página. Se você estava enviando um formulário, confira se as informações ficaram registradas antes de enviar de novo.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => unstable_retry()} className="task-action"><RotateCcw size={16} aria-hidden /> Tentar de novo</button>
        <Link href="/" className="task-action task-action-secondary">Voltar ao início</Link>
      </div>
      <p className="mt-8 text-xs leading-relaxed text-ink-soft">
        Se continuar acontecendo, fale com a coordenação da escola{error.digest ? <> e informe o código <span className="font-mono">{error.digest}</span></> : null}.
      </p>
    </section>
  );
}
