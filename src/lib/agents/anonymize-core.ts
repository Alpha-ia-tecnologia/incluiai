import type { AgentModel } from "./types";

// Parte pura (sem banco): também usada pelos testes com node --test.

// Anonimização (LGPD) de tudo o que é enviado a provedores de IA: Claude,
// DeepSeek e OpenAI. O contexto já não leva nome, nascimento, responsável,
// escola nem dados clínicos; esta camada cobre os textos livres escritos pela
// equipe (estudo de caso, pontos fortes, registros), que podem citar pessoas
// ou trazer contatos.
//
// Pessoas viram papéis: [ESTUDANTE], [COLEGA], [FAMILIAR], [PROFISSIONAL] e
// [ESCOLA]. Contatos e documentos viram marcadores. Limite: nomes que não
// estão cadastrados na plataforma (ex.: "a vizinha Neide") não são reconhecidos.

type Category = "estudante" | "colega" | "familiar" | "profissional" | "escola";

const TOKENS: Record<Category, string> = {
  estudante: "[ESTUDANTE]", colega: "[COLEGA]", familiar: "[FAMILIAR]", profissional: "[PROFISSIONAL]", escola: "[ESCOLA]",
};
// Versão em linguagem natural, para pedidos de imagem (que não devem ter texto).
export const NATURAL: Record<Category, string> = {
  estudante: "o estudante", colega: "um colega", familiar: "um familiar", profissional: "um profissional", escola: "a escola",
};

// Palavras que aparecem em nomes de usuários e cadastros mas não identificam ninguém.
const NOT_NAMES = new Set([
  "secretaria", "educação", "educacao", "coordenadora", "coordenador", "coordenação", "professor", "professora", "prof",
  "dra", "dr", "família", "familia", "escola", "emef", "emei", "turma", "mãe", "mae", "pai", "avó", "avô", "tia", "tio",
  "equipe", "sala", "comum", "aee", "terapeuta", "responsável", "responsavel", "gestão", "gestao",
  "vovó", "vovô", "vó", "vô", "dona", "seu", "sra", "madrinha", "padrinho", "dinda", "dindo", "irmã", "irmão", "prima", "primo",
]);
export const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);

