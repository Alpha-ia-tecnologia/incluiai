import type { ReactNode, Ref } from "react";
import { CircleAlert, Sprout } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { hintCls, labelCls } from "@/components/form-styles";

type FieldControl = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

export const errorIdOf = (id: string) => `${id}-erro`;

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-coral">
      <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function Field({ id, label, note, hint, error, children }: { id: string; label: ReactNode; note?: string; hint?: ReactNode; error?: string; children: (control: FieldControl) => ReactNode }) {
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? errorIdOf(id) : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{label}{note ? <span className="font-normal text-ink-soft"> ({note})</span> : null}</label>
      {hint ? <p id={hintId} className={hintCls}>{hint}</p> : null}
      {children({ id, "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}) })}
      {error && errorId ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function FormResult({ result, success, fields, ref }: { result: ActionResult<unknown> | null; success?: string; fields?: Record<string, string>; ref?: Ref<HTMLDivElement> }) {
  const message = result?.ok ? result.message ?? success : undefined;
  if (!result || (result.ok && !message)) return <p role="status" aria-live="polite" className="sr-only" />;
  if (result.ok) {
    return (
      <p role="status" aria-live="polite" className="mt-3 flex items-start gap-2 rounded-xl bg-green-soft px-3 py-2 text-sm text-green">
        <Sprout size={16} aria-hidden className="sprout-mark mt-0.5 shrink-0 text-green" />
        <span className="min-w-0">{message}</span>
      </p>
    );
  }
  return (
    <div ref={ref} tabIndex={ref ? -1 : undefined} role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral">
      <p className="font-medium">{result.message}</p>
      {result.problems?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {result.problems.map((problem) => {
            const target = fields?.[problem.field];
            return (
              <li key={`${problem.field}-${problem.message}`}>
                {target ? <a href={`#${target}`} className="block py-0.5 underline underline-offset-4">{problem.message}</a> : problem.message}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
