// O AEE é pedagógico e não depende de laudo (Nota Técnica MEC/SECADI/DPEE nº
// 04/2014).

import { CASE_STUDY_FIELDS, type CaseStudyContent, type CaseStudyField } from "./case-study";
import { splitItems, type ChoiceOption } from "./form-options";
import { hasClinicalTerm } from "./pedagogy-rules";

export const MAX_REPORT_MB = 10;
export const MAX_REPORT_BYTES = MAX_REPORT_MB * 1024 * 1024;

export type ReportMimeType = "application/pdf" | "image/jpeg" | "image/png";

export function sniffReportType(bytes: Uint8Array): ReportMimeType | null {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  return null;
}

const EXTENSIONS: Record<ReportMimeType, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export function cleanReportFileName(name: string, mimeType: ReportMimeType): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\p{Cc}"<>|*?:]/gu, "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .trim()
    .slice(0, 80);
  return `${base || "laudo"}.${EXTENSIONS[mimeType]}`;
}

export const REPORT_FIELD_KEYS = ["diagnostico", "saude", "acompanhamentos", "publicoAlvo", "necessidades", "recursos", "encaminhamentos"] as const;
export type ReportFieldKey = (typeof REPORT_FIELD_KEYS)[number];

export const REPORT_FIELDS: (CaseStudyField & { key: ReportFieldKey })[] = REPORT_FIELD_KEYS.map((key) => {
  const field = CASE_STUDY_FIELDS.find((item) => item.key === key);
  if (!field) throw new Error(`Campo do estudo de caso não encontrado: ${key}`);
  return { ...field, key };
});

const optionValue = (option: ChoiceOption) => (typeof option === "string" ? option : option.value);
export const fieldOptions = (field: CaseStudyField) => (field.options ?? []).map(optionValue);

export type ReportStatus = "lendo" | "lido" | "sem_texto" | "falhou" | "ia_desligada" | "sem_autorizacao";

export const STATUS_TEXT: Record<ReportStatus, string> = {
  lendo: "Em leitura",
  lido: "Sugestões para revisar",
  sem_texto: "Sem texto para a IA ler",
  falhou: "A leitura não terminou",
  ia_desligada: "Guardado, sem leitura pela IA",
  sem_autorizacao: "Guardado, sem autorização para IA",
};

export const RETRY_STATUSES: ReadonlySet<string> = new Set(["falhou", "ia_desligada", "sem_autorizacao", "lendo"]);

export function reportStatus(status: string, reviewedAt: Date | null): { label: string; needsReview: boolean } {
  if (reviewedAt) return { label: "Revisado", needsReview: false };
  const known = STATUS_TEXT[status as ReportStatus];
  return { label: known ?? status, needsReview: status === "lido" };
}

export function isReadingStalled(status: string, createdAt: Date): boolean {
  return status === "lendo" && Date.now() - createdAt.getTime() > 3 * 60_000;
}

export type ReportGuidance = { text: string; excerpt: string };
export type ReportSuggestion = { field: ReportFieldKey; values: string[]; excerpt: string };
export type ReportReading = {
  documentType: "laudo" | "relatorio" | "outro";
  summary: string;
  guidance: ReportGuidance[];
  suggestions: ReportSuggestion[];
  limits: string;
};
export type ReportAccepted = { guidance: string[]; fields: Partial<Record<ReportFieldKey, string[]>> };

export type RawReading = {
  tipoDocumento: "laudo" | "relatorio" | "outro";
  resumo: string;
  orientacoes: { texto: string; trecho: string }[];
  sugestoes: { campo: ReportFieldKey; valores: string[]; trecho: string }[];
  limites: string;
};

const MAX_GUIDANCE = 8;
const clip = (text: string, size: number) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > size ? `${clean.slice(0, size - 1).trimEnd()}…` : clean;
};
const normalizeKey = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export function normalizeReading(raw: RawReading): ReportReading {
  const suggestions: ReportSuggestion[] = [];
  for (const field of REPORT_FIELDS) {
    const options = new Map(fieldOptions(field).map((option) => [normalizeKey(option), option]));
    const items = raw.sugestoes.filter((item) => item.campo === field.key);
    const values = [...new Set(items.flatMap((item) => item.valores).map((value) => options.get(normalizeKey(value))).filter((value): value is string => Boolean(value)))];
    if (values.length === 0) continue;
    const excerpt = items.map((item) => item.trecho).find((text) => text.trim()) ?? "";
    suggestions.push({ field: field.key, values: field.type === "choice" ? values.slice(0, 1) : values, excerpt: clip(excerpt, 280) });
  }
  const seen = new Set<string>();
  const guidance = raw.orientacoes
    .map((item) => ({ text: clip(item.texto, 240), excerpt: clip(item.trecho, 280) }))
    .filter((item) => item.text && !seen.has(normalizeKey(item.text)) && seen.add(normalizeKey(item.text)))
    .slice(0, MAX_GUIDANCE);
  return {
    documentType: raw.tipoDocumento,
    summary: clip(raw.resumo, 900),
    guidance,
    suggestions,
    limits: clip(raw.limites ?? "", 400),
  };
}

function parse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const parseReading = (value: string | null | undefined) => parse<ReportReading | null>(value, null);
export const parseAccepted = (value: string | null | undefined) => parse<ReportAccepted>(value, { guidance: [], fields: {} });

const PLACEHOLDERS = new Set(["Nenhuma", "Nenhum", "Sem diagnóstico", "Em investigação"]);

export type ReviewRow = {
  field: CaseStudyField & { key: ReportFieldKey };
  current: string[];
  fresh: string[];
  known: string[];
  replaces: string[];
  excerpt: string;
};

export function reviewRows(reading: ReportReading, content: CaseStudyContent): ReviewRow[] {
  return reading.suggestions.flatMap((suggestion) => {
    const field = REPORT_FIELDS.find((item) => item.key === suggestion.field);
    if (!field) return [];
    const current = field.type === "multi" ? splitItems(content[field.key]) : content[field.key] ? [content[field.key]] : [];
    const fresh = suggestion.values.filter((value) => !current.includes(value));
    const known = suggestion.values.filter((value) => current.includes(value));
    const concrete = fresh.some((value) => !PLACEHOLDERS.has(value));
    const replaces = field.type === "choice"
      ? (fresh.length ? current : [])
      : concrete ? current.filter((value) => PLACEHOLDERS.has(value)) : [];
    return [{ field, current, fresh, known, replaces, excerpt: suggestion.excerpt }];
  });
}

export function mergeIntoCaseStudy(content: CaseStudyContent, fields: ReportAccepted["fields"]): CaseStudyContent {
  const next: CaseStudyContent = { ...content };
  for (const field of REPORT_FIELDS) {
    const values = fields[field.key];
    if (!values?.length) continue;
    if (field.type !== "multi") {
      next[field.key] = values[0];
      continue;
    }
    const concrete = values.some((value) => !PLACEHOLDERS.has(value));
    const current = splitItems(content[field.key]).filter((value) => !(concrete && PLACEHOLDERS.has(value)));
    next[field.key] = [...new Set([...current, ...values])].join("; ");
  }
  return next;
}

export function guidanceForPlan(accepted: ReportAccepted[]): string[] {
  return [...new Set(accepted.flatMap((item) => item.guidance))].filter((text) => !hasClinicalTerm(text));
}
