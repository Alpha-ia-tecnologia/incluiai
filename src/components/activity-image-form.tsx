"use client";

import { useActionState } from "react";
import { ImagePlus } from "lucide-react";
import { ChoiceField } from "@/components/choice-field";
import { PendingButton } from "@/components/pending-button";
import { IMAGE_KINDS } from "@/lib/images/activity-image";
import type { ImageActionState } from "@/actions/activity-images";

// Pedido de imagem de apoio para uma atividade, com o tipo escolhido pelo professor.
export function ActivityImageForm({ action, hasImage }: {
  action: (previous: ImageActionState, formData: FormData) => Promise<ImageActionState>;
  hasImage: boolean;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" });
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
          labelClassName="mb-1 block text-xs font-medium text-ink-soft"
          inputClassName="min-h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="contents">
        <PendingButton
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-soft px-4 text-sm font-medium text-brand-strong hover:bg-lilac"
          pendingText="A OpenAI está desenhando a imagem."
          wait="imagem"
        >
          <ImagePlus size={16} aria-hidden /> {hasImage ? "Gerar outra imagem" : "Gerar imagem de apoio"}
        </PendingButton>
      </div>
      {state.status === "erro" ? <p role="alert" className="basis-full text-sm text-coral">{state.message}</p> : null}
    </form>
  );
}
