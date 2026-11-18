import { isoToBr } from "./dates.ts";
import { joinItems, splitItems } from "./format.ts";
import type { ChoiceOption } from "./form-options.ts";

export type ChatOption = { value: string; label: string; code?: string; description?: string };
export type ChatAnswer = string | string[];
export type ChatAnswers = Record<string, ChatAnswer>;

type Options<C> = readonly ChatOption[] | ((answers: ChatAnswers, context: C) => readonly ChatOption[]);

type FieldBase<C> = {
  key: string;
  label: string;
  section: string;
  question: string;
  hint?: string;
  required?: boolean;
  skip?: string;
  empty?: string;
  onAnswer?: (next: ChatAnswers, previous: ChatAnswers, context: C) => ChatAnswers;
};

// checkbox: o "sim" vai como "on", o valor que o navegador manda de um <input type="checkbox"> marcado.
export type ChatField<C = undefined> = FieldBase<C> & (
  | { input: "text" | "date" | "tel"; placeholder?: string }
  | { input: "choice"; options: Options<C>; checkbox?: boolean; other?: { type?: "text" | "number"; min?: number; max?: number; placeholder?: string; suffix?: string } }
  | { input: "chips"; options: Options<C>; separator?: "," | ";"; submit?: "joined" | "multiple"; other?: { placeholder?: string } }
);

export const asOptions = (items: readonly ChoiceOption[]): ChatOption[] => items.map((item) => (typeof item === "string" ? { value: item, label: item } : item));

export const YES_NO: ChatOption[] = [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }];

export function optionsOf<C>(field: ChatField<C>, answers: ChatAnswers, context: C): readonly ChatOption[] {
  if (!("options" in field)) return [];
  return typeof field.options === "function" ? field.options(answers, context) : field.options;
}

const listOf = (value: ChatAnswer | undefined) => (Array.isArray(value) ? value : value ? [value] : []);
export const isAnswered = (value: ChatAnswer | undefined) => (Array.isArray(value) ? value.length > 0 : Boolean(value?.trim()));

export function firstMissing<C>(fields: readonly ChatField<C>[], answers: ChatAnswers): ChatField<C> | undefined {
  return fields.find((field) => field.required && !isAnswered(answers[field.key]));
}

export type Drafts = { text: string; chips: string[]; otherOpen: boolean };

export function draftsFor<C>(field: ChatField<C>, answers: ChatAnswers, context: C): Drafts {
  const value = answers[field.key];
  const options = optionsOf(field, answers, context);
  if (field.input === "chips") {
    const items = listOf(value);
    const chips = items.filter((item) => options.some((option) => option.value === item));
    return { chips, text: joinItems(items.filter((item) => !chips.includes(item)), field.separator), otherOpen: false };
  }
  const text = typeof value === "string" ? value : "";
  if (field.input !== "choice") return { text, chips: [], otherOpen: false };
  const custom = Boolean(field.other && text && !options.some((option) => option.value === text));
  return { text: custom ? text : "", chips: [], otherOpen: custom };
}

export function chipsAnswer<C>(field: ChatField<C> & { input: "chips" }, chips: readonly string[], text: string): string[] {
  return [...new Set([...chips, ...splitItems(text, field.separator)])];
}

export function answerText<C>(field: ChatField<C>, answers: ChatAnswers, context: C, empty: string): string {
  const value = answers[field.key];
  if (!isAnswered(value)) return field.empty ?? empty;
  const options = optionsOf(field, answers, context);
  const labelOf = (item: string) => {
    const option = options.find((candidate) => candidate.value === item);
    if (option) return option.code ? `${option.code} · ${option.label}` : option.label;
    return field.input === "choice" && field.other?.suffix ? `${item} ${field.other.suffix}` : item;
  };
  if (field.input === "date") return isoToBr(String(value));
  const labels = listOf(value).map(labelOf);
  return field.input === "chips" ? joinItems(labels, field.separator) : labels.join(", ");
}

export function chatFormData<C>(fields: readonly ChatField<C>[], answers: ChatAnswers): FormData {
  const data = new FormData();
  for (const field of fields) {
    const value = answers[field.key];
    if (field.input === "chips") {
      const items = listOf(value);
      if (field.submit === "multiple") items.forEach((item) => data.append(field.key, item));
      else data.append(field.key, joinItems(items, field.separator));
    } else if (field.input === "choice" && field.checkbox) {
      if (value === "sim") data.append(field.key, "on");
    } else {
      data.append(field.key, typeof value === "string" ? value : "");
    }
  }
  return data;
}
