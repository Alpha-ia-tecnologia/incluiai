"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import { splitItems, type ChoiceOption } from "@/lib/form-options";
import { inputCls as defaultInputCls, labelCls as defaultLabelCls } from "@/components/form-styles";

const OTHER = "__outro__";

const normalize = (option: ChoiceOption) => (typeof option === "string" ? { value: option, label: option } : option);
const sameText = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }) === 0;

// Escolha única: lista de opções + "Outro", que abre um campo para digitar.
// O valor final vai em um input oculto com o `name`, então funciona em
// formulários com Server Actions sem mudar o que o servidor recebe.
export function ChoiceField({
  name, label, options, defaultValue = "", required = false, placeholder = "Escolha uma opção",
  otherLabel = "Outro (digitar)", otherPlaceholder = "Digite aqui", otherType = "text", otherMin, otherMax,
  hint, labelClassName = defaultLabelCls, inputClassName = defaultInputCls, onValueChange,
}: {
  name: string;
  label: string;
  options: ChoiceOption[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  otherType?: "text" | "number";
  otherMin?: number;
  otherMax?: number;
  hint?: string;
  labelClassName?: string;
  inputClassName?: string;
  onValueChange?: (value: string) => void;
}) {
  const id = useId();
  const items = options.map(normalize);
  const initial = items.find((item) => item.value === defaultValue || sameText(item.label, defaultValue));
  const [selection, setSelection] = useState(initial ? initial.value : defaultValue ? OTHER : "");
  const [other, setOther] = useState(initial ? "" : defaultValue);
  const otherRef = useRef<HTMLInputElement>(null);
  const value = selection === OTHER ? other.trim() : selection;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClassName}>{label}</label>
      <select
        id={id}
        value={selection}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setSelection(next);
          onValueChange?.(next === OTHER ? other.trim() : next);
          if (next === OTHER) requestAnimationFrame(() => otherRef.current?.focus());
        }}
        className={inputClassName}
      >
        <option value="" disabled={required}>{placeholder}</option>
        {items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        <option value={OTHER}>{otherLabel}</option>
      </select>
      {selection === OTHER ? (
        <>
          <label htmlFor={`${id}-outro`} className="sr-only">{label} — outra opção</label>
          <input
            ref={otherRef}
            id={`${id}-outro`}
            type={otherType}
            min={otherMin}
            max={otherMax}
            value={other}
            required={required}
            placeholder={otherPlaceholder}
            onChange={(event) => {
              setOther(event.target.value);
              onValueChange?.(event.target.value.trim());
            }}
            className={`${inputClassName} mt-2`}
          />
        </>
      ) : null}
      {hint ? <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-ink-soft">{hint}</p> : null}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

// Múltipla escolha: chips selecionáveis + "Outro" para acrescentar itens.
// `submit="joined"` envia um único campo com os itens unidos pelo separador;
// `submit="multiple"` envia um campo por item (ex.: barreiras).
export function MultiChoiceField({
  name, label, options, defaultValue = [], required = false, separator = ";", submit = "joined",
  hint, otherPlaceholder = "Digite e toque em Adicionar", legendClassName = defaultLabelCls, inputClassName = defaultInputCls,
}: {
  name: string;
  label: string;
  options: ChoiceOption[];
  defaultValue?: string | string[];
  required?: boolean;
  separator?: "," | ";";
  submit?: "joined" | "multiple";
  hint?: string;
  otherPlaceholder?: string;
  legendClassName?: string;
  inputClassName?: string;
}) {
  const id = useId();
  const items = options.map(normalize);
  const initialValues = Array.isArray(defaultValue) ? defaultValue : splitItems(defaultValue, separator);
  const matched = initialValues.map((value) => items.find((item) => item.value === value || sameText(item.label, value)));
  const [selected, setSelected] = useState<string[]>(matched.filter(Boolean).map((item) => item!.value));
  const [custom, setCustom] = useState<string[]>(initialValues.filter((_, index) => !matched[index]));
  const [otherOpen, setOtherOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);
  const validityRef = useRef<HTMLInputElement>(null);

  // O texto digitado em "Outro" conta mesmo sem tocar em Adicionar.
  const values = [...items.filter((item) => selected.includes(item.value)).map((item) => item.value), ...custom, ...(draft.trim() ? [draft.trim()] : [])];
  const joined = values.join(separator === "," ? ", " : "; ");

  useEffect(() => {
    validityRef.current?.setCustomValidity(required && values.length === 0 ? "Escolha ao menos uma opção ou digite em Outro." : "");
  }, [required, values.length]);

  function addDraft() {
    const text = draft.trim();
    if (!text) return;
    const known = items.find((item) => sameText(item.label, text));
    if (known) setSelected((list) => (list.includes(known.value) ? list : [...list, known.value]));
    else if (!custom.some((item) => sameText(item, text))) setCustom((list) => [...list, text]);
    setDraft("");
    draftRef.current?.focus();
  }

  function onDraftKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraft();
    }
  }

  const chipCls = "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-brand";
  const offCls = "border-line bg-paper-raised text-ink hover:border-brand/50 hover:bg-brand-soft/40";
  const onCls = "border-brand bg-brand-soft font-medium text-brand-strong";

  return (
    <fieldset className="relative min-w-0" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className={legendClassName}>{label}</legend>
      {hint ? <p id={`${id}-hint`} className="-mt-1 mb-2 text-xs leading-relaxed text-ink-soft">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selected.includes(item.value);
          return (
            <label key={item.value} className={`${chipCls} ${active ? onCls : offCls}`}>
              <input
                type="checkbox"
                checked={active}
                onChange={() => setSelected((list) => (active ? list.filter((value) => value !== item.value) : [...list, item.value]))}
                className="sr-only"
              />
              {active ? <Check size={14} aria-hidden /> : null}
              {item.label}
            </label>
          );
        })}
        {custom.map((item) => (
          <span key={item} className={`${chipCls} ${onCls} cursor-default pr-1.5`}>
            <Check size={14} aria-hidden />{item}
            <button type="button" onClick={() => setCustom((list) => list.filter((value) => value !== item))} aria-label={`Remover ${item}`} className="flex size-7 items-center justify-center rounded-full hover:bg-paper-raised">
              <X size={14} aria-hidden />
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-expanded={otherOpen}
          aria-controls={`${id}-outro`}
          onClick={() => {
            setOtherOpen((open) => !open);
            if (!otherOpen) requestAnimationFrame(() => draftRef.current?.focus());
          }}
          className={`${chipCls} ${otherOpen ? onCls : `${offCls} border-dashed`}`}
        >
          <Plus size={14} aria-hidden /> Outro
        </button>
      </div>
      {otherOpen ? (
        <div id={`${id}-outro`} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`${id}-texto`} className="sr-only">{label} — outra opção</label>
          <input ref={draftRef} id={`${id}-texto`} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onDraftKey} placeholder={otherPlaceholder} className={inputClassName} />
          <button type="button" onClick={addDraft} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-soft px-4 text-sm font-medium text-brand-strong hover:bg-lilac">
            <Plus size={15} aria-hidden /> Adicionar
          </button>
        </div>
      ) : null}
      {required ? (
        <input ref={validityRef} tabIndex={-1} aria-hidden required value={joined} onChange={() => {}} className="pointer-events-none absolute bottom-0 left-4 size-px opacity-0" />
      ) : null}
      {submit === "multiple"
        ? values.map((value) => <input key={value} type="hidden" name={name} value={value} />)
        : <input type="hidden" name={name} value={joined} />}
    </fieldset>
  );
}
