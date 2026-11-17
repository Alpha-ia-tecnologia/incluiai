import { UPLOAD_LIMIT_BYTES } from "./uploads.ts";
import { dateOf, normalize, readStudentRecord, type StudentFields, type StudentRecord } from "./student-record.ts";

export const IMPORT_MAX_ROWS = 500;

export const SHEET_UPLOAD = {
  maxBytes: UPLOAD_LIMIT_BYTES.studentSheet,
  missing: "Escolha o arquivo da planilha (.csv).",
  tooLarge: "Arquivo grande demais. Divida a planilha em partes de até 500 estudantes.",
};

type SheetField = Exclude<keyof StudentFields, "accessibilityNotes">;

export type ImportRow = { line: number; name: string; values: StudentRecord | null; errors: string[] };

const COLUMNS: Record<SheetField, string[]> = {
  name: ["nome", "nome_do_estudante", "nome_completo", "estudante", "aluno", "nome_do_aluno"],
  birthDate: ["nascimento", "data_de_nascimento", "data_nascimento", "dt_nascimento"],
  stage: ["etapa", "etapa_de_ensino", "nivel", "segmento"],
  gradeYear: ["ano", "serie", "ano_serie", "ano_escolar"],
  className: ["turma", "classe"],
  shift: ["turno"],
  guardianName: ["responsavel", "nome_do_responsavel", "responsavel_legal"],
  guardianPhone: ["telefone", "telefone_do_responsavel", "celular", "contato"],
  aeeFrequency: ["frequencia_aee", "frequencia_do_aee"],
  supportProfessional: ["profissional_de_apoio", "apoio"],
};
const REQUIRED: SheetField[] = ["name", "birthDate", "gradeYear", "className", "shift", "guardianName"];
export const COLUMN_LABELS: Record<SheetField, string> = {
  name: "nome", birthDate: "nascimento", stage: "etapa", gradeYear: "ano", className: "turma", shift: "turno",
  guardianName: "responsavel", guardianPhone: "telefone", aeeFrequency: "frequencia_aee", supportProfessional: "profissional_de_apoio",
};

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

const YES = new Set(["sim", "s", "x", "1", "true", "yes"]);
const NO = new Set(["", "nao", "n", "0", "false", "no"]);

export function mapHeader(header: string[]): { index: Partial<Record<SheetField, number>>; missing: string[] } {
  const names = header.map(normalize);
  const index: Partial<Record<SheetField, number>> = {};
  for (const [field, aliases] of Object.entries(COLUMNS) as [SheetField, string[]][]) {
    const position = names.findIndex((name) => aliases.includes(name));
    if (position >= 0) index[field] = position;
  }
  return { index, missing: REQUIRED.filter((field) => index[field] === undefined).map((field) => COLUMN_LABELS[field]) };
}

export function readStudentSheet(text: string, today: Date = new Date()): { rows: ImportRow[]; problem: string | null } {
  if (text.length > SHEET_UPLOAD.maxBytes) return { rows: [], problem: SHEET_UPLOAD.tooLarge };
  const [header, ...lines] = parseCsv(text);
  if (!header) return { rows: [], problem: "A planilha está vazia." };
  const { index, missing } = mapHeader(header);
  if (missing.length) return { rows: [], problem: `Faltam colunas na primeira linha: ${missing.join(", ")}. Baixe o modelo para ver os nomes.` };
  if (!lines.length) return { rows: [], problem: "A planilha só tem o cabeçalho. Coloque um estudante por linha, a partir da segunda." };
  if (lines.length > IMPORT_MAX_ROWS) return { rows: [], problem: `A planilha tem ${lines.length} linhas. Importe no máximo ${IMPORT_MAX_ROWS} por vez.` };
  const seen = new Map<string, number>();
  const rows = lines.map((cells, position): ImportRow => {
    const line = position + 2;
    const cell = (field: SheetField) => (index[field] === undefined ? "" : (cells[index[field]!] ?? "").trim());
    const support = normalize(cell("supportProfessional"));
    const { record, problems } = readStudentRecord({
      name: cell("name"), birthDate: cell("birthDate"), stage: cell("stage"), gradeYear: cell("gradeYear"), className: cell("className"),
      shift: cell("shift"), guardianName: cell("guardianName"), guardianPhone: cell("guardianPhone"), aeeFrequency: cell("aeeFrequency"),
      supportProfessional: YES.has(support),
    }, today);
    const errors = problems.map((item) => item.message);
    const name = cell("name").replace(/\s+/g, " ");
    if (TEMPLATE_EXAMPLES.has(normalize(name))) errors.push("linha de exemplo do modelo: apague antes de importar");
    if (!YES.has(support) && !NO.has(support)) errors.push(`profissional de apoio: use sim ou não ("${cell("supportProfessional")}")`);
    const birthDate = dateOf(cell("birthDate"));
    if (name && birthDate) {
      const key = studentKey(name, birthDate);
      const first = seen.get(key);
      if (first) errors.push(`repetido na planilha (linha ${first})`);
      else seen.set(key, line);
    }
    return { line, name, values: errors.length ? null : record, errors };
  });
  return { rows, problem: null };
}

export const studentKey = (name: string, birthDate: string) => `${normalize(name)}|${birthDate}`;

// Ponto e vírgula e BOM, como o Excel em português abre.
export const IMPORT_TEMPLATE = "﻿" + [
  "nome;nascimento;etapa;ano;turma;turno;responsavel;telefone;frequencia_aee;profissional_de_apoio",
  "Exemplo Estudante Um;15/03/2018;Anos iniciais;2º ano;Turma A;Manhã;Nome do Responsável;(98) 90000-0000;2x por semana;não",
  "Exemplo Estudante Dois;02/09/2014;;6º ano;Turma B;Tarde;Nome da Responsável;;;não",
].join("\r\n") + "\r\n";

const TEMPLATE_EXAMPLES = new Set(["exemplo_estudante_um", "exemplo_estudante_dois"]);
