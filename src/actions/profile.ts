"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  canAccessStudent,
  getCurrentUser,
  isStaffOrNetwork,
} from "@/lib/auth";

const SUPPORT_FIELDS = [
  "readingSupport",
  "writingSupport",
  "mathSupport",
  "peerInteraction",
  "adultInteraction",
  "groupWork",
  "feeding",
  "hygiene",
  "mobility",
  "organization",
  "fineMotor",
  "grossMotor",
] as const;

function csvToJson(value: FormDataEntryValue | null): string {
  const items = String(value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

export async function upsertProfile(studentId: string, formData: FormData) {
  const user = await getCurrentUser();
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, schoolId: true },
  });
  if (
    !user ||
    !student ||
    !isStaffOrNetwork(user.role) ||
    !canAccessStudent(user, student.schoolId, student.id)
  ) {
    throw new Error("Você não tem permissão para editar este perfil.");
  }

  const interests = csvToJson(formData.get("interests"));
  if ((JSON.parse(interests) as string[]).length === 0) {
    throw new Error("Informe ao menos um interesse âncora.");
  }

  const supports = Object.fromEntries(
    SUPPORT_FIELDS.map((field) => [
      field,
      Number(formData.get(field) ?? 0),
    ]),
  ) as Record<(typeof SUPPORT_FIELDS)[number], number>;
  if (
    Object.values(supports).some(
      (value) => !Number.isInteger(value) || value < 0 || value > 5,
    )
  ) {
    throw new Error("Os níveis de apoio devem estar entre 0 e 5.");
  }

  const sensory = JSON.stringify({
    auditiva: String(formData.get("sens_auditiva") ?? "tipica"),
    visual: String(formData.get("sens_visual") ?? "tipica"),
    tatil: String(formData.get("sens_tatil") ?? "tipica"),
    vestibular: String(formData.get("sens_vestibular") ?? "tipica"),
    proprioceptiva: String(
      formData.get("sens_proprioceptiva") ?? "tipica",
    ),
  });

  const data = {
    expressiveChannel: String(
      formData.get("expressiveChannel") ?? "fala",
    ),
    receptiveChannel: String(
      formData.get("receptiveChannel") ?? "fala",
    ),
    commandSteps: Number(formData.get("commandSteps") ?? 1),
    attentionMinutes: Number(formData.get("attentionMinutes") ?? 10),
    ...supports,
    sensoryProfile: sensory,
    usesWheelchairOrOrthosis:
      formData.get("usesWheelchairOrOrthosis") === "on",
    triggers: csvToJson(formData.get("triggers")),
    earlySigns: csvToJson(formData.get("earlySigns")),
    calmingStrategies: csvToJson(formData.get("calmingStrategies")),
    bestShift: String(formData.get("bestShift") ?? "manha"),
    taskToleranceMinutes: Number(
      formData.get("taskToleranceMinutes") ?? 15,
    ),
    interests,
    barriers: JSON.stringify(formData.getAll("barriers").map(String)),
    strengths: String(formData.get("strengths") ?? "").trim() || null,
  };

  await prisma.functionalProfile.upsert({
    where: { studentId },
    create: { studentId, ...data },
    update: data,
  });

  await prisma.accessLog.create({
    data: {
      studentId,
      actor: user.name,
      role: user.role,
      action: "editou",
      detail: "Perfil funcional",
    },
  });

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  redirect(`/estudantes/${studentId}/perfil`);
}

