"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Trash2 } from "lucide-react";

function ConfirmButton({ label, buttonRef }: { label: string; buttonRef: React.RefObject<HTMLButtonElement | null> }) {
  const { pending } = useFormStatus();
  return (
    <button ref={buttonRef} type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-70">
      {pending ? <><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden /> Excluindo…</> : label}
    </button>
  );
}

// Exclusão em dois passos, na própria linha: o primeiro toque pergunta, o
// segundo exclui. Esc ou Cancelar desistem e devolvem o foco ao botão.
export function ConfirmDelete({ action, question, confirmLabel, triggerLabel = "Excluir", triggerAriaLabel }: {
  action: () => Promise<void>;
  question: string;
  confirmLabel: string;
  triggerLabel?: string;
  triggerAriaLabel?: string;
}) {
  const [asking, setAsking] = useState(false);
  const opened = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) confirmRef.current?.focus();
    else if (opened.current) triggerRef.current?.focus();
    opened.current = asking || opened.current;
  }, [asking]);

  if (!asking) {
    return (
      <button ref={triggerRef} type="button" onClick={() => setAsking(true)} aria-label={triggerAriaLabel} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink-soft hover:bg-coral-soft hover:text-coral">
        <Trash2 size={15} aria-hidden /> {triggerLabel}
      </button>
    );
  }
  return (
    <form
      action={action}
      role="group"
      aria-label={question}
      onKeyDown={(event) => { if (event.key === "Escape") setAsking(false); }}
      className="flex flex-wrap items-center gap-2 rounded-2xl bg-coral-soft px-3 py-2"
    >
      <span className="text-sm text-ink">{question}</span>
      <ConfirmButton label={confirmLabel} buttonRef={confirmRef} />
      <button type="button" onClick={() => setAsking(false)} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-ink hover:bg-paper-raised">Cancelar</button>
    </form>
  );
}
