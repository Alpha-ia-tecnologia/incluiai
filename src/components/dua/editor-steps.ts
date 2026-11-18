import type { DuaContent } from "@/lib/dua/domain";

export type StepProps = { content: DuaContent; update: (next: DuaContent) => void; readOnly: boolean };

export const EDITOR_STEPS: readonly { label: string; fields: readonly (keyof DuaContent)[] }[] = [
  { label: "Objetivo e evidência", fields: ["title", "objective", "criteria"] },
  { label: "Contexto e barreiras", fields: ["context", "barriers"] },
  { label: "Opções e apoios", fields: ["strategies"] },
  { label: "Revisão para aplicação", fields: ["followUp"] },
];

export const stepOfField = (field: string) => Math.max(0, EDITOR_STEPS.findIndex((step) => step.fields.some((key) => field === key || field.startsWith(`${key}.`))));

export const STEP_PARAM = "etapa";
export const stepFromParam = (value: string | undefined) => Math.min(EDITOR_STEPS.length - 1, Math.max(0, Math.trunc(Number(value ?? 1)) - 1 || 0));
export const stepToParam = (step: number) => String(step + 1);

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
