import type { Problem } from "./user-error.ts";
import { brDay, brYmd } from "./dates.ts";
import { SHIFTS, STAGES as STAGE_LABEL } from "./scale.ts";
import { ACCESSIBILITY_NOTE_OPTIONS, AEE_FREQUENCY_OPTIONS, GRADES_BY_STAGE, GRADE_YEAR_OPTIONS } from "./form-options.ts";
import { YES_NO, asOptions, type ChatField } from "./guided-chat.ts";

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

export type SchoolChoice = { value: string; label: string; classes: { name: string; gradeYear: string | null; shift: string }[] };
type Registration = { schools: SchoolChoice[] };

const STUDENT = "Dados do estudante";
const GUARDIAN = "Responsável e apoios";
const LATER = "Prefiro informar depois";
const classesOf = (schoolId: unknown, { schools }: Registration) => schools.find((school) => school.value === schoolId)?.classes ?? [];

export const STUDENT_FIELDS: ChatField<Registration>[] = [
  { key: "name", section: STUDENT, label: "Nome completo", question: "Para começar, qual é o nome completo do estudante?", hint: "Use o nome registrado nos documentos escolares.", input: "text", placeholder: "Nome completo", required: true },
  { key: "birthDate", section: STUDENT, label: "Data de nascimento", question: "Qual é a data de nascimento?", input: "date", required: true },
  {
    key: "schoolId", section: STUDENT, label: "Escola", question: "Em qual escola o estudante está matriculado?", input: "choice", required: true,
    options: (_answers, { schools }) => schools,
    onAnswer: (next, previous) => (next.schoolId === previous.schoolId ? next
      : Object.fromEntries(Object.entries(next).filter(([key]) => !["className", "gradeYear", "shift"].includes(key)))),
  },
  { key: "stage", section: STUDENT, label: "Etapa", question: "Qual é a etapa de ensino?", input: "choice", options: Object.entries(STAGE_LABEL).map(([value, label]) => ({ value, label })), required: true },
  {
    key: "gradeYear", section: STUDENT, label: "Ano / série", question: "Em qual ano ou série está?", input: "choice", required: true,
    options: (answers) => asOptions(GRADES_BY_STAGE[String(answers.stage)] ?? GRADE_YEAR_OPTIONS), other: { placeholder: "Ex.: Multisseriada" },
  },
  {
    key: "className", section: STUDENT, label: "Turma", question: "Qual é a turma?", hint: "Escolha uma turma cadastrada na escola ou escreva o nome em Outro.", input: "choice", required: true,
    options: (answers, registration) => classesOf(answers.schoolId, registration).map((item) => ({ value: item.name, label: item.name })), other: { placeholder: "Ex.: Turma Girassol" },
    onAnswer: (next, _previous, registration) => {
      const shift = classesOf(next.schoolId, registration).find((item) => item.name === next.className)?.shift;
      return shift && !next.shift ? { ...next, shift } : next;
    },
  },
  { key: "shift", section: STUDENT, label: "Turno", question: "Em qual turno estuda?", input: "choice", options: Object.entries(SHIFTS).map(([value, label]) => ({ value, label })), other: { placeholder: "Ex.: Noite" }, required: true },
  { key: "guardianName", section: GUARDIAN, label: "Responsável", question: "Quem é o responsável pelo estudante?", input: "text", placeholder: "Nome completo do responsável", required: true },
  { key: "guardianPhone", section: GUARDIAN, label: "Telefone", question: "Qual é o telefone do responsável?", input: "tel", placeholder: "(00) 00000-0000", skip: LATER },
  { key: "aeeFrequency", section: GUARDIAN, label: "Frequência do atendimento", question: "Com qual frequência é atendido?", hint: "Atendimento Educacional Especializado.", input: "choice", options: asOptions(AEE_FREQUENCY_OPTIONS), other: { placeholder: "Ex.: 2 vezes por semana, à tarde" }, skip: LATER },
  { key: "supportProfessional", section: GUARDIAN, label: "Profissional de apoio", question: "O estudante conta com profissional de apoio?", input: "choice", options: YES_NO, checkbox: true, required: true },
  {
    key: "accessibilityNotes", section: GUARDIAN, label: "Informações de acessibilidade", question: "Há alguma informação de acessibilidade importante?",
    hint: "Marque o que se aplica. Registre apenas informações relevantes para a participação e aprendizagem.",
    input: "chips", options: asOptions(ACCESSIBILITY_NOTE_OPTIONS), separator: ";", other: { placeholder: "Ex.: precisa sentar perto da porta" }, skip: "Não há informação a acrescentar",
  },
];
