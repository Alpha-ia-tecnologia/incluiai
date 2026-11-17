"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { AUDIT_ACTION, recordChange } from "@/lib/audit";
import { requireStudentTeam } from "@/lib/auth";

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
  const prisma = await db();
  const user = await requireStudentTeam(studentId);

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

  const sensoryValue = (area: string) =>
    String(formData.get(`sens_${area}`) ?? "").trim() || "tipica";
  const sensory = JSON.stringify({
    auditiva: sensoryValue("auditiva"),
    visual: sensoryValue("visual"),
    tatil: sensoryValue("tatil"),
    vestibular: sensoryValue("vestibular"),
    proprioceptiva: sensoryValue("proprioceptiva"),
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

  await recordChange(user, studentId, AUDIT_ACTION.edited, "Perfil funcional");

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  redirect(`/estudantes/${studentId}/perfil?salvo=${Date.now()}`);
}

