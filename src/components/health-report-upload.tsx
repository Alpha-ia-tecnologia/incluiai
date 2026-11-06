"use client";

import { useActionState, useState } from "react";
import { FileUp } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import { MAX_REPORT_BYTES, MAX_REPORT_MB } from "@/lib/health-report";
import type { UploadState } from "@/actions/health-reports";

// Envio do laudo. O tamanho é conferido aqui antes do envio (acima do limite
// a requisição nem chega à ação) e de novo no servidor, com o tipo real.
export function HealthReportUpload({ action }: { action: (state: UploadState, formData: FormData) => Promise<UploadState> }) {
  const [state, formAction] = useActionState(action, {});
  const [tooBig, setTooBig] = useState(false);
  const error = tooBig ? `O arquivo tem mais de ${MAX_REPORT_MB} MB. Envie uma versão menor.` : state.error;

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="arquivo" className="mb-2 block text-sm font-bold text-ink">Arquivo do laudo</label>
        <input
          id="arquivo" name="arquivo" type="file" required
          accept="application/pdf,image/jpeg,image/png"
          aria-describedby="arquivo-ajuda"
          aria-invalid={error ? true : undefined}
          onChange={(event) => setTooBig((event.currentTarget.files?.[0]?.size ?? 0) > MAX_REPORT_BYTES)}
          className="block w-full min-w-0 rounded-lg border border-line bg-paper-raised p-2 text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-bold file:text-pen hover:file:bg-brand-soft-hover"
        />
        <p id="arquivo-ajuda" className="mt-2 text-sm text-ink-soft">PDF, JPG ou PNG, até {MAX_REPORT_MB} MB. A IA lê PDFs com texto; foto e PDF escaneado ficam guardados para consulta.</p>
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink">
        <input type="checkbox" name="familiaEntregou" required className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" />
        A família entregou este documento à escola e sabe que ele fica guardado no acompanhamento do estudante.
      </label>
      {error ? <p role="alert" className="text-sm font-bold text-coral">{error}</p> : null}
      <div>
        <PendingButton className="task-action" pendingText="Guardando e lendo o laudo. Pode levar até um minuto." disabled={tooBig}>
          <FileUp size={16} aria-hidden /> Anexar e ler o laudo
        </PendingButton>
      </div>
    </form>
  );
}
