import type { Problem } from "./user-error.ts";
import { brDay, brYmd } from "./dates.ts";

export type StudentFields = {
  name: string;
  birthDate: string;
  stage: string;
  gradeYear: string;
  className: string;
  shift: string;
  guardianName: string;
  guardianPhone?: string;
  aeeFrequency?: string;
  accessibilityNotes?: string;
  supportProfessional: boolean;
};

export type StudentRecord = {
  name: string;
  birthDate: string;
  stage: string;
  gradeYear: string;
  className: string;
  shift: string;
  guardianName: string;
  guardianPhone: string | null;
  aeeFrequency: string | null;
  accessibilityNotes: string | null;
  supportProfessional: boolean;
};

export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const STAGES: Record<string, string> = {
  educacao_infantil: "educacao_infantil", infantil: "educacao_infantil", creche: "educacao_infantil", pre_escola: "educacao_infantil",
  anos_iniciais: "anos_iniciais", fundamental_anos_iniciais: "anos_iniciais", ensino_fundamental_anos_iniciais: "anos_iniciais", fundamental_i: "anos_iniciais", fundamental_1: "anos_iniciais",
  anos_finais: "anos_finais", fundamental_anos_finais: "anos_finais", ensino_fundamental_anos_finais: "anos_finais", fundamental_ii: "anos_finais", fundamental_2: "anos_finais",
  ensino_medio: "ensino_medio", medio: "ensino_medio",
  eja: "eja", educacao_de_jovens_e_adultos: "eja",
};

export function stageOf(stage: string, gradeYear: string): string | null {
  if (stage.trim()) return STAGES[normalize(stage)] ?? null;
  const grade = normalize(gradeYear);
  if (/infantil|pre|creche|maternal|bercario/.test(grade)) return "educacao_infantil";
  if (/eja/.test(grade)) return "eja";
  const year = /^(\d)_?o?_ano/.exec(grade)?.[1];
  if (!year) return null;
  return Number(year) <= 5 ? "anos_iniciais" : "anos_finais";
}

// Corte etário de 31 de março.
export function stageFromAge(birthDate: string, now: Date): string {
  const [year, month] = birthDate.split("-").map(Number);
  const age = brYmd(now).year - year - (month > 3 ? 1 : 0);
  if (age <= 5) return "educacao_infantil";
  if (age <= 10) return "anos_iniciais";
  if (age <= 14) return "anos_finais";
  if (age <= 17) return "ensino_medio";
  return "eja";
}

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
  if (["noite", "noturno"].includes(value)) return "noite";
  return text.trim().slice(0, 40);
}

const oneLine = (text: string) => text.trim().replace(/\s+/g, " ");

export function readStudentRecord(fields: StudentFields, today: Date = new Date()): { record: StudentRecord | null; problems: Problem[] } {
  const problems: Problem[] = [];
  const problem = (field: keyof StudentFields, message: string) => problems.push({ field, message });
  const name = oneLine(fields.name);
  if (name.length < 3) problem("name", "nome em branco ou curto demais");
  const todayIso = brDay(today);
  const birthDate = dateOf(fields.birthDate);
  if (!birthDate) problem("birthDate", "nascimento inválido (use DD/MM/AAAA)");
  else if (birthDate > todayIso) problem("birthDate", "nascimento no futuro");
  else if (Number(todayIso.slice(0, 4)) - Number(birthDate.slice(0, 4)) > 100) problem("birthDate", "nascimento há mais de 100 anos");
  const gradeYear = fields.gradeYear.trim();
  if (!gradeYear) problem("gradeYear", "ano em branco");
  const stage = stageOf(fields.stage, gradeYear);
  if (!stage) problem("stage", fields.stage.trim() ? `etapa não reconhecida ("${fields.stage.trim()}")` : "informe a etapa (não deu para deduzir pelo ano)");
  const className = fields.className.trim();
  if (!className) problem("className", "turma em branco");
  const shift = shiftOf(fields.shift);
  if (!shift) problem("shift", "turno em branco");
  const guardianName = oneLine(fields.guardianName);
  if (!guardianName) problem("guardianName", "responsável em branco");
  if (problems.length || !birthDate || !stage) return { record: null, problems };
  return {
    record: {
      name, birthDate, stage, gradeYear: gradeYear.slice(0, 40), className: className.slice(0, 40), shift,
      guardianName: guardianName.slice(0, 120),
      guardianPhone: fields.guardianPhone?.trim().slice(0, 40) || null,
      aeeFrequency: fields.aeeFrequency?.trim().slice(0, 60) || null,
      accessibilityNotes: fields.accessibilityNotes?.trim() || null,
      supportProfessional: fields.supportProfessional,
    },
    problems,
  };
}
