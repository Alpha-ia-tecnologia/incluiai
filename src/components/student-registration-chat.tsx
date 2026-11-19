"use client";

import { useMemo } from "react";
import { Pencil } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { firstName } from "@/lib/format";
import { STUDENT_FIELDS, type SchoolChoice } from "@/lib/student-record";
import { ChatAnswerControl, ChatError, ChatFooter, ChatHeader, ChatQuestion, ChatResetConfirm, ChatReview, useGuidedChat } from "@/components/guided-chat";

const SECTIONS = [...new Set(STUDENT_FIELDS.map((field) => field.section))].map((title) => ({ title }));

export function StudentRegistrationChat({ schools, action }: { schools: SchoolChoice[]; action: (formData: FormData) => Promise<ActionResult> }) {
  const context = useMemo(() => ({ schools }), [schools]);
  const chat = useGuidedChat({ fields: STUDENT_FIELDS, context, save: action, failure: "Não foi possível salvar agora. Confira os dados e tente novamente." });
  const total = STUDENT_FIELDS.length;
  const position = chat.done ? total : STUDENT_FIELDS.indexOf(chat.current);
  const name = typeof chat.answers.name === "string" ? firstName(chat.answers.name.trim()) : "";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-e2">
        <ChatHeader
          title="Assistente de cadastro"
          badge="Conversa guiada"
          subtitle={<p className="text-sm text-ink-soft">Uma pergunta por vez. Você revisa tudo antes de salvar.</p>}
          counter={<span className="shrink-0 text-sm tabular-nums text-ink-soft">{chat.done ? "Resumo" : `${position + 1} de ${total}`}</span>}
          progress={chat.done ? 100 : Math.round((position / total) * 100)}
        />

        {!chat.done ? (
          <>
            <div className="min-h-[28rem] px-5 py-7 sm:px-8">
              <div className="mx-auto max-w-2xl" aria-live="polite">
                {chat.editing ? (
                  <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-xs font-medium text-amber">
                    <Pencil size={12} aria-hidden /> Editando uma informação
                  </p>
                ) : null}
                <ChatQuestion field={chat.current} />
                <div className="mt-6 sm:pl-13"><ChatAnswerControl key={chat.current.key} chat={chat} context={context} /></div>
                <ChatError error={chat.error} />
              </div>
            </div>
            <ChatFooter chat={chat} resetLabel={Object.keys(chat.answers).length ? "Recomeçar" : null} />
          </>
        ) : (
          <ChatReview
            chat={chat}
            fields={STUDENT_FIELDS}
            context={context}
            sections={SECTIONS}
            empty="Não informado"
            title="Cadastro pronto para revisão"
            text={`Confira o resumo de ${name || "o estudante"}. Nada foi salvo ainda.`}
            saveLabel="Salvar no prontuário"
            resetLabel="Excluir informações"
          />
        )}
      </div>

      <p className="mt-4 text-center text-sm leading-relaxed text-ink-soft">
        As informações são usadas para o acompanhamento pedagógico e ficam protegidas pelo controle de acesso da plataforma.
      </p>
      <ChatResetConfirm chat={chat} text="Excluir todas as respostas e recomeçar?" confirmLabel="Excluir rascunho" />
    </div>
  );
}
