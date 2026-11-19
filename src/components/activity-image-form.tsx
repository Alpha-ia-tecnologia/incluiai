"use client";

import { useActionState } from "react";
import { ImagePlus } from "lucide-react";
import { ChoiceField } from "@/components/choice-field";
import { PendingButton } from "@/components/pending-button";
import { FormResult } from "@/components/form-kit";
import { BUTTON_CLS } from "@/components/form-styles";
import { IMAGE_KINDS } from "@/lib/images/activity-image";
import type { ActionResult } from "@/lib/action-result";

export function ActivityImageForm({ action, hasImage }: {
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  hasImage: boolean;
}) {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        <ChoiceField
          name="kind"
          label="Tipo de imagem"
          options={[...IMAGE_KINDS]}
          defaultValue="sequencia"
          required
          otherPlaceholder="Descreva a imagem, sem nomes nem dados pessoais"
          labelClassName="mb-1 block text-sm font-medium text-ink-soft"
          inputClassName="min-h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="contents">
        <PendingButton className={BUTTON_CLS.secondary} pendingText="A OpenAI está desenhando a imagem." wait="imagem">
          <ImagePlus size={16} aria-hidden /> {hasImage ? "Gerar outra imagem" : "Gerar imagem de apoio"}
        </PendingButton>
      </div>
      <div className={result?.ok === false ? "basis-full" : "contents"}><FormResult result={result} /></div>
    </form>
  );
}
