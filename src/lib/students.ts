import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { AUDIT_ACTION, auditEntry, type AuditActor } from "./audit";
import { invalidateStudent } from "./invalidate";
import { canAccessSchool } from "./policy";
import { can } from "./roles";
import { UserError } from "./user-error";
import { readStudentRecord, type StudentFields, type StudentRecord } from "./student-record";
import { readStudentSheet } from "./student-import";
import { nameBirthKey, normalizeName } from "./student-identity";

const ORIGIN = {
  cadastro: { title: "Cadastro no prontuário municipal", description: "Estudante incluído na plataforma.", detail: "Cadastro do estudante" },
  planilha: { title: "Cadastro no prontuário municipal", description: "Estudante incluído pela importação de planilha.", detail: "Cadastro pela importação de planilha" },
  censo: { title: "Cadastro pelo arquivo do Censo Escolar", description: "A etapa foi estimada pela idade. Confira ano, turma, turno e responsável.", detail: "Cadastro pelo arquivo do Censo Escolar" },
} as const;

type NewStudent = Pick<StudentRecord, "name" | "birthDate" | "stage" | "gradeYear" | "className" | "shift" | "guardianName"> &
  Partial<Pick<StudentRecord, "guardianPhone" | "aeeFrequency" | "accessibilityNotes" | "supportProfessional">> &
  { schoolId: string; inepId?: string | null; cpf?: string | null; census?: string };

export function newStudentData(actor: AuditActor, student: NewStudent, origin: keyof typeof ORIGIN) {
  const { title, description, detail } = ORIGIN[origin];
  return {
    ...student,
    birthDate: new Date(`${student.birthDate}T12:00:00`),
    hasAEE: true,
    avatarHue: Math.floor(Math.random() * 360),
    timeline: { create: { type: "avaliacao", title, description } },
    accessLogs: { create: auditEntry(actor, AUDIT_ACTION.created, detail) },
  };
}

async function schoolForNewStudents(user: SessionUser, schoolId: string) {
  const prisma = await db();
  if (!can(user.role, "pedagogical")) throw new UserError("Você não tem permissão para cadastrar estudantes.", "forbidden");
  const school = schoolId ? await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true } }) : null;
  if (!school) throw new UserError("Escolha a escola dos estudantes.");
  if (!canAccessSchool(user, school.id)) throw new UserError("Você cadastra estudantes só na sua escola.", "forbidden");
  return school;
}

export async function createStudent(user: SessionUser, schoolId: string, fields: StudentFields): Promise<{ id: string }> {
  const prisma = await db();
  const school = await schoolForNewStudents(user, schoolId);
  const { record, problems } = readStudentRecord(fields);
  if (!record) throw new UserError("Revise os dados obrigatórios antes de salvar.", "invalid", problems);
  const student = await prisma.student.create({ data: newStudentData(user, { ...record, schoolId: school.id }, "cadastro"), select: { id: true } });
  invalidateStudent(student.id);
  return student;
}

type SheetLine = { line: number; name: string };
export type SheetCheck = {
  school: { id: string; name: string };
  ready: { line: number; record: StudentRecord; similar: boolean }[];
  existing: SheetLine[];
  invalid: (SheetLine & { errors: string[] })[];
};

export async function checkStudentSheet(user: SessionUser, schoolId: string, text: string): Promise<SheetCheck> {
  const prisma = await db();
  const school = await schoolForNewStudents(user, schoolId);
  const { rows, problem } = readStudentSheet(text);
  if (problem) throw new UserError(problem);
  const current = await prisma.student.findMany({ where: { schoolId: school.id }, select: { name: true, birthDate: true } });
  const known = new Set(current.map((student) => nameBirthKey(student.name, student.birthDate.toISOString().slice(0, 10))));
  const names = new Set(current.map((student) => normalizeName(student.name)));
  const sheet: SheetCheck = { school, ready: [], existing: [], invalid: [] };
  for (const row of rows) {
    if (!row.values) sheet.invalid.push({ line: row.line, name: row.name, errors: row.errors });
    else if (known.has(nameBirthKey(row.values.name, row.values.birthDate))) sheet.existing.push({ line: row.line, name: row.values.name });
    else sheet.ready.push({ line: row.line, record: row.values, similar: names.has(normalizeName(row.values.name)) });
  }
  return sheet;
}

export async function importStudentSheet(user: SessionUser, schoolId: string, text: string): Promise<SheetCheck> {
  const prisma = await db();
  const sheet = await checkStudentSheet(user, schoolId, text);
  await prisma.$transaction(sheet.ready.map(({ record }) => prisma.student.create({ data: newStudentData(user, { ...record, schoolId: sheet.school.id }, "planilha") })));
  revalidatePath("/estudantes");
  revalidatePath("/");
  return sheet;
}
