"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { GardenWait, type InlineScene } from "@/components/garden-wait/garden-wait";
import { inlineCaption } from "@/lib/assistant/garden-scenes";

// Botão de envio que mostra o andamento de ações demoradas (ex.: agentes de IA).
// Com `wait`, a espera vira o canteiro (sem spinner). O status fica sempre
// montado e é escrito por referência: começa com pendingText e o tempo
// habitual (o mesmo do cartão) e depois só recebe o aviso de demora.
//
// O canteiro fica na mesma árvore do formulário. O App Router usa o React que
// vem com o Next (next/dist/compiled/react-dom), em que atualizações de estado
// dentro de um <form> pendente não reiniciam o useFormStatus; o e2e (seção 7)
// confere que o botão continua ocupado enquanto o canteiro se mexe.

// Cartão de espera. Ao sair (a ação terminou), anota se o foco de teclado
// estava nele: a limpeza do efeito de layout roda antes de o cartão deixar o
// documento. Foco por clique não conta, para o Espaço seguinte não reenviar a
// ação sem querer.
function WaitCard({ keyboardFocus, children }: { keyboardFocus: RefObject<boolean>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const card = ref.current;
    return () => {
      const active = document.activeElement;
      keyboardFocus.current = Boolean(card && active instanceof HTMLElement && card.contains(active) && active.matches(":focus-visible"));
    };
  }, [keyboardFocus]);
  // basis-full: dentro de formulários em linha (flex), o cartão ocupa uma linha só dele.
  return <div ref={ref} className="basis-full">{children}</div>;
}

export function PendingButton({ children, pendingText, className = "", disabled = false, wait }: {
  children: ReactNode;
  pendingText: string;
  className?: string;
  disabled?: boolean;
  wait?: InlineScene;
}) {
  const { pending, data } = useFormStatus();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusInCard = useRef(false);
  const withImages = data?.get("gerarImagens") === "on";
  const announce = useCallback((text: string) => {
    if (statusRef.current && text) statusRef.current.textContent = text;
  }, []);
  useEffect(() => {
    if (!wait || !statusRef.current) return;
    statusRef.current.textContent = pending ? `${pendingText} ${inlineCaption(wait, 0, withImages).time}` : "";
  }, [pending, pendingText, wait, withImages]);
  // O cartão some quando a ação termina: quem estava nele pelo teclado (regar,
  // pausar) volta ao botão, já liberado, em vez de cair no início da página.
  useEffect(() => {
    if (pending || !focusInCard.current) return;
    focusInCard.current = false;
    const active = document.activeElement;
    const button = buttonRef.current;
    if ((!active || active === document.body) && button?.isConnected && !button.disabled) button.focus({ preventScroll: true });
  }, [pending]);
  return (
    <>
      <button ref={buttonRef} type="submit" disabled={pending || disabled} aria-busy={pending} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
        {pending && !wait ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
      {wait ? (
        <>
          <p ref={statusRef} role="status" aria-live="polite" className="sr-only" data-testid="pending-status" />
          {pending ? (
            <WaitCard keyboardFocus={focusInCard}>
              <GardenWait variant="inline" scene={wait} withImages={withImages} announce={announce} />
            </WaitCard>
          ) : null}
        </>
      ) : (
        <p role="status" aria-live="polite" className={pending ? "mt-2 text-sm text-ink-soft" : "sr-only"} data-testid="pending-status">
          {pending ? pendingText : ""}
        </p>
      )}
    </>
  );
}
