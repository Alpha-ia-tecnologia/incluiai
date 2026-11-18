import { z } from "zod/v4";
import { UserError } from "./user-error.ts";
import { dayFromInput } from "./dates.ts";

export function dateFromInput(value: string, label = "a data"): Date {
  const date = dayFromInput(value);
  if (!date) throw new UserError(`Informe ${label} no formato dia/mês/ano.`);
  return date;
}

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const asText = (value: unknown, max?: number) => {
  const text = first(value);
  const trimmed = typeof text === "string" ? text.trim() : "";
  return max === undefined ? trimmed : trimmed.slice(0, max);
};

export const formField = {
  text: (max?: number) => z.unknown().transform((value) => asText(value, max)),
  optionalText: (max?: number) => z.unknown().transform((value) => asText(value, max) || null),
  checkbox: () => z.unknown().transform((value) => first(value) === "on"),
  list: (max?: number) => z.unknown().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]).map((item) => asText(item, max)).filter(Boolean)),
  date: (label?: string) => z.unknown().transform((value) => dateFromInput(asText(value), label)),
  optionalDate: (label?: string) => z.unknown().transform((value) => (asText(value) ? dateFromInput(asText(value), label) : null)),
  choice: <const T extends readonly string[]>(values: T, message: string) => z.unknown().transform((value) => {
    const text = asText(value);
    if (!values.includes(text)) throw new UserError(message);
    return text as T[number];
  }),
};

export function readForm<S extends z.ZodObject>(formData: FormData, schema: S): z.output<S> {
  const raw = Object.fromEntries(Object.keys(schema.shape).map((key) => {
    const values = formData.getAll(key);
    return [key, values.length > 1 ? values : values[0]];
  }));
  return schema.parse(raw);
}