export const PATTERNS: { label: string; regex: RegExp; replacement: string }[] = [
  { label: "contatos", regex: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, replacement: "[E-MAIL]" },
  { label: "contatos", regex: /\bhttps?:\/\/\S+|\bwww\.\S+/gi, replacement: "[LINK]" },
  { label: "documentos", regex: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, replacement: "[DOCUMENTO]" },
  { label: "documentos", regex: /\b\d{5}-\d{3}\b/g, replacement: "[CEP]" },
  { label: "datas", regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, replacement: "[DATA]" },
  { label: "contatos", regex: /(?:\+?55[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?9?\d{4}[\s-]?\d{4}\b/g, replacement: "[TELEFONE]" },
];

export const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const isYearRange = (text: string) => /^(19|20)\d{2}[\s-](19|20)\d{2}$/.test(text.trim());

// "Prof.ª Beatriz (AEE)" → ["Beatriz"]; "Carla Oliveira" → ["Carla", "Oliveira"]
export function nameTokens(name: string): string[] {
  return name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && /^\p{Lu}/u.test(token) && !token.includes(".") && !NOT_NAMES.has(token.toLowerCase()) && !CONNECTORS.has(token.toLowerCase()));
}

export type AnonymizationTerms = {
  student: string;
  classmates?: string[];
  family?: string[];
  professionals?: string[];
  schools?: string[];
};

export type Anonymizer = {
  apply: (text: string) => string;
  applyNatural: (text: string) => string;
  summary: () => string | null;
};

export function createAnonymizer(terms: AnonymizationTerms): Anonymizer {
  // [termo, categoria, sensível a maiúsculas]: nomes completos em qualquer
  // grafia; nomes soltos só com inicial maiúscula ou tudo em maiúsculas
  // (evita trocar palavras comuns como "rosa" e "luz").
  const entries: [string, Category, boolean][] = [];
  const addPerson = (name: string, category: Category, allParts: boolean) => {
    const tokens = nameTokens(name);
    if (tokens.length >= 2) entries.push([tokens.join(" "), category, false]);
    for (const token of allParts ? tokens : tokens.slice(0, 1)) entries.push([token, category, true]);
  };
  addPerson(terms.student, "estudante", true);
  for (const name of terms.classmates ?? []) addPerson(name, "colega", false);
  for (const name of terms.family ?? []) addPerson(name, "familiar", false);
  for (const name of terms.professionals ?? []) addPerson(name, "profissional", false);
  for (const school of terms.schools ?? []) entries.push([school.trim(), "escola", false]);

  // Termos mais longos primeiro; o mesmo termo fica com a primeira categoria (o estudante vence).
  const seen = new Set<string>();
  const rules = entries
    .filter(([term]) => term.length >= 3)
    .sort((a, b) => b[0].length - a[0].length)
    .filter(([term]) => (seen.has(term.toLowerCase()) ? false : (seen.add(term.toLowerCase()), true)))
    .map(([term, category, caseSensitive]) => ({
      category,
      regex: new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${caseSensitive ? `${escape(term)}|${escape(term.toUpperCase())}` : escape(term)})(?![\\p{L}\\p{N}])`,
        caseSensitive ? "gu" : "giu",
      ),
    }));

  const counts: Record<string, number> = {};
  const run = (text: string, labels: Record<Category, string>, count: boolean) => {
    let result = text;
    for (const pattern of PATTERNS) {
      result = result.replace(pattern.regex, (match) => {
        if (pattern.replacement === "[TELEFONE]" && (match.replace(/\D/g, "").length < 8 || isYearRange(match))) return match;
        if (count) counts[pattern.label] = (counts[pattern.label] ?? 0) + 1;
        return pattern.replacement;
      });
    }
    for (const rule of rules) {
      result = result.replace(rule.regex, () => {
        if (count) counts[rule.category] = (counts[rule.category] ?? 0) + 1;
        return labels[rule.category];
      });
    }
    return result;
  };

  return {
    apply: (text) => run(text, TOKENS, true),
    applyNatural: (text) => run(text, NATURAL, true),
    summary: () => {
      const parts = Object.entries(counts).map(([label, total]) => `${total} ${label === "estudante" ? "menção(ões) ao estudante" : label === "colega" ? "nome(s) de colega" : label === "familiar" ? "nome(s) de familiar" : label === "profissional" ? "nome(s) de profissional" : label === "escola" ? "nome(s) da escola" : label}`);
      return parts.length ? `Antes do envio à IA, foram substituídos: ${parts.join(", ")}.` : null;
    },
  };
}

// Se algum marcador voltar na resposta, vira linguagem natural para o professor.
const BACK_TO_TEXT: [RegExp, string][] = [
  ...Object.entries(TOKENS).map(([category, token]): [RegExp, string] => [new RegExp(escape(token), "g"), NATURAL[category as Category]]),
  [/\[(E-MAIL|LINK|DOCUMENTO|CEP|DATA|TELEFONE)\]/g, "(informação omitida)"],
];

export function naturalizePlaceholders<T>(value: T): T {
  if (typeof value === "string") return BACK_TO_TEXT.reduce((text, [regex, natural]) => text.replace(regex, natural), value as string) as T;
  if (Array.isArray(value)) return value.map((item) => naturalizePlaceholders(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, naturalizePlaceholders(item)])) as T;
  }
  return value;
}

// Envolve um modelo: todo pedido sai anonimizado e toda resposta volta sem marcadores.
export function withAnonymization(model: AgentModel, anonymizer: Anonymizer): AgentModel {
  return async (request) => naturalizePlaceholders(await model({ ...request, prompt: anonymizer.apply(request.prompt) }));
}
