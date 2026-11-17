import type { AgentModel } from "./types.ts";

type PersonCategory = "estudante" | "colega" | "familiar" | "profissional" | "escola";

const MARKERS: Record<PersonCategory, string> = {
  estudante: "[ESTUDANTE]", colega: "[COLEGA]", familiar: "[FAMILIAR]", profissional: "[PROFISSIONAL]", escola: "[ESCOLA]",
};
const IN_WORDS: Record<PersonCategory, string> = {
  estudante: "o estudante", colega: "um colega", familiar: "um familiar", profissional: "um profissional", escola: "a escola",
};
const COUNT_LABELS: Record<PersonCategory, string> = {
  estudante: "menção(ões) ao estudante", colega: "nome(s) de colega", familiar: "nome(s) de familiar", profissional: "nome(s) de profissional", escola: "nome(s) da escola",
};
const AMBIGUOUS = "[PESSOA]";
const OMITTED = "(informação omitida)";

const NOT_NAMES = new Set([
  "secretaria", "educação", "educacao", "coordenadora", "coordenador", "coordenação", "professor", "professora", "prof",
  "dra", "dr", "família", "familia", "escola", "emef", "emei", "turma", "mãe", "mae", "pai", "avó", "avô", "tia", "tio",
  "equipe", "sala", "comum", "aee", "terapeuta", "responsável", "responsavel", "gestão", "gestao",
  "vovó", "vovô", "vó", "vô", "dona", "seu", "sra", "madrinha", "padrinho", "dinda", "dindo", "irmã", "irmão", "prima", "primo",
]);
const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);

export type Pattern = { label: string; regex: RegExp; replacement: string; keep?: (match: string) => boolean };

const isYearRange = (text: string) => /^(19|20)\d{2}[\s-](19|20)\d{2}$/.test(text.trim());

const PATTERNS: readonly Pattern[] = [
  { label: "contatos", regex: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, replacement: "[E-MAIL]" },
  { label: "contatos", regex: /\bhttps?:\/\/\S+|\bwww\.\S+/gi, replacement: "[LINK]" },
  { label: "documentos", regex: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, replacement: "[DOCUMENTO]" },
  { label: "documentos", regex: /\b\d{5}-\d{3}\b/g, replacement: "[CEP]" },
  { label: "datas", regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, replacement: "[DATA]" },
  {
    label: "contatos", regex: /(?:\+?55[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?9?\d{4}[\s-]?\d{4}\b/g, replacement: "[TELEFONE]",
    keep: (match) => match.replace(/\D/g, "").length < 8 || isYearRange(match),
  },
];

export const DOCUMENT_PATTERNS: readonly Pattern[] = [
  {
    label: "linhas de identificação",
    regex: /(?<![\p{L}])(Paciente|Nome(?: completo| do paciente| da criança| do estudante| do aluno)?|M[ãa]e|Pai|Respons[áa]vel(?: legal)?|Filia[çc][ãa]o|Acompanhante|Data de nascimento|Nascimento|D\.?N\.?|Endere[çc]o|Prontu[áa]rio|Matr[íi]cula)\s*:[^\n]*/giu,
    replacement: "$1: [OMITIDO]",
  },
  { label: "nomes de profissionais", regex: /(?<![\p{L}])(?:Dr\.ª|Dra?\.?|Doutora?)\s+\p{Lu}[\p{L}'’-]+(?:\s+(?:d[aeo]s?\s+)?\p{Lu}[\p{L}'’-]+){0,4}/gu, replacement: "[PROFISSIONAL]" },
  { label: "registros profissionais", regex: /\b(?:CRM|CRP|CRFa|CREFITO|COREN|CRN|CRO|RQE)\b[\s:/-]*(?:[A-Z]{2}[\s:/-]*)?\d[\d./-]*/g, replacement: "[REGISTRO PROFISSIONAL]" },
  { label: "documentos", regex: /\b\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, replacement: "[DOCUMENTO]" },
  { label: "documentos", regex: /\b\d{1,2}\.\d{3}\.\d{3}-[\dXx]\b/g, replacement: "[DOCUMENTO]" },
  { label: "endereços", regex: /(?<![\p{L}])(?:Rua|Avenida|Av\.|Travessa|Alameda|Rodovia|Estrada|Praça)\s+[^\n,;]{2,80}(?:,\s*(?:n[º°o.]\s*)?\d+[A-Za-z]?)?/gu, replacement: "[ENDEREÇO]" },
];

const markerOf = (pattern: Pattern) => pattern.replacement.match(/\[[^\]]+\]/)![0];
const PERSON_MARKERS: readonly string[] = Object.values(MARKERS);
const OMITTED_MARKERS = [...new Set([...PATTERNS, ...DOCUMENT_PATTERNS].map(markerOf))].filter((marker) => !PERSON_MARKERS.includes(marker));

