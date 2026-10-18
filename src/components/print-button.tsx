"use client";

import { Printer } from "lucide-react";
import { quietButtonCls } from "@/components/form-styles";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={quietButtonCls}
    >
      <Printer size={16} aria-hidden /> {label}
    </button>
  );
}
