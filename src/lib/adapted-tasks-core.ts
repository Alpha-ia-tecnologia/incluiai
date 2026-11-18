export type AnswerFormat = "escrever" | "marcar" | "ligar" | "completar" | "desenhar" | "oral";
export type AdaptedItem = { number: number; prompt: string; answerFormat: AnswerFormat; options: string[]; support: string };
export type AdaptedContent = {
  title: string;
  instructions: string[];
  items: AdaptedItem[];
  teacherNotes: string[];
  preserved: string;
};
export type TaskKind = "atividade" | "prova";
export type LevelKey = "mais_apoio" | "padrao" | "desafio";

export const ANSWER_FORMATS: AnswerFormat[] = ["escrever", "marcar", "ligar", "completar", "desenhar", "oral"];
export const ANSWER_FORMAT_LABEL: Record<AnswerFormat, string> = {
  escrever: "Escrever", marcar: "Marcar", ligar: "Ligar", completar: "Completar", desenhar: "Desenhar", oral: "Responder falando",
};
type AnswerSpace = "alternativas" | "linhas" | "desenho" | null;
export const ANSWER_LINES = 2;
export const answerSpaceOf = (item: Pick<AdaptedItem, "options" | "answerFormat">): AnswerSpace =>
  item.options.length ? "alternativas"
    : item.answerFormat === "escrever" || item.answerFormat === "completar" ? "linhas"
      : item.answerFormat === "desenhar" ? "desenho" : null;

export const LEVEL_LABEL: Record<LevelKey, string> = { mais_apoio: "Com mais apoio", padrao: "Padrão", desafio: "Com desafio" };

export const ADAPT_OPTIONS = [
  { key: "linguagem_simples", label: "Linguagem simples", aiOnly: true, checked: true },
  { key: "ordem_por_vez", label: "Enunciado curto, uma ordem por linha", aiOnly: false, checked: true },
  { key: "destacar_comando", label: "Destacar o comando (circule, marque, escreva…)", aiOnly: false, checked: true },
  { key: "apoio_visual", label: "Apoio visual: ícone da forma de responder", aiOnly: false, checked: true },
  { key: "escolha", label: "Resposta por escolha no lugar da escrita", aiOnly: true, checked: true },
  { key: "menos_itens", label: "Menos questões por página (3)", aiOnly: false, checked: false },
  { key: "letra_ampliada", label: "Letra ampliada na impressão", aiOnly: false, checked: false },
] as const;
export type AdaptOption = (typeof ADAPT_OPTIONS)[number]["key"];
export const isAdaptOption = (value: string): value is AdaptOption => ADAPT_OPTIONS.some((option) => option.key === value);

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clip = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const COMMANDS: [RegExp, AnswerFormat][] = [
  [/\b(marque|marcar|assinale|assinalar|circule|circular|sublinhe|sublinhar|pinte o quadrinho)\b/, "marcar"],
  [/\b(ligue|ligar|relacione|relacionar|associe|associar)\b/, "ligar"],
  [/\b(complete|completar|preencha|preencher)\b/, "completar"],
  [/\b(desenhe|desenhar|pinte|pintar|ilustre|ilustrar)\b/, "desenhar"],
  [/\b(conte para|fale|falar|diga|dizer|explique oralmente|leia em voz alta)\b/, "oral"],
];
const COMMAND_WORDS = /\b(leia|ler|observe|observar|escreva|escrever|responda|responder|copie|copiar|resolva|resolver|calcule|calcular|numere|numerar|recorte|recortar|cole|colar|marque|marcar|assinale|circule|sublinhe|ligue|relacione|associe|complete|preencha|desenhe|pinte|ilustre|conte|fale|diga|explique|ordene|separe|encontre)\b/gi;

function answerFormatOf(prompt: string): AnswerFormat {
  const text = plain(prompt);
  return COMMANDS.find(([pattern]) => pattern.test(text))?.[1] ?? "escrever";
}

const oneOrderPerLine = (prompt: string) => prompt.split(/(?<=[.!?;])\s+/).map((part) => part.trim()).filter(Boolean).join("\n");

const ITEM_START = /^\s*(?:quest[aã]o\s*)?(\d{1,2})\s*[).:\-–]\s*/i;
const OPTION_START = /^\s*(?:\(\s*\)\s*)?([a-h])\s*[).]\s+/i;

function splitTask(text: string): { prompt: string; options: string[] }[] {
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trim());
  const numbered = lines.some((line) => ITEM_START.test(line));
  const items: { prompt: string; options: string[] }[] = [];
  let current: { prompt: string; options: string[] } | null = null;
  for (const line of lines) {
    if (!line) {
      if (!numbered && current) { items.push(current); current = null; }
      continue;
    }
    if (numbered && ITEM_START.test(line)) {
      if (current) items.push(current);
      current = { prompt: line.replace(ITEM_START, ""), options: [] };
    } else if (current && OPTION_START.test(line)) {
      current.options.push(line.replace(OPTION_START, ""));
    } else if (current) {
      if (current.options.length) current.options[current.options.length - 1] += ` ${line}`;
      else current.prompt += ` ${line}`;
    } else {
      current = { prompt: line, options: [] };
    }
  }
  if (current) items.push(current);
  return items.filter((item) => item.prompt.trim()).slice(0, 40);
}

