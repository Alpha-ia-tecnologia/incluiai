"use client";

import { Printer } from "lucide-react";
import { BUTTON_CLS } from "@/components/form-styles";

export function PrintButton({ label = "Imprimir", className = BUTTON_CLS.quiet }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      <Printer size={16} aria-hidden /> {label}
    </button>
  );
}
