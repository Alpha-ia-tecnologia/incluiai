"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import { CreatedNotice } from "@/components/created-notice";
import { Assurances } from "@/components/explain";
import { ChatAnswerControl, ChatError, ChatFooter, ChatHeader, ChatQuestion, ChatResetConfirm, ChatReview, useGuidedChat } from "@/components/guided-chat";
import type { ActionResult } from "@/lib/action-result";
import { PROFILE_FIELDS, PROFILE_SECTIONS } from "@/lib/functional-profile";
import { answerText, type ChatAnswers } from "@/lib/guided-chat";

const NOT_SEEN = "Ainda não observado";
const answeredIn = (answers: ChatAnswers, key: string) => Object.prototype.hasOwnProperty.call(answers, key);

export function ProfileChat({
  action,
  firstName,
  initialAnswers = {},
  hasSavedProfile = false,
  savedAt = null,
}: {
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  firstName: string;
  initialAnswers?: ChatAnswers;
  hasSavedProfile?: boolean;
  savedAt?: string | null;
}) {
  const fields = useMemo(() => PROFILE_FIELDS.map((field) => ({ ...field, question: field.question.replaceAll("{nome}", firstName) })), [firstName]);
  const [dismissedSave, setDismissedSave] = useState<string | null>(null);
  const chat = useGuidedChat({
    fields,
    context: undefined,
    initialAnswers,
    startAtReview: hasSavedProfile,
    save: (formData) => action(null, formData),
    failure: "Não foi possível salvar o perfil. Revise as respostas e tente novamente.",
    onChange: () => setDismissedSave(savedAt),
  });
  const conversationRef = useRef<HTMLDivElement>(null);
  const { current, done } = chat;
  const savedNotice = savedAt && dismissedSave !== savedAt ? savedAt : null;
  const sectionIndex = Math.max(0, PROFILE_SECTIONS.findIndex((section) => section.title === current.section));
  const progress = done ? 100 : Math.round((chat.answered / fields.length) * 100);
  const recentAnswered = fields.slice(0, chat.index).filter((field) => answeredIn(chat.answers, field.key)).slice(-2);

  useEffect(() => {
    if (done) return;
    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      conversationRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current.key, done]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-e2">
        <ChatHeader
          title="Perfil guiado"
          badge={done ? "Pronto para revisar" : "Conversa guiada"}
          done={done}
          subtitle={<Assurances className="mt-1.5" label={`O que registrar sobre ${firstName}`} items={[{ icon: ShieldCheck, text: "Sem informações de diagnóstico" }]} />}
          counter={(
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-ink">{progress}%</p>
              <p className="text-sm tabular-nums text-ink-soft">{chat.answered} de {fields.length}</p>
            </div>
          )}
          progress={progress}
        />

        {!done ? (
          <div className="grid min-h-[36rem] lg:grid-cols-[13rem_1fr]">
            {/* Lista de etapas sem marco próprio: um <aside> dentro do <main> seria um marco aninhado. */}
            <div className="hidden border-r border-line bg-paper/60 p-4 lg:block">
              <p className="mb-3 text-sm font-semibold text-ink">Etapas do perfil</p>
              <ol className="space-y-1">
                {PROFILE_SECTIONS.map((section, index) => {
                  const completed = fields.filter((field) => field.section === section.title).every((field) => answeredIn(chat.answers, field.key));
                  const active = section.title === current.section;
                  return (
                    <li key={section.title} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm ${active ? "bg-brand-soft font-semibold text-brand-strong" : "text-ink-soft"}`}>
                      <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${completed ? "bg-green text-white" : active ? "bg-brand text-white" : "bg-line/70"}`}>
                        {completed ? <Check size={11} aria-hidden /> : index + 1}
                      </span>
                      {section.title}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div ref={conversationRef} className="flex min-w-0 scroll-mt-4 flex-col">
              <div className="border-b border-line/70 px-5 py-3 sm:px-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {current.section} <span className="font-normal tabular-nums text-ink-soft">· etapa {sectionIndex + 1} de {PROFILE_SECTIONS.length}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">{PROFILE_SECTIONS[sectionIndex].description}</p>
                  </div>
                  {chat.editing ? <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber">Editando</span> : null}
                </div>
              </div>

              <div className="flex-1 px-5 py-6 sm:px-8">
                <div className="mx-auto max-w-3xl">
                  {recentAnswered.length > 0 && !chat.editing ? (
                    <div className="mb-5 hidden space-y-2 border-b border-line/60 pb-5 sm:block">
                      {recentAnswered.map((field) => (
                        <div key={field.key} className="flex justify-end">
                          <button type="button" onClick={() => chat.edit(field)} className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-soft px-3.5 py-2 text-left text-sm text-brand-strong hover:ring-1 hover:ring-brand/30">
                            <span className="block text-sm font-semibold opacity-70">{field.label}</span>
                            {answerText(field, chat.answers, undefined, NOT_SEEN)}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <ChatQuestion field={current} />
                  <div className="mt-6 sm:pl-13"><ChatAnswerControl key={current.key} chat={chat} context={undefined} /></div>
                  <ChatError error={chat.error} />
                </div>
              </div>

              <ChatFooter chat={chat} resetLabel={hasSavedProfile ? "Restaurar dados salvos" : "Recomeçar"} />
            </div>
          </div>
        ) : (
          <ChatReview
            chat={chat}
            fields={fields}
            context={undefined}
            sections={PROFILE_SECTIONS}
            empty={NOT_SEEN}
            title="Perfil pronto para revisão"
            text={`Confira as respostas sobre ${firstName} antes de salvar.`}
            notice={savedNotice && !chat.error && !chat.pending ? <div className="mt-5"><CreatedNotice key={savedNotice}>Perfil salvo.</CreatedNotice></div> : null}
            saveLabel="Salvar perfil educacional"
            resetLabel="Descartar alterações"
          />
        )}
      </div>

      <Assurances
        className="mt-4 justify-center"
        label="Ao preencher o perfil"
        items={[
          { icon: Eye, text: "Observações de vários momentos" },
          { icon: RefreshCw, text: "Revise sempre que algo mudar" },
        ]}
      />
      <ChatResetConfirm
        chat={chat}
        text={hasSavedProfile ? "Descartar as alterações e restaurar o último perfil salvo?" : "Excluir as respostas e começar novamente?"}
        confirmLabel="Confirmar"
      />
    </div>
  );
}
