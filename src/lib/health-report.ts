// Laudos e relatórios de saúde anexados ao estudo de caso. São opcionais: o
// AEE é pedagógico e não depende de laudo (Nota Técnica MEC/SECADI/DPEE nº
// 04/2014). Aqui ficam as regras que não dependem da IA: os arquivos aceitos,
// os campos que a leitura pode sugerir e como o que a equipe aceita se junta
// ao estudo de caso. A leitura em si fica em agents/health-report-reader.ts.

import { CASE_STUDY_FIELDS, type CaseStudyContent, type CaseStudyField } from "./case-study";
import { splitItems, type ChoiceOption } from "./form-options";

export const MAX_REPORT_MB = 10;
export const MAX_REPORT_BYTES = MAX_REPORT_MB * 1024 * 1024;

export type ReportMimeType = "application/pdf" | "image/jpeg" | "image/png";

// O tipo é conferido pelos primeiros bytes do arquivo, não pela extensão nem
// pelo que o navegador declara.
export function sniffReportType(bytes: Uint8Array): ReportMimeType | null {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  return null;
}

const EXTENSIONS: Record<ReportMimeType, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

// Nome mostrado na tela e no download: sem caminho, sem caracteres de controle
// e com a extensão do tipo real.
export function cleanReportFileName(name: string, mimeType: ReportMimeType): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\p{Cc}"<>|*?:]/gu, "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .trim()
    .slice(0, 80);
  return `${base || "laudo"}.${EXTENSIONS[mimeType]}`;
}

// Campos do estudo de caso que um laudo pode informar. A escuta da família e
// do estudante, a observação e a avaliação pedagógica ficam de fora: isso a
// escola levanta, e o laudo não substitui.
export const REPORT_FIELD_KEYS = ["diagnostico", "saude", "acompanhamentos", "publicoAlvo", "necessidades", "recursos", "encaminhamentos"] as const;
export type ReportFieldKey = (typeof REPORT_FIELD_KEYS)[number];

export const REPORT_FIELDS: (CaseStudyField & { key: ReportFieldKey })[] = REPORT_FIELD_KEYS.map((key) => {
  const field = CASE_STUDY_FIELDS.find((item) => item.key === key);
  if (!field) throw new Error(`Campo do estudo de caso não encontrado: ${key}`);
  return { ...field, key };
});

const optionValue = (option: ChoiceOption) => (typeof option === "string" ? option : option.value);
export const fieldOptions = (field: CaseStudyField) => (field.options ?? []).map(optionValue);

export type ReportStatus = "lendo" | "lido" | "sem_texto" | "falhou" | "ia_desligada";

export const STATUS_TEXT: Record<ReportStatus, string> = {
  lendo: "Em leitura",
  lido: "Sugestões para revisar",
  sem_texto: "Sem texto para a IA ler",
  falhou: "A leitura não terminou",
  ia_desligada: "Guardado, sem leitura pela IA",
};

export function reportStatus(status: string, reviewedAt: Date | null): { label: string; needsReview: boolean } {
  if (reviewedAt) return { label: "Revisado", needsReview: false };
  const known = STATUS_TEXT[status as ReportStatus];
  return { label: known ?? status, needsReview: status === "lido" };
}

// Leitura que ficou em "lendo" por mais de 3 minutos foi interrompida (o
// servidor reiniciou no meio, por exemplo) e pode ser tentada de novo.
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

// O que a IA devolve, já sem marcadores de anonimização.
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

// Confere a resposta da IA: só ficam valores que existem nas opções do campo
// (com a grafia da opção), um valor por campo de escolha única e orientações
// curtas, sem repetição.
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

// Respostas que dizem "nada" ("Nenhuma", "Sem diagnóstico", "Em investigação")
// saem do campo quando a equipe junta uma informação concreta do laudo.
const PLACEHOLDERS = new Set(["Nenhuma", "Nenhum", "Sem diagnóstico", "Em investigação"]);

export type ReviewRow = {
  field: CaseStudyField & { key: ReportFieldKey };
  current: string[];
  // Valores sugeridos que ainda não estão no estudo de caso.
  fresh: string[];
  // Valores sugeridos que já estão registrados.
  known: string[];
  // Respostas que deixam o campo se a equipe aceitar algo novo.
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

// Junta ao estudo de caso o que a equipe aceitou. Em campos de várias
// respostas, soma ao que já existe; em campos de uma resposta, troca.
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

// Termos clínicos que não seguem para os agentes do plano, mesmo dentro de
// uma orientação aceita (o contexto do plano é pedagógico).
export const CLINICAL_TERMS = /(?<![\p{L}])(diagn[óo]stic\p{L}*|laudo|cid[- ]?\d|f\d{2}(?:\.\d)?|medica(?:ç|c)\p{L}*|rem[ée]dio|dose|patologia|transtorno|s[íi]ndrome|tea|tdah|autis\p{L}*|epileps\p{L}*|d[ée]ficit)(?![\p{L}])/iu;

export function guidanceForPlan(accepted: ReportAccepted[]): string[] {
  return [...new Set(accepted.flatMap((item) => item.guidance))].filter((text) => !CLINICAL_TERMS.test(text));
}
