"use client";

import { useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ClipboardCheck, Pencil, RotateCcw, Save, Send } from "lucide-react";
import { Character } from "@/components/character";
import { BUTTON_CLS } from "@/components/form-styles";
import type { ActionResult } from "@/lib/action-result";
import { brDay } from "@/lib/dates";
import {
  answerText, chatFormData, chipsAnswer, draftsFor, firstMissing, isAnswered, optionsOf,
  type ChatAnswer, type ChatAnswers, type ChatField, type Drafts,
} from "@/lib/guided-chat";

const NO_DRAFTS: Drafts = { text: "", chips: [], otherOpen: false };

export function useGuidedChat<C>({ fields, context, initialAnswers = {}, startAtReview = false, save, failure, onChange }: {
  fields: readonly ChatField<C>[];
  context: C;
  initialAnswers?: ChatAnswers;
  startAtReview?: boolean;
  save: (formData: FormData) => Promise<ActionResult>;
  failure: string;
  onChange?: () => void;
}) {
  const indexOf = (field: ChatField<C> | undefined) => (field ? fields.indexOf(field) : fields.length);
  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(() => {
    const missing = firstMissing(fields, initialAnswers);
    return startAtReview ? fields.length : missing ? fields.indexOf(missing) : 0;
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts>(() => (startAtReview ? NO_DRAFTS : draftsFor(fields[index] ?? fields[0], initialAnswers, context)));
  const [error, setError] = useState("");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [pending, startTransition] = useTransition();

  const done = index >= fields.length && !editing;
  const current = fields.find((field) => field.key === editing) ?? fields[Math.min(index, fields.length - 1)];

  function open(field: ChatField<C> | undefined, next: ChatAnswers) {
    setDrafts(field ? draftsFor(field, next, context) : NO_DRAFTS);
    setError("");
  }

  function answer(raw: ChatAnswer) {
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (current.required && !isAnswered(value)) {
      setError("Esta resposta é necessária para continuar.");
      return;
    }
    const answered = { ...answers, [current.key]: value };
    const next = current.onAnswer?.(answered, answers, context) ?? answered;
    setAnswers(next);
    onChange?.();
    if (editing) {
      setEditing(null);
      setIndex(indexOf(firstMissing(fields, next)));
      open(undefined, next);
      return;
    }
    setIndex(index + 1);
    open(fields[index + 1], next);
  }

  function back() {
    if (editing) {
      setEditing(null);
      open(undefined, answers);
      return;
    }
    const previous = Math.max(0, index - 1);
    setIndex(previous);
    open(fields[previous], answers);
  }

  function edit(field: ChatField<C>) {
    setEditing(field.key);
    open(field, answers);
  }

  function reset() {
    const restored = startAtReview ? initialAnswers : {};
    setAnswers(restored);
    setEditing(null);
    setIndex(startAtReview ? fields.length : 0);
    setConfirmingReset(false);
    open(startAtReview ? undefined : fields[0], restored);
    onChange?.();
  }

  function submit() {
    const missing = firstMissing(fields, answers);
    if (missing) {
      setIndex(fields.indexOf(missing));
      open(missing, answers);
      setError(`Responda “${missing.label}” antes de salvar.`);
      return;
    }
    const formData = chatFormData(fields, answers);
    startTransition(async () => {
      try {
        setError("");
        const result = await save(formData);
        if (!result.ok) setError([result.message, ...(result.problems ?? []).map((problem) => problem.message)].join(" · "));
      } catch (caught) {
        // Quando a ação salva e redireciona, o redirecionamento chega aqui como erro interno do Next.
        unstable_rethrow(caught);
        setError(failure);
      }
    });
  }

  return {
    answers, index, current, done, editing, drafts, setDrafts, error, pending, confirmingReset,
    answered: fields.filter((field) => Object.prototype.hasOwnProperty.call(answers, field.key)).length,
    answer, back, edit, submit, reset, askReset: () => setConfirmingReset(true), cancelReset: () => setConfirmingReset(false),
  };
}

export function ChatHeader({ title, badge, done = false, subtitle, counter, progress }: {
  title: string;
  badge: string;
  done?: boolean;
  subtitle: ReactNode;
  counter: ReactNode;
  progress: number;
}) {
  return (
    <header className="border-b border-line bg-gradient-to-r from-brand-soft/80 to-paper-raised px-5 py-4 sm:px-7">
      <div className="flex items-center gap-3">
        <Character variant="ideas" className="w-12" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${done ? "bg-green-soft text-green" : "bg-brand-soft text-brand-strong"}`}>{badge}</span>
          </div>
          {subtitle}
        </div>
        {counter}
      </div>
      <div aria-hidden className="mt-4 h-1.5 overflow-hidden rounded-full bg-line/60">
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}

export function ChatQuestion<C>({ field }: { field: ChatField<C> }) {
  return (
    <div className="flex items-start gap-3">
      <Character variant="ideas" className="w-10" />
      <div className="min-w-0">
        <p id={`pergunta-${field.key}`} className="max-w-xl rounded-2xl rounded-tl-sm bg-paper px-4 py-3 text-sm leading-relaxed text-ink shadow-sm">{field.question}</p>
        {field.hint ? <p className="mt-2 px-1 text-sm leading-relaxed text-ink-soft">{field.hint}</p> : null}
      </div>
    </div>
  );
}

export function ChatError({ error }: { error: string }) {
  return error ? <p className="mt-4 rounded-xl bg-coral-soft px-4 py-3 text-sm text-coral" role="alert">{error}</p> : null;
}

const inputCls = "w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const sendCls = "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-e1 transition hover:bg-brand-strong";
const linkCls = "inline-flex min-h-11 items-center text-sm font-medium text-ink-soft underline-offset-4 hover:text-brand-strong hover:underline";
const cardCls = (active: boolean) => `rounded-xl border px-4 py-3 text-left transition ${active ? "border-brand bg-brand-soft text-brand-strong shadow-sm" : "border-line bg-paper-raised text-ink hover:border-brand/50 hover:bg-brand-soft/25"}`;
const chipCls = (active: boolean) => `inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-sm font-medium transition ${active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-paper-raised text-ink hover:border-brand/50"}`;

type Chat<C> = ReturnType<typeof useGuidedChat<C>>;

export function ChatAnswerControl<C>({ chat, context }: { chat: Chat<C>; context: C }) {
  const { current: field, drafts, setDrafts, answer } = chat;
  const options = optionsOf(field, chat.answers, context);
  const setText = (text: string) => setDrafts({ ...drafts, text });

  if (field.input === "chips") {
    const toggle = (value: string) => setDrafts({ ...drafts, chips: drafts.chips.includes(value) ? drafts.chips.filter((item) => item !== value) : [...drafts.chips, value] });
    return (
      <form onSubmit={(event) => { event.preventDefault(); answer(chipsAnswer(field, drafts.chips, drafts.text)); }}>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = drafts.chips.includes(option.value);
            return (
              <button key={option.value} type="button" aria-pressed={active} onClick={() => toggle(option.value)} className={chipCls(active)}>
                {active ? <Check size={14} className="mr-1.5 shrink-0" aria-hidden /> : null}
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <label htmlFor={`${field.key}-outro`} className="mb-1.5 block text-sm font-medium text-ink-soft">Outro: escreva o que não está na lista</label>
          <input id={`${field.key}-outro`} value={drafts.text} onChange={(event) => setText(event.target.value)} placeholder={field.other?.placeholder} autoComplete="off" className={inputCls} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="submit" className={BUTTON_CLS.primary}>Confirmar <ChevronRight size={15} aria-hidden /></button>
          {field.skip ? <button type="button" onClick={() => answer([])} className={linkCls}>{field.skip}</button> : null}
        </div>
      </form>
    );
  }

  if (field.input === "choice") {
    const selected = chat.answers[field.key];
    const custom = typeof selected === "string" && selected !== "" && !options.some((option) => option.value === selected);
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <button key={option.value} type="button" aria-pressed={active} onClick={() => answer(option.value)} className={cardCls(active)}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                {option.code ? <span className="inline-flex min-w-10 justify-center rounded-full bg-paper px-1.5 py-0.5 tabular-nums text-xs text-brand-strong">{option.code}</span> : null}
                {option.label}
                {active ? <Check size={14} className="ml-auto" aria-hidden /> : null}
              </span>
              {option.description ? <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{option.description}</span> : null}
            </button>
          );
        })}
        {field.other ? (
          <button type="button" aria-expanded={drafts.otherOpen} aria-controls={`${field.key}-outro-form`} onClick={() => setDrafts({ ...drafts, otherOpen: !drafts.otherOpen })} className={`${cardCls(drafts.otherOpen || custom)} border-dashed text-sm font-semibold`}>
            Outro
            <span className="mt-1 block text-sm font-normal leading-relaxed text-ink-soft">Escrever uma resposta que não está na lista</span>
          </button>
        ) : null}
        {field.other && drafts.otherOpen ? (
          <form id={`${field.key}-outro-form`} className="flex items-end gap-2 sm:col-span-2" onSubmit={(event) => { event.preventDefault(); answer(drafts.text); }}>
            <div className="min-w-0 flex-1">
              <label htmlFor={`${field.key}-outro`} className="mb-1.5 block text-sm font-medium text-ink-soft">{field.other.suffix ? `Quantos ${field.other.suffix}?` : "Qual?"}</label>
              <input
                id={`${field.key}-outro`} type={field.other.type ?? "text"} min={field.other.min} max={field.other.max} autoFocus autoComplete="off"
                value={drafts.text} onChange={(event) => setText(event.target.value)} placeholder={field.other.placeholder} className={inputCls}
              />
            </div>
            <button type="submit" aria-label="Confirmar resposta" className={sendCls}><Send size={17} aria-hidden /></button>
          </form>
        ) : null}
        {field.skip ? <button type="button" onClick={() => answer("")} className={`${linkCls} sm:col-span-2`}>{field.skip}</button> : null}
      </div>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); answer(drafts.text); }}>
      <div className="flex items-end gap-2">
        <input
          value={drafts.text} placeholder={field.placeholder} onChange={(event) => setText(event.target.value)}
          aria-labelledby={`pergunta-${field.key}`} type={field.input} autoFocus max={field.input === "date" ? brDay() : undefined}
          autoComplete={field.input === "tel" ? "tel" : "off"} className={inputCls}
        />
        <button type="submit" aria-label="Enviar resposta" className={sendCls}><Send size={17} aria-hidden /></button>
      </div>
      {field.skip ? <button type="button" onClick={() => answer("")} className={`mt-2 ${linkCls}`}>{field.skip}</button> : null}
    </form>
  );
}

