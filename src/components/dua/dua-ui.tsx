import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { ORIGIN_LABEL, REVIEW_STATE_LABEL, type DuaOrigin, type ReviewState } from "@/lib/dua/domain";

// Peças visuais do planejamento com DUA, no padrão das telas do IncluiEdu
// (campos min-h-11, rótulos visíveis, lilás só em ação e marca).

export const inputCls = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";
export const textareaCls = `${inputCls} min-h-24 leading-relaxed`;
export const labelCls = "mb-2 block text-sm font-medium text-ink";
export const hintCls = "mb-2 text-xs leading-relaxed text-ink-soft";
export const buttonCls = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-60";
export const secondaryCls = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-paper-raised px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-60";
export const dangerCls = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-coral/40 bg-paper-raised px-4 py-2.5 text-sm font-medium text-coral hover:bg-coral-soft disabled:pointer-events-none disabled:opacity-60";
export const linkCls = "font-medium text-brand-strong underline underline-offset-4";

export function ReviewBadge({ state }: { state: ReviewState }) {
  const tone = state === "validado" ? "green" : state === "em_revisao" ? "amber" : "neutral";
  return <Badge tone={tone}>{REVIEW_STATE_LABEL[state]}</Badge>;
}

export function OriginBadge({ origin }: { origin: DuaOrigin }) {
  return <Badge tone={origin.kind === "ia" ? "brand" : "neutral"}>{ORIGIN_LABEL[origin.kind]}</Badge>;
}

// Mensagem do resultado de uma ação: sucesso anunciado com calma, erro com alerta.
export function ResultMessage({ result, id }: { result: { ok: boolean; message?: string; problems?: { field: string; message: string }[] } | null; id?: string }) {
  if (!result) return <p id={id} role="status" aria-live="polite" className="sr-only" />;
  if (result.ok) {
    return result.message ? <p id={id} role="status" aria-live="polite" className="mt-3 rounded-xl bg-green-soft px-3 py-2 text-sm text-green">{result.message}</p> : <p id={id} role="status" aria-live="polite" className="sr-only" />;
  }
  return (
    <div id={id} role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral">
      <p className="font-medium">{result.message}</p>
      {result.problems?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {result.problems.map((problem) => <li key={`${problem.field}-${problem.message}`}>{problem.message}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

export function Field({ id, label, hint, required, children }: { id: string; label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{label}{required ? <span className="font-normal text-ink-soft"> (obrigatório para validar)</span> : null}</label>
      {hint ? <p id={`${id}-dica`} className={hintCls}>{hint}</p> : null}
      {children}
    </div>
  );
}

// Lista de textos curtos editada como texto, um item por linha (sem arrastar).
export const linesToList = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
export const listToLines = (items: string[]) => items.join("\n");
