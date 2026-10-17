"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand-strong"
    >
      <Printer size={13} aria-hidden /> {label}
    </button>
  );
}
