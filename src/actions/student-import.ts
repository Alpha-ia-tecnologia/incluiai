"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { isAccountManager } from "@/lib/user-admin";
import { IMPORT_MAX_BYTES, normalize, readStudentSheet, studentKey, type StudentImport } from "@/lib/student-import";

// Importação de estudantes por planilha (seção 7, cadastro da rede): primeiro
// confere e mostra o que entra, o que já está cadastrado e o que tem problema;
// só grava ao confirmar, lendo e conferindo a planilha de novo no servidor.

type Line = { line: number; name: string };
export type ImportState = {
  problem?: string;
  csv?: string;
  schoolId?: string;
  schoolName?: string;
  // similar: já existe alguém com o mesmo nome na escola, com outro nascimento (homônimo ou erro de digitação).
  ready?: (Line & { detail: string; similar: boolean })[];
  existing?: Line[];
  invalid?: (Line & { errors: string[] })[];
  imported?: number;
};

async function requireImporter(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAccountManager(user.role)) redirect("/estudantes");
  return user;
}

// Excel em português às vezes salva o CSV em Windows-1252: sem UTF-8 válido, relê assim.
async function readFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function analyze(text: string, schoolId: string) {
  const { rows, problem } = readStudentSheet(text);
  if (problem) return { problem } as const;
  const current = await prisma.student.findMany({ where: { schoolId }, select: { name: true, birthDate: true } });
  const known = new Set(current.map((student) => studentKey(student.name, student.birthDate.toISOString().slice(0, 10))));
  const names = new Set(current.map((student) => normalize(student.name)));
  const ready: { line: number; values: StudentImport }[] = [];
  const existing: Line[] = [];
  const invalid: (Line & { errors: string[] })[] = [];
  for (const row of rows) {
    if (!row.values) invalid.push({ line: row.line, name: row.name, errors: row.errors });
    else if (known.has(studentKey(row.values.name, row.values.birthDate))) existing.push({ line: row.line, name: row.values.name });
    else ready.push({ line: row.line, values: row.values });
  }
  return { ready: ready.map((row) => ({ ...row, similar: names.has(normalize(row.values.name)) })), existing, invalid } as const;
}

const birth = (iso: string) => iso.split("-").reverse().join("/");

export async function importStudents(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireImporter();
  const schoolId = user.schoolId ?? String(formData.get("schoolId") ?? "");
  const school = schoolId ? await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true } }) : null;
  if (!school) return { problem: "Escolha a escola dos estudantes." };

  const confirming = formData.get("intent") === "importar";
  let text = "";
  if (confirming) text = String(formData.get("csv") ?? "");
  else {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return { problem: "Escolha o arquivo da planilha (.csv)." };
    if (file.size > IMPORT_MAX_BYTES) return { problem: "Arquivo grande demais. Divida a planilha em partes de até 500 estudantes." };
    text = await readFile(file);
  }

  const result = await analyze(text, school.id);
  if ("problem" in result) return { problem: result.problem };
  const { invalid } = result;

  if (!confirming) {
    return {
      csv: text, schoolId: school.id, schoolName: school.name,
      ready: result.ready.map(({ line, values, similar }) => ({ line, name: values.name, similar, detail: `${birth(values.birthDate)} · ${values.gradeYear} · ${values.className}` })),
      existing: result.existing, invalid,
    };
  }

  // Confirmado: só as linhas prontas entram; o resto fica para corrigir.
  await prisma.$transaction(result.ready.map(({ values }) => prisma.student.create({
    data: {
      name: values.name, birthDate: new Date(`${values.birthDate}T12:00:00`), stage: values.stage, gradeYear: values.gradeYear,
      className: values.className, shift: values.shift, schoolId: school.id, hasAEE: values.hasAEE, aeeFrequency: values.aeeFrequency,
      supportProfessional: values.supportProfessional, guardianName: values.guardianName, guardianPhone: values.guardianPhone,
      avatarHue: Math.floor(Math.random() * 360),
      timeline: { create: { type: "avaliacao", title: "Cadastro no prontuário municipal", description: "Estudante incluído pela importação de planilha." } },
      accessLogs: { create: { actor: user.name, role: user.role, action: "criou", detail: "Cadastro pela importação de planilha" } },
    },
  })));
  revalidatePath("/estudantes");
  revalidatePath("/");
  return { imported: result.ready.length, schoolName: school.name, existing: result.existing, invalid };
}
