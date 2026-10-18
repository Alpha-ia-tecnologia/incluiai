"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";

// Aviso de material recém-criado. A pessoa chega à página do material pelo
// redirect do formulário, e o botão que tinha o foco ficou na galeria: o foco
// vem para o aviso, para quem usa teclado ou leitor de tela saber que deu certo.
export function CreatedNotice({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="mb-4 flex min-w-0 items-start gap-2 rounded-xl bg-green-soft px-4 py-3 text-sm text-green outline-none print:hidden">
      <CircleCheck size={16} aria-hidden className="mt-0.5 shrink-0" />
      <p className="min-w-0">{children}</p>
    </div>
  );
}