const SUPPORT_BY_FORMAT: Record<AnswerFormat, string> = {
  escrever: "Pode responder com uma palavra, desenho ou apontando na prancha.",
  marcar: "Leia cada alternativa junto com o estudante antes de ele marcar.",
  ligar: "Cubra os pares já ligados para mostrar um par por vez.",
  completar: "Ofereça as palavras para completar em fichas.",
  desenhar: "Aceite colagem ou escolha entre figuras prontas.",
  oral: "Registre a resposta falada do estudante na folha.",
};

export function adaptByRules(input: { title: string; text: string; kind: TaskKind }, options: readonly AdaptOption[]): AdaptedContent {
  const has = (option: AdaptOption) => options.includes(option);
  const items = splitTask(input.text).map((item, index) => {
    const answerFormat = item.options.length ? "marcar" : answerFormatOf(item.prompt);
    return {
      number: index + 1,
      prompt: has("ordem_por_vez") ? oneOrderPerLine(clip(item.prompt, 1200)) : clip(item.prompt, 1200),
      answerFormat,
      options: item.options.map((option) => clip(option, 300)),
      support: SUPPORT_BY_FORMAT[answerFormat],
    } satisfies AdaptedItem;
  });
  const notes = [
    has("ordem_por_vez") ? "Cada enunciado foi separado em uma ordem por linha." : "",
    has("destacar_comando") ? "Os comandos de cada questão aparecem em destaque." : "",
    has("apoio_visual") ? "Cada questão mostra um ícone da forma de responder." : "",
    has("menos_itens") ? "A impressão traz até 3 questões por página." : "",
    has("letra_ampliada") ? "A impressão usa letra ampliada." : "",
    options.some((option) => ADAPT_OPTIONS.find((item) => item.key === option)?.aiOnly) ? "Linguagem simples e resposta por escolha precisam da IA: sem ela, o texto das questões ficou como estava." : "",
  ].filter(Boolean);
  return {
    title: clip(input.title, 160) || (input.kind === "prova" ? "Prova adaptada" : "Atividade adaptada"),
    instructions: ["Faça uma questão por vez.", "Peça ajuda quando precisar."],
    items,
    teacherNotes: notes,
    preserved: input.kind === "prova" ? "As questões e o que elas avaliam são os mesmos da prova da turma; mudou só a apresentação." : "O conteúdo é o mesmo da atividade da turma; mudou a apresentação.",
  };
}

export function normalizeAdapted(raw: Partial<AdaptedContent> | null | undefined, fallbackTitle: string): AdaptedContent {
  const items = (Array.isArray(raw?.items) ? raw.items : []).slice(0, 40).map((item, index) => ({
    number: index + 1,
    prompt: String(item?.prompt ?? "").trim().slice(0, 1200),
    answerFormat: ANSWER_FORMATS.includes(item?.answerFormat as AnswerFormat) ? (item.answerFormat as AnswerFormat) : "escrever",
    options: (Array.isArray(item?.options) ? item.options : []).map((option) => clip(option, 300)).filter(Boolean).slice(0, 8),
    support: clip(item?.support, 400),
  })).filter((item) => item.prompt);
  return {
    title: clip(raw?.title, 160) || fallbackTitle,
    instructions: (Array.isArray(raw?.instructions) ? raw.instructions : []).map((line) => clip(line, 200)).filter(Boolean).slice(0, 6),
    items,
    teacherNotes: (Array.isArray(raw?.teacherNotes) ? raw.teacherNotes : []).map((line) => clip(line, 300)).filter(Boolean).slice(0, 10),
    preserved: clip(raw?.preserved, 400),
  };
}

export function levelsByRules(base: AdaptedContent): Record<LevelKey, AdaptedContent> {
  const copy = (content: AdaptedContent): AdaptedContent => ({ ...content, items: content.items.map((item) => ({ ...item, options: [...item.options] })), instructions: [...content.instructions], teacherNotes: [...content.teacherNotes] });
  const standard = copy(base);
  const support = copy(base);
  support.items = support.items.map((item) => ({ ...item, prompt: oneOrderPerLine(item.prompt) }));
  support.instructions = ["Faça uma questão por vez.", "Use os apoios indicados em cada questão.", "Peça ajuda quando precisar."];
  support.teacherNotes = ["Uma ordem por linha e o apoio de cada questão à vista."];
  const challenge = copy(base);
  challenge.items = challenge.items.map((item) => ({ ...item, prompt: `${item.prompt}\nAgora, explique como chegou à resposta ou crie uma pergunta parecida para um colega.` }));
  challenge.instructions = ["Responda e, em cada questão, faça também o desafio."];
  challenge.teacherNotes = ["Mesma questão, com um desafio de explicar ou criar."];
  standard.teacherNotes = ["A atividade da turma, como foi planejada."];
  return { mais_apoio: support, padrao: standard, desafio: challenge };
}

export function printSettings(options: readonly string[]): { largeText: boolean; itemsPerPage: number | null } {
  return { largeText: options.includes("letra_ampliada"), itemsPerPage: options.includes("menos_itens") ? 3 : null };
}

export function printPages<T>(items: readonly T[], perPage: number | null): T[][] {
  if (!perPage) return [items.slice()];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += perPage) pages.push(items.slice(index, index + perPage));
  return pages.length ? pages : [[]];
}

export function highlightParts(prompt: string): { text: string; command: boolean }[] {
  const parts: { text: string; command: boolean }[] = [];
  let last = 0;
  for (const match of prompt.matchAll(COMMAND_WORDS)) {
    if (match.index > last) parts.push({ text: prompt.slice(last, match.index), command: false });
    parts.push({ text: match[0], command: true });
    last = match.index + match[0].length;
  }
  if (last < prompt.length) parts.push({ text: prompt.slice(last), command: false });
  return parts;
}
