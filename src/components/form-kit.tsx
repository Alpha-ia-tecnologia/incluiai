import type { ReactNode } from "react";
import { Sprout } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { hintCls, labelCls } from "@/components/form-styles";

type FieldControl = { id: string; "aria-describedby"?: string };

export function Field({ id, label, note, hint, children }: { id: string; label: ReactNode; note?: string; hint?: ReactNode; children: (control: FieldControl) => ReactNode }) {
  const hintId = hint ? `${id}-dica` : undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{label}{note ? <span className="font-normal text-ink-soft"> ({note})</span> : null}</label>
      {hint ? <p id={hintId} className={hintCls}>{hint}</p> : null}
      {children({ id, "aria-describedby": hintId })}
    </div>
  );
}

export function FormResult({ result, success }: { result: ActionResult<unknown> | null; success?: string }) {
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
    <div role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral">
      <p className="font-medium">{result.message}</p>
      {result.problems?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {result.problems.map((problem) => <li key={`${problem.field}-${problem.message}`}>{problem.message}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
