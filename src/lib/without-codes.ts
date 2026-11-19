import { SUPPORT_LEVELS } from "./scale.ts";

// Códigos da escala de apoio (IND, SUP, VERB, MOD, FIS-P, FIS-T) e da BNCC
// (EF01LP04, EI03EF01, EM13LP01…): ajudam a equipe, mas são jargão para a
// família e para o terapeuta. O texto guardado não muda; só a leitura.

const SUPPORT_CODES = SUPPORT_LEVELS.map((level) => level.code).sort((a, b) => b.length - a.length);
const CODE = `(?:${SUPPORT_CODES.join("|")})`;
const BNCC_CODE = "E[IFM]\\d{2}[A-Z]{2}\\d{2,3}";
const LABEL = Object.fromEntries(SUPPORT_LEVELS.map((level) => [level.code, level.label.toLowerCase()]));

const RULES: ReadonlyArray<[RegExp, string | ((match: string, ...groups: string[]) => string)]> = [
  // "com pista visual (VERB)", "(EF01LP04)", "(BNCC EF01LP04)"
  [new RegExp(`\\s*\\(\\s*(?:BNCC\\s*:?\\s*)?(?:${CODE}|${BNCC_CODE})(?:\\s*[,;/]\\s*(?:${CODE}|${BNCC_CODE}))*\\s*\\)`, "g"), ""],
  // "VERB · Instrução verbal", "FIS-T — Apoio físico total": fica só a palavra
  [new RegExp(`(?<![\\p{L}\\d-])${CODE}\\s*[·—–:-]\\s*(?=\\p{L})`, "gu"), ""],
  // "habilidade da BNCC: EF01LP04", "BNCC EF01LP04": fica a palavra
  [new RegExp(`\\bBNCC\\b\\s*:?\\s*${BNCC_CODE}`, "g"), "BNCC"],
  [new RegExp(`\\s*\\b${BNCC_CODE}\\b`, "g"), ""],
  // código solto vira a palavra: "apoio VERB" → "apoio instrução verbal"
  [new RegExp(`(?<![\\p{L}\\d-])(${CODE})(?![\\p{L}\\d-])`, "gu"), (_match, code) => LABEL[code] ?? code],
  [/\bBNCC\b/g, "base curricular"],
];

/** O texto sem os códigos internos da equipe, para a família e o terapeuta. */
export function withoutCodes(text: string): string {
  let out = text;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement as string);
  return out
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/([,;:])(?=[,.;:])/g, "")
    .replace(/:\s*\./g, ".")
    .trim();
}

/** Há algum código interno no texto? (para os testes de ponta a ponta e de unidade) */
export const hasTeamCode = (text: string) => new RegExp(`(?<![\\p{L}\\d-])${CODE}(?![\\p{L}\\d-])|\\b${BNCC_CODE}\\b|\\bBNCC\\b`, "u").test(text);

/** O mesmo em todo texto de um conteúdo guardado em JSON (material, relatório): listas e objetos, recursivamente. */
export function withoutCodesDeep<T>(value: T): T {
  if (typeof value === "string") return withoutCodes(value) as T;
  if (Array.isArray(value)) return value.map(withoutCodesDeep) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutCodesDeep(item)])) as T;
  return value;
}
