// Importação de estudantes por planilha (CSV), pura para teste com node --test
// (src/lib/student-import.test.mjs): lê o arquivo como o Excel e o LibreOffice
// salvam (ponto e vírgula ou vírgula, aspas, acentos), reconhece as colunas
// pelo nome e confere cada linha antes de qualquer gravação.

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 512 * 1024;

export type StudentImport = {
  name: string;
  birthDate: string; // AAAA-MM-DD
  stage: string;
  gradeYear: string;
  className: string;
  shift: string;
  guardianName: string;
  guardianPhone: string | null;
  hasAEE: boolean;
  aeeFrequency: string | null;
  supportProfessional: boolean;
};

// name: como está na planilha, para a pessoa achar a linha com problema.
export type ImportRow = { line: number; name: string; values: StudentImport | null; errors: string[] };

// Sem acento, minúsculo, só letras e números separados por "_".
export const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// Nomes de coluna aceitos (já normalizados).
const COLUMNS: Record<keyof StudentImport, string[]> = {
  name: ["nome", "nome_do_estudante", "nome_completo", "estudante", "aluno", "nome_do_aluno"],
  birthDate: ["nascimento", "data_de_nascimento", "data_nascimento", "dt_nascimento"],
  stage: ["etapa", "etapa_de_ensino", "nivel", "segmento"],
  gradeYear: ["ano", "serie", "ano_serie", "ano_escolar"],
  className: ["turma", "classe"],
  shift: ["turno"],
  guardianName: ["responsavel", "nome_do_responsavel", "responsavel_legal"],
  guardianPhone: ["telefone", "telefone_do_responsavel", "celular", "contato"],
  hasAEE: ["aee", "atendimento_aee", "frequenta_aee", "atendimento_educacional_especializado"],
  aeeFrequency: ["frequencia_aee", "frequencia_do_aee"],
  supportProfessional: ["profissional_de_apoio", "apoio"],
};
const REQUIRED: (keyof StudentImport)[] = ["name", "birthDate", "gradeYear", "className", "shift", "guardianName"];
export const COLUMN_LABELS: Record<keyof StudentImport, string> = {
  name: "nome", birthDate: "nascimento", stage: "etapa", gradeYear: "ano", className: "turma", shift: "turno",
  guardianName: "responsavel", guardianPhone: "telefone", hasAEE: "aee", aeeFrequency: "frequencia_aee", supportProfessional: "profissional_de_apoio",
};

// CSV com aspas (campos com separador ou quebra de linha dentro) e o separador
// que aparecer mais na primeira linha.
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const separator = [";", ",", "\t"].map((item) => ({ item, count: firstLine.split(item).length })).sort((a, b) => b.count - a.count)[0].item;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < clean.length; index++) {
    const char = clean[index];
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && !field) quoted = true;
    else if (char === separator) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[index + 1] === "\n") index++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

const STAGES: Record<string, string> = {
  educacao_infantil: "educacao_infantil", infantil: "educacao_infantil", creche: "educacao_infantil", pre_escola: "educacao_infantil",
  anos_iniciais: "anos_iniciais", fundamental_anos_iniciais: "anos_iniciais", ensino_fundamental_anos_iniciais: "anos_iniciais", fundamental_i: "anos_iniciais", fundamental_1: "anos_iniciais",
  anos_finais: "anos_finais", fundamental_anos_finais: "anos_finais", ensino_fundamental_anos_finais: "anos_finais", fundamental_ii: "anos_finais", fundamental_2: "anos_finais",
  ensino_medio: "ensino_medio", medio: "ensino_medio",
  eja: "eja", educacao_de_jovens_e_adultos: "eja",
};

// Etapa pela coluna ou, sem ela, pelo ano ("3º ano" → anos iniciais).
export function stageOf(stage: string, gradeYear: string): string | null {
  if (stage.trim()) return STAGES[normalize(stage)] ?? null;
  const grade = normalize(gradeYear);
  if (/infantil|pre|creche|maternal|bercario/.test(grade)) return "educacao_infantil";
  if (/eja/.test(grade)) return "eja";
  const year = /^(\d)_?o?_ano/.exec(grade)?.[1];
  if (!year) return null;
  return Number(year) <= 5 ? "anos_iniciais" : "anos_finais";
}

