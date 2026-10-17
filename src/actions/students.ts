"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";

const validStages = new Set([
  "educacao_infantil",
  "anos_iniciais",
  "anos_finais",
  "ensino_medio",
  "eja",
]);
// O turno aceita as opções padrão ou um valor digitado em "Outro" (ex.: Noite).
const isValidShift = (shift: string) => shift.length > 0 && shift.length <= 40;

export async function createStudent(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isStaffOrNetwork(user.role)) {
    throw new Error("Você não tem permissão para cadastrar estudantes.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "");
  const schoolId = String(formData.get("schoolId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const gradeYear = String(formData.get("gradeYear") ?? "").trim();
  const className = String(formData.get("className") ?? "").trim();
  const shift = String(formData.get("shift") ?? "").trim();
  const guardianName = String(formData.get("guardianName") ?? "").trim();
  const hasAEE = formData.get("hasAEE") === "on";
  const aeeFrequency = String(formData.get("aeeFrequency") ?? "").trim();
  const parsedBirthDate = new Date(`${birthDate}T12:00:00`);

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true },
  });

  if (
    !name ||
    !birthDate ||
    !school ||
    !validStages.has(stage) ||
    !gradeYear ||
    !className ||
    !isValidShift(shift) ||
    !guardianName ||
    (hasAEE && !aeeFrequency) ||
    Number.isNaN(parsedBirthDate.getTime()) ||
    parsedBirthDate > new Date()
  ) {
    throw new Error("Revise os dados obrigatórios antes de salvar.");
  }

  const student = await prisma.student.create({
    data: {
      name,
      birthDate: parsedBirthDate,
      stage,
      gradeYear,
      className,
      shift,
      schoolId,
      hasAEE,
      aeeFrequency: hasAEE ? aeeFrequency : null,
      supportProfessional: formData.get("supportProfessional") === "on",
      guardianName,
      guardianPhone:
        String(formData.get("guardianPhone") ?? "").trim() || null,
      accessibilityNotes:
        String(formData.get("accessibilityNotes") ?? "").trim() || null,
      avatarHue: Math.floor(Math.random() * 360),
      timeline: {
        create: {
          type: "avaliacao",
          title: "Cadastro no prontuário municipal",
          description: "Estudante incluído na plataforma.",
        },
      },
    },
  });

  await prisma.accessLog.create({
    data: {
      studentId: student.id,
      actor: user.name,
      role: user.role,
      action: "criou",
      detail: "Cadastro do estudante",
    },
  });

  revalidatePath("/estudantes");
  revalidatePath("/");
  redirect(`/estudantes/${student.id}`);
}

export async function logStudentAccess(studentId: string, detail: string) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.accessLog.create({
    data: {
      studentId,
      actor: user.name,
      role: user.role,
      action: "visualizou",
      detail,
    },
  });
}

