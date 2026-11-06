"use client";

import { useActionState, useState } from "react";
import { FileUp } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import { choiceCls, hintCls, inputCls, labelCls, primaryButtonCls } from "@/components/form-styles";
import { MAX_REPORT_BYTES, MAX_REPORT_MB } from "@/lib/health-report";
import type { UploadState } from "@/actions/health-reports";

// Envio do laudo. O tamanho é conferido aqui antes do envio (acima do limite
// a requisição nem chega à ação) e de novo no servidor, com o tipo real.
export function HealthReportUpload({ action }: { action: (state: UploadState, formData: FormData) => Promise<UploadState> }) {
  const [state, formAction] = useActionState(action, {});
  const [tooBig, setTooBig] = useState(false);
  const error = tooBig ? `O arquivo tem mais de ${MAX_REPORT_MB} MB. Envie uma versão menor.` : state.error;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="laudo-arquivo" className={labelCls}>Arquivo do laudo</label>
        <p id="laudo-arquivo-dica" className={hintCls}>PDF, JPG ou PNG, até {MAX_REPORT_MB} MB. A IA lê PDFs com texto; foto e PDF escaneado ficam guardados para consulta.</p>
        <input
          id="laudo-arquivo" name="arquivo" type="file" required
          accept="application/pdf,image/jpeg,image/png"
          aria-describedby="laudo-arquivo-dica"
          aria-invalid={error ? true : undefined}
          onChange={(event) => setTooBig((event.currentTarget.files?.[0]?.size ?? 0) > MAX_REPORT_BYTES)}
          className={`${inputCls} py-2 file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-medium file:text-brand-strong`}
        />
      </div>
      <label className={`${choiceCls} leading-relaxed`}>
        <input type="checkbox" name="familiaEntregou" required className="size-5 shrink-0 accent-[var(--brand)]" />
        <span>A família entregou este documento à escola e sabe que ele fica guardado no acompanhamento do estudante.</span>
      </label>
      {error ? <p role="alert" className="text-sm font-medium text-coral">{error}</p> : null}
      <div>
        <PendingButton className={primaryButtonCls} pendingText="Guardando e lendo o laudo. Pode levar até um minuto." disabled={tooBig}>
          <FileUp size={16} aria-hidden /> Anexar e ler o laudo
        </PendingButton>
      </div>
    </form>
  );
}
