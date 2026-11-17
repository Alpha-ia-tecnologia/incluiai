"use client";

import { Printer } from "lucide-react";
import { BUTTON_CLS } from "@/components/form-styles";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={BUTTON_CLS.quiet}
    >
      <Printer size={16} aria-hidden /> {label}
    </button>
  );
}
