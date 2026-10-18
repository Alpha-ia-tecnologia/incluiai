"use client";

import { useActionState } from "react";
import { ImagePlus, Send } from "lucide-react";
import { generateMaterialImagesAction, sendMaterialActivity, type MaterialActionState } from "@/actions/materials";
import { PendingButton } from "@/components/pending-button";
import { quietButtonCls as secondaryCls } from "@/components/form-styles";


function Result({ state }: { state: MaterialActionState }) {
  if (state.status === "idle") return <span role="status" aria-live="polite" className="sr-only" />;
  return (
    <span role={state.status === "erro" ? "alert" : "status"} className={`basis-full text-xs ${state.status === "erro" ? "text-coral" : "text-green"}`}>
      {state.message}
    </span>
  );
}

// Gera os pictogramas que faltam (um por cartão, até 12).
export function MaterialImagesButton({ studentId, materialId, missing }: { studentId: string; materialId: string; missing: number }) {
  const [state, action] = useActionState<MaterialActionState>(generateMaterialImagesAction.bind(null, studentId, materialId), { status: "idle" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 print:hidden">
      <PendingButton className={secondaryCls} pendingText="Desenhando os pictogramas dos cartões." wait="imagem">
        <ImagePlus size={16} aria-hidden /> {missing > 1 ? `Desenhar ${missing} imagens` : "Desenhar a imagem"}
      </PendingButton>
      <Result state={state} />
    </form>
  );
}

// Leva uma atividade do material para as Atividades do estudante, como sugerida.
export function SendActivityButton({ studentId, materialId, index, title }: { studentId: string; materialId: string; index: number; title: string }) {
  const [state, action] = useActionState<MaterialActionState>(sendMaterialActivity.bind(null, studentId, materialId, index), { status: "idle" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 print:hidden">
      <PendingButton className={secondaryCls} pendingText="Levando a atividade…" disabled={state.status === "ok"}>
        <Send size={16} aria-hidden /> {state.status === "ok" ? "Já está em Atividades" : <>Levar para Atividades<span className="sr-only">: {title}</span></>}
      </PendingButton>
      <Result state={state} />
    </form>
  );
}
