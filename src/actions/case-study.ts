"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canSeeClinicalDetail, canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { CASE_STUDY_FIELDS, CLINICAL_CASE_FIELDS, missingToConclude, parseCaseStudy, type CaseStudyContent } from "@/lib/case-study";

const MAX_LENGTH = 3000;

// Salva o estudo de caso como rascunho ou o conclui. A equipe pode preencher
// em várias conversas; só a conclusão exige os campos essenciais.
export async function saveCaseStudy(studentId: string, formData: FormData) {
  const user = await getCurrentUser();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (
    !user || !student ||
    !isStaffOrNetwork(user.role) ||
    !canSeePedagogicalDetail(user.role) ||
    !canAccessStudent(user, student.schoolId, student.id)
  ) {
    throw new Error("Você não tem permissão para editar o estudo de caso deste estudante.");
  }

  const clinical = canSeeClinicalDetail(user.role);
  const stored = clinical ? null : parseCaseStudy((await prisma.caseStudy.findUnique({ where: { studentId }, select: { content: true } }))?.content);
  const content: CaseStudyContent = {};
  for (const field of CASE_STUDY_FIELDS) {
    // Sem permissão para dado clínico, o campo continua como estava (o formulário nem o mostra).
    if (!clinical && CLINICAL_CASE_FIELDS.has(field.key)) {
      if (stored?.[field.key]) content[field.key] = stored[field.key];
      continue;
    }
    const value = String(formData.get(field.key) ?? "").trim().slice(0, MAX_LENGTH);
    if (value) content[field.key] = value;
  }

  const conclude = formData.get("intent") === "concluir";
  if (conclude && missingToConclude(content).length > 0) {
    throw new Error("Preencha os campos essenciais antes de concluir o estudo de caso.");
  }

  const existing = await prisma.caseStudy.findUnique({ where: { studentId }, select: { status: true } });
  const status = conclude ? "concluido" : existing?.status === "concluido" ? "concluido" : "rascunho";
  const data = {
    content: JSON.stringify(content),
    status,
    updatedBy: user.name,
    ...(conclude && existing?.status !== "concluido" ? { concludedAt: new Date() } : {}),
  };
  await prisma.caseStudy.upsert({
    where: { studentId },
    create: { studentId, ...data },
    update: data,
  });

  await prisma.accessLog.create({
    data: { studentId, actor: user.name, role: user.role, action: existing ? "editou" : "criou", detail: "Estudo de caso" },
  });
  if (conclude && existing?.status !== "concluido") {
    await prisma.timelineEvent.create({
      data: {
        studentId,
        type: "avaliacao",
        title: "Estudo de caso concluído",
        description: content.sintese ?? null,
      },
    });
  }

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  redirect(`/estudantes/${studentId}/estudo-de-caso${conclude || status === "concluido" ? "" : "?salvo=1"}`);
}
