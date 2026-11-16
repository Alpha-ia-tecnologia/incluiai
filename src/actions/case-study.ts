"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canEditStudentRecord, canSeeClinicalDetail, getCurrentUser } from "@/lib/auth";
import { CASE_STUDY_FIELDS, CLINICAL_CASE_FIELDS, RETIRED_CASE_FIELDS, conductedByAee, missingToConclude, parseCaseStudy, type CaseStudyContent } from "@/lib/case-study";

const MAX_LENGTH = 3000;

// Salva o estudo de caso como rascunho ou o conclui. A equipe pode preencher
// em várias conversas; só a conclusão exige os campos essenciais.
export async function saveCaseStudy(studentId: string, formData: FormData) {
  const user = await getCurrentUser();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (
    !user || !student ||
    !canEditStudentRecord(user.role) ||
    !canAccessStudent(user, student.schoolId, student.id)
  ) {
    throw new Error("Você não tem permissão para editar o estudo de caso deste estudante.");
  }

  const clinical = canSeeClinicalDetail(user.role);
  const previous = parseCaseStudy((await prisma.caseStudy.findUnique({ where: { studentId }, select: { content: true } }))?.content);
  const stored = clinical ? null : previous;
  const content: CaseStudyContent = {};
  // Respostas de campos que saíram do formulário continuam guardadas no estudo.
  for (const key of RETIRED_CASE_FIELDS) if (previous[key]) content[key] = previous[key];
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

  // Conduzido pelo professor do AEE (INEP): sem ele entre os participantes, o
  // estudo é salvo, mas não conclui, e a página avisa. Nada do que foi preenchido se perde.
  const missingAee = conclude && !conductedByAee(content);
  const concluding = conclude && !missingAee;

  const existing = await prisma.caseStudy.findUnique({ where: { studentId }, select: { status: true } });
  const status = concluding ? "concluido" : existing?.status === "concluido" ? "concluido" : "rascunho";
  const data = {
    content: JSON.stringify(content),
    status,
    updatedBy: user.name,
    ...(concluding && existing?.status !== "concluido" ? { concludedAt: new Date() } : {}),
  };
  await prisma.caseStudy.upsert({
    where: { studentId },
    create: { studentId, ...data },
    update: data,
  });

  await prisma.accessLog.create({
    data: { studentId, actor: user.name, role: user.role, action: existing ? "editou" : "criou", detail: "Estudo de caso" },
  });
  if (concluding && existing?.status !== "concluido") {
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
  if (missingAee) redirect(`/estudantes/${studentId}/estudo-de-caso?${status === "concluido" ? "editar=1&" : ""}faltaAee=1#secao-essencial`);
  // A leitura confirma que salvou e mostra o próximo passo; o rascunho volta ao formulário.
  redirect(`/estudantes/${studentId}/estudo-de-caso${conclude || status === "concluido" ? "?concluido=1" : "?salvo=1"}`);
}
