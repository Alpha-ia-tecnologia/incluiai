"use client";

import { useActionState, useState } from "react";
import { FileUp } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import { Field, FormResult } from "@/components/form-kit";
import { choiceCls, inputCls, BUTTON_CLS } from "@/components/form-styles";
import type { ActionResult } from "@/lib/action-result";
import { REPORT_UPLOAD } from "@/lib/health-report";
import { megabytes } from "@/lib/uploads";

// Acima do limite a requisição nem chega à ação.
export function HealthReportUpload({ action }: { action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult> }) {
  const [result, formAction] = useActionState(action, null);
  const [tooBig, setTooBig] = useState(false);
  const shown: ActionResult | null = tooBig ? { ok: false, message: REPORT_UPLOAD.tooLarge } : result;

  return (
    <form action={formAction} className="space-y-4">
      <Field id="laudo-arquivo" label="Arquivo do laudo" hint={`PDF, JPG ou PNG, até ${megabytes(REPORT_UPLOAD.maxBytes)} MB. A IA lê PDFs com texto; foto e PDF escaneado ficam guardados para consulta.`}>
        {(control) => (
          <input
            {...control} name="arquivo" type="file" required
            accept="application/pdf,image/jpeg,image/png"
            aria-invalid={shown && !shown.ok ? true : undefined}
            onChange={(event) => setTooBig((event.currentTarget.files?.[0]?.size ?? 0) > REPORT_UPLOAD.maxBytes)}
            className={`${inputCls} py-2 file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-medium file:text-brand-strong`}
          />
        )}
      </Field>
      <label className={`${choiceCls} leading-relaxed`}>
        <input type="checkbox" name="familiaEntregou" required className="size-5 shrink-0 accent-[var(--brand)]" />
        <span>A família entregou este documento à escola e sabe que ele fica guardado no acompanhamento do estudante.</span>
      </label>
      <FormResult result={shown} />
      <div>
        <PendingButton className={BUTTON_CLS.primary} pendingText="Guardando e lendo o laudo. Pode levar até um minuto." disabled={tooBig}>
          <FileUp size={16} aria-hidden /> Anexar e ler o laudo
        </PendingButton>
      </div>
    </form>
  );
}