export function ChatFooter<C>({ chat, resetLabel }: { chat: Chat<C>; resetLabel: string | null }) {
  return (
    <div className="flex items-center justify-between border-t border-line bg-paper/50 px-5 py-3 sm:px-7">
      <button type="button" onClick={chat.back} disabled={chat.index === 0 && !chat.editing} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-brand-strong disabled:invisible">
        <ChevronLeft size={14} aria-hidden />
        {chat.editing ? "Cancelar edição" : "Voltar"}
      </button>
      {resetLabel ? (
        <button type="button" onClick={chat.askReset} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-soft hover:text-coral">
          <RotateCcw size={13} aria-hidden /> {resetLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ChatReview<C>({ chat, fields, context, sections, empty, title, text, notice, saveLabel, resetLabel }: {
  chat: Chat<C>;
  fields: readonly ChatField<C>[];
  context: C;
  sections: readonly { title: string; description?: string }[];
  empty: string;
  title: string;
  text: string;
  notice?: ReactNode;
  saveLabel: string;
  resetLabel: string;
}) {
  return (
    <div className="px-5 py-7 sm:px-8">
      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-green-soft px-4 py-4">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-green text-white">
          <ClipboardCheck size={18} aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-base font-semibold text-green">{title}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-green">{text}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-line bg-paper/40 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
              {section.description ? <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{section.description}</p> : null}
            </div>
            <dl className="divide-y divide-line/70">
              {fields.filter((field) => field.section === section.title).map((field) => (
                <div key={field.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-2.5">
                  <dt className="col-start-1 text-sm font-semibold text-ink-soft">{field.label}</dt>
                  <dd className="col-start-1 mt-0.5 break-words text-sm leading-relaxed text-ink">{answerText(field, chat.answers, context, empty)}</dd>
                  <dd className="col-start-2 row-span-2 row-start-1">
                    <button type="button" onClick={() => chat.edit(field)} aria-label={`Editar ${field.label}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-brand-soft hover:text-brand-strong">
                      <Pencil size={14} aria-hidden />
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {chat.error ? <p className="mt-5 rounded-xl bg-coral-soft px-4 py-3 text-sm text-coral" role="alert">{chat.error}</p> : null}
      {notice}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={chat.askReset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink-soft hover:border-coral/40 hover:bg-coral-soft hover:text-coral">
          <RotateCcw size={15} aria-hidden /> {resetLabel}
        </button>
        <button type="button" onClick={chat.submit} disabled={chat.pending} className={BUTTON_CLS.primary}>
          <Save size={16} aria-hidden />
          {chat.pending ? "Salvando..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

export function ChatResetConfirm<C>({ chat, text, confirmLabel }: { chat: Chat<C>; text: string; confirmLabel: string }) {
  if (!chat.confirmingReset) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
      <span className="mr-2 text-sm font-medium text-coral">{text}</span>
      <button type="button" onClick={chat.cancelReset} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-ink-soft hover:bg-paper-raised">Cancelar</button>
      <button type="button" onClick={chat.reset} className="inline-flex min-h-11 items-center rounded-full bg-coral px-4 text-sm font-medium text-white">{confirmLabel}</button>
    </div>
  );
}