const listed = (items: string[]) => `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
export const MARKER_LIST = listed([...PERSON_MARKERS, ...new Set(PATTERNS.map(markerOf))]);
export const DOCUMENT_MARKER_LIST = listed([...PERSON_MARKERS, ...OMITTED_MARKERS]);

export function replacePatterns(text: string, patterns: readonly Pattern[], found?: Record<string, number>): string {
  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern.regex, (match: string, ...groups: unknown[]) => {
      if (pattern.keep?.(match)) return match;
      if (found) found[pattern.label] = (found[pattern.label] ?? 0) + 1;
      return pattern.replacement.replace("$1", () => (typeof groups[0] === "string" ? groups[0] : ""));
    });
  }
  return result;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function nameTokens(name: string): string[] {
  return name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && /^\p{Lu}/u.test(token) && !token.includes(".") && !NOT_NAMES.has(token.toLowerCase()) && !CONNECTORS.has(token.toLowerCase()));
}

type Term = { text: string; replacement: string; caseSensitive: boolean; counted?: PersonCategory };
type Rule = Term & { regex: RegExp };

function personTerms(name: string, replacement: string, parts: "first" | "all", counted?: PersonCategory): Term[] {
  const tokens = nameTokens(name);
  const terms: Term[] = tokens.length >= 2 ? [{ text: tokens.join(" "), replacement, caseSensitive: false, counted }] : [];
  for (const token of parts === "all" ? tokens : tokens.slice(0, 1)) terms.push({ text: token, replacement, caseSensitive: true, counted });
  return terms;
}

function compile(terms: Term[], ambiguous?: string): Rule[] {
  const byKey = new Map<string, Term>();
  for (const term of terms) {
    if (term.text.length < 3) continue;
    const key = term.text.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, term);
    else if (ambiguous && existing.replacement !== term.replacement) byKey.set(key, { ...existing, replacement: ambiguous });
  }
  return [...byKey.values()]
    .sort((a, b) => b.text.length - a.text.length)
    .map((term) => ({
      ...term,
      regex: new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${term.caseSensitive ? `${escape(term.text)}|${escape(term.text.toUpperCase())}` : escape(term.text)})(?![\\p{L}\\p{N}])`,
        term.caseSensitive ? "gu" : "giu",
      ),
    }));
}

function replaceNames(text: string, rules: Rule[], replacementOf: (rule: Rule) => string, found?: Record<string, number>): string {
  let result = text;
  for (const rule of rules) {
    result = result.replace(rule.regex, () => {
      if (found && rule.counted) found[rule.counted] = (found[rule.counted] ?? 0) + 1;
      return replacementOf(rule);
    });
  }
  return result;
}

export type Names = {
  focus?: string | null;
  students?: string[];
  family?: string[];
  professionals?: string[];
  schools?: string[];
  everyPart?: boolean;
};

export type Named = { id: string; name: string };

export type ScopeNames = {
  focus: Named | null;
  students: Named[];
  family: string[];
  professionals: string[];
  schools: Named[];
  everyPart: boolean;
};

export const redactionNames = (names: ScopeNames): Names => ({
  focus: names.focus?.name,
  students: names.students.map((student) => student.name),
  family: names.family,
  professionals: names.professionals,
  schools: names.schools.map((school) => school.name),
  everyPart: names.everyPart,
});

export const peopleIn = (names: ScopeNames) =>
  [names.focus?.name ?? "", ...names.students.map((student) => student.name), ...names.family, ...names.professionals].filter(Boolean);

export type Redactor = {
  redact: (text: string) => string;
  redactInWords: (text: string) => string;
  removed: () => number;
  summary: () => string | null;
};

export function createRedactor(names: Names): Redactor {
  const parts = names.everyPart ? "all" : "first";
  const others: PersonCategory = names.focus ? "colega" : "estudante";
  const groups: [PersonCategory, string[]][] = [
    [others, names.students ?? []],
    ["familiar", names.family ?? []],
    ["profissional", names.professionals ?? []],
  ];
  const rules = compile([
    ...(names.focus ? personTerms(names.focus, "estudante", "all", "estudante") : []),
    ...groups.flatMap(([category, list]) => list.flatMap((name) => personTerms(name, category, parts, category))),
    ...(names.schools ?? []).map((school): Term => ({ text: school.trim(), replacement: "escola", caseSensitive: false, counted: "escola" })),
  ]);

  const found: Record<string, number> = {};
  const run = (text: string, words: Record<PersonCategory, string>) =>
    replaceNames(replacePatterns(text, PATTERNS, found), rules, (rule) => words[rule.replacement as PersonCategory], found);

  return {
    redact: (text) => run(text, MARKERS),
    redactInWords: (text) => inWords(run(text, IN_WORDS)),
    removed: () => Object.values(found).reduce((total, count) => total + count, 0),
    summary: () => {
      const parts = Object.entries(found).map(([label, total]) => `${total} ${COUNT_LABELS[label as PersonCategory] ?? label}`);
      return parts.length ? `Antes do envio à IA, foram substituídos: ${parts.join(", ")}.` : null;
    },
  };
}

const BACK_TO_WORDS: [RegExp, string][] = [
  ...Object.entries(MARKERS).map(([category, marker]): [RegExp, string] => [new RegExp(escape(marker), "g"), IN_WORDS[category as PersonCategory]]),
  [new RegExp(OMITTED_MARKERS.map(escape).join("|"), "g"), OMITTED],
  [new RegExp(escape(AMBIGUOUS), "g"), "uma pessoa"],
];