// Data como DD/MM/AAAA (ou com hífen) ou AAAA-MM-DD; precisa existir no calendário.
export function dateOf(text: string): string | null {
  const value = text.trim();
  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parts = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : null;
  if (!parts) return null;
  const [year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function shiftOf(text: string): string {
  const value = normalize(text);
  if (["manha", "matutino"].includes(value)) return "manha";
  if (["tarde", "vespertino"].includes(value)) return "tarde";
  if (value === "integral") return "integral";
  if (["noite", "noturno"].includes(value)) return "Noite";
  return text.trim().slice(0, 40);
}

const YES = new Set(["sim", "s", "x", "1", "true", "yes"]);
const NO = new Set(["", "nao", "n", "0", "false", "no"]);

// Cabeçalho → índice de cada campo; colunas obrigatórias que faltam.
export function mapHeader(header: string[]): { index: Partial<Record<keyof StudentImport, number>>; missing: string[] } {
  const names = header.map(normalize);
  const index: Partial<Record<keyof StudentImport, number>> = {};
  for (const [field, aliases] of Object.entries(COLUMNS) as [keyof StudentImport, string[]][]) {
    const position = names.findIndex((name) => aliases.includes(name));
    if (position >= 0) index[field] = position;
  }
  return { index, missing: REQUIRED.filter((field) => index[field] === undefined).map((field) => COLUMN_LABELS[field]) };
}

// Confere a planilha inteira: cada linha vira um estudante pronto ou uma lista de problemas.
export function readStudentSheet(text: string, today: Date = new Date()): { rows: ImportRow[]; problem: string | null } {
  if (text.length > IMPORT_MAX_BYTES) return { rows: [], problem: "Arquivo grande demais. Divida a planilha em partes de até 500 estudantes." };
  const [header, ...lines] = parseCsv(text);
  if (!header) return { rows: [], problem: "A planilha está vazia." };
  const { index, missing } = mapHeader(header);
  if (missing.length) return { rows: [], problem: `Faltam colunas na primeira linha: ${missing.join(", ")}. Baixe o modelo para ver os nomes.` };
  if (!lines.length) return { rows: [], problem: "A planilha só tem o cabeçalho. Coloque um estudante por linha, a partir da segunda." };
  if (lines.length > IMPORT_MAX_ROWS) return { rows: [], problem: `A planilha tem ${lines.length} linhas. Importe no máximo ${IMPORT_MAX_ROWS} por vez.` };
  const todayIso = today.toISOString().slice(0, 10);
  const seen = new Map<string, number>();
  const rows = lines.map((cells, position): ImportRow => {
    const line = position + 2;
    const cell = (field: keyof StudentImport) => (index[field] === undefined ? "" : (cells[index[field]!] ?? "").trim());
    const errors: string[] = [];
    const name = cell("name").replace(/\s+/g, " ");
    if (name.length < 3) errors.push("nome em branco ou curto demais");
    const birthDate = dateOf(cell("birthDate"));
    if (!birthDate) errors.push("nascimento inválido (use DD/MM/AAAA)");
    else if (birthDate > todayIso) errors.push("nascimento no futuro");
    else if (Number(todayIso.slice(0, 4)) - Number(birthDate.slice(0, 4)) > 100) errors.push("nascimento há mais de 100 anos");
    const gradeYear = cell("gradeYear");
    if (!gradeYear) errors.push("ano em branco");
    const stage = stageOf(cell("stage"), gradeYear);
    if (!stage) errors.push(cell("stage") ? `etapa não reconhecida ("${cell("stage")}")` : "informe a etapa (não deu para deduzir pelo ano)");
    const className = cell("className");
    if (!className) errors.push("turma em branco");
    const shift = shiftOf(cell("shift"));
    if (!shift) errors.push("turno em branco");
    const guardianName = cell("guardianName").replace(/\s+/g, " ");
    if (!guardianName) errors.push("responsável em branco");
    const aee = normalize(cell("hasAEE"));
    if (!YES.has(aee) && !NO.has(aee)) errors.push(`AEE: use sim ou não ("${cell("hasAEE")}")`);
    const hasAEE = YES.has(aee);
    const aeeFrequency = cell("aeeFrequency") || null;
    if (hasAEE && !aeeFrequency) errors.push("informe a frequência do AEE (ex.: 2x por semana)");
    const support = normalize(cell("supportProfessional"));
    if (!YES.has(support) && !NO.has(support)) errors.push(`profissional de apoio: use sim ou não ("${cell("supportProfessional")}")`);
    if (name && birthDate) {
      const key = `${normalize(name)}|${birthDate}`;
      const first = seen.get(key);
      if (first) errors.push(`repetido na planilha (linha ${first})`);
      else seen.set(key, line);
    }
    if (errors.length) return { line, name, values: null, errors };
    return {
      line, name, errors,
      values: {
        name, birthDate: birthDate!, stage: stage!, gradeYear: gradeYear.slice(0, 40), className: className.slice(0, 40), shift,
        guardianName: guardianName.slice(0, 120), guardianPhone: cell("guardianPhone").slice(0, 40) || null,
        hasAEE, aeeFrequency: hasAEE ? aeeFrequency!.slice(0, 60) : null, supportProfessional: YES.has(support),
      },
    };
  });
  return { rows, problem: null };
}

// Chave para achar quem já está cadastrado (mesmo nome e nascimento na escola).
export const studentKey = (name: string, birthDate: string) => `${normalize(name)}|${birthDate}`;

// Modelo para baixar: ponto e vírgula e BOM, como o Excel em português abre.
export const IMPORT_TEMPLATE = "﻿" + [
  "nome;nascimento;etapa;ano;turma;turno;responsavel;telefone;aee;frequencia_aee;profissional_de_apoio",
  "Exemplo Estudante Um;15/03/2018;Anos iniciais;2º ano;Turma A;Manhã;Nome do Responsável;(98) 90000-0000;sim;2x por semana;não",
  "Exemplo Estudante Dois;02/09/2014;;6º ano;Turma B;Tarde;Nome da Responsável;;não;;não",
].join("\r\n") + "\r\n";
