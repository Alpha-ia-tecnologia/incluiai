"use client";

import { useActionState } from "react";
import { ImagePlus, Send } from "lucide-react";
import { generateMaterialImagesAction, sendMaterialActivity } from "@/actions/materials";
import { PendingButton } from "@/components/pending-button";
import { FormResult } from "@/components/form-kit";
import { BUTTON_CLS } from "@/components/form-styles";

export function MaterialImagesButton({ studentId, materialId, missing }: { studentId: string; materialId: string; missing: number }) {
  const [result, action] = useActionState(generateMaterialImagesAction.bind(null, studentId, materialId), null);
  const done = result?.ok ? result.value : null;
  const message = done ? (done.created ? `${done.created} imagem(ns) prontas.${done.errors.length ? ` ${done.errors[0]}` : ""}` : "Todas as imagens já estavam prontas.") : undefined;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 print:hidden">
      <PendingButton className={BUTTON_CLS.quiet} pendingText="Desenhando os pictogramas dos cartões." wait="imagem">
        <ImagePlus size={16} aria-hidden /> {missing > 1 ? `Desenhar ${missing} imagens` : "Desenhar a imagem"}
      </PendingButton>
      <div className={result ? "basis-full" : "contents"}><FormResult result={result} success={message} /></div>
    </form>
  );
}

export function SendActivityButton({ studentId, materialId, index, title }: { studentId: string; materialId: string; index: number; title: string }) {
  const [result, action] = useActionState(sendMaterialActivity.bind(null, studentId, materialId, index), null);
  const sent = Boolean(result?.ok);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 print:hidden">
      <PendingButton className={BUTTON_CLS.quiet} pendingText="Levando a atividade…" disabled={sent}>
        <Send size={16} aria-hidden /> {sent ? "Já está em Atividades" : <>Levar para Atividades<span className="sr-only">: {title}</span></>}
      </PendingButton>
      <div className={result ? "basis-full" : "contents"}><FormResult result={result} success="Atividade levada para Atividades, como sugestão para aceitar." /></div>
    </form>
  );
}