export function inWords<T>(value: T): T {
  if (typeof value === "string") return BACK_TO_WORDS.reduce((text, [regex, words]) => text.replace(regex, words), value as string) as T;
  if (Array.isArray(value)) return value.map((item) => inWords(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inWords(item)])) as T;
  }
  return value;
}

export function withRedaction(model: AgentModel, redactor: Redactor): AgentModel {
  return async (request) => inWords(await model({ ...request, prompt: redactor.redact(request.prompt) }));
}

export function remainingIdentifiers(text: string, people: string[], schools: string[]): string[] {
  const found = new Set<string>();
  for (const pattern of PATTERNS) {
    const matches = text.match(new RegExp(pattern.regex.source, pattern.regex.flags)) ?? [];
    if (matches.some((match) => !pattern.keep?.(match))) found.add(pattern.label);
  }
  for (const name of [...people, ...schools]) {
    const full = name.trim();
    if (full.length >= 5 && new RegExp(`(?<![\\p{L}])${escape(full)}(?![\\p{L}])`, "iu").test(text)) found.add("nome");
  }
  for (const token of new Set(people.flatMap(nameTokens))) {
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escape(token)}(?![\\p{L}\\p{N}])`, "u").test(text)) found.add("nome");
  }
  return [...found];
}

export type PseudonymMap = { students: Record<string, number>; schools: Record<string, number> };

export type Pseudonymizer = {
  map: PseudonymMap;
  changed: boolean;
  studentLabel: (studentId: string) => string;
  schoolLabel: (schoolId: string) => string;
  apply: (text: string) => string;
  restore: (text: string) => string;
};

export function createPseudonymizer(input: { map: PseudonymMap; students: Named[]; schools: Named[]; family: string[]; professionals: string[] }): Pseudonymizer {
  const map: PseudonymMap = { students: { ...input.map.students }, schools: { ...input.map.schools } };
  let changed = false;
  const assign = (table: Record<string, number>, id: string) => {
    if (!table[id]) {
      table[id] = Math.max(0, ...Object.values(table)) + 1;
      changed = true;
    }
    return table[id];
  };
  for (const student of input.students) assign(map.students, student.id);
  for (const school of input.schools) assign(map.schools, school.id);
  const studentLabel = (id: string) => `[ESTUDANTE ${map.students[id] ?? "?"}]`;
  const schoolLabel = (id: string) => `[ESCOLA ${map.schools[id] ?? "?"}]`;

  const studentTerms = (student: Named): Term[] => {
    const tokens = nameTokens(student.name);
    const label = studentLabel(student.id);
    const terms: Term[] = [];
    for (let length = tokens.length; length >= 2; length--) terms.push({ text: tokens.slice(0, length).join(" "), replacement: label, caseSensitive: false });
    for (const token of tokens) terms.push({ text: token, replacement: label, caseSensitive: true });
    return terms;
  };
  const rules = compile([
    ...input.students.flatMap(studentTerms),
    ...input.family.flatMap((name) => personTerms(name, MARKERS.familiar, "first")),
    ...input.professionals.flatMap((name) => personTerms(name, MARKERS.profissional, "first")),
    ...input.schools.map((school): Term => ({ text: school.name.trim(), replacement: schoolLabel(school.id), caseSensitive: false })),
  ], AMBIGUOUS);

  const apply = (text: string) => replaceNames(replacePatterns(text, PATTERNS), rules, (rule) => rule.replacement);

  const firstNames = new Map<string, number>();
  for (const student of input.students) {
    const first = nameTokens(student.name)[0] ?? student.name;
    firstNames.set(first, (firstNames.get(first) ?? 0) + 1);
  }
  const shown = new Map<number, string>();
  for (const student of input.students) {
    const first = nameTokens(student.name)[0] ?? student.name;
    shown.set(map.students[student.id], (firstNames.get(first) ?? 0) > 1 ? student.name : first);
  }
  const schoolNames = new Map(input.schools.map((school) => [map.schools[school.id], school.name]));
  const restore = (text: string) => inWords(text
    .replace(/\[?\bESTUDANTE\s+(\d+)\b\]?/gi, (match, n: string) => shown.get(Number(n)) ?? match)
    .replace(/\[?\bESCOLA\s+(\d+)\b\]?/gi, (match, n: string) => schoolNames.get(Number(n)) ?? match));

  return { map, changed, studentLabel, schoolLabel, apply, restore };
}

const STREAM_HOLD_BACK = 24;

export function restorableLength(text: string): number {
  if (text.length <= STREAM_HOLD_BACK) return 0;
  let cut = text.length - STREAM_HOLD_BACK;
  const space = text.lastIndexOf(" ", cut);
  if (space > 0) cut = space;
  const prefix = text.slice(0, cut);
  const open = prefix.lastIndexOf("[");
  if (open > prefix.lastIndexOf("]")) cut = open;
  const bare = prefix.search(/\b(?:estudante|escola)\s*\d*$/i);
  if (bare >= 0) cut = Math.min(cut, bare);
  return Math.max(0, cut);
}
