"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import {
  CASE_STUDY_FIELDS, isCaseStudySection, missingToConclude, parseCaseStudy, sectionOfField, type CaseStudyContent,
} from "@/lib/case-study";

const MAX_LENGTH = 3000;

// Salva o estudo de caso, uma parte por vez. O formulário só traz os campos da
// parte aberta, então o que veio no envio substitui o salvo e o resto é
// mantido. `irPara` diz qual parte abrir depois; `intent=concluir` conclui.
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

  const existing = await prisma.caseStudy.findUnique({ where: { studentId }, select: { status: true, content: true } });
  const saved = parseCaseStudy(existing?.content);
  const content: CaseStudyContent = { ...saved };
  for (const field of CASE_STUDY_FIELDS) {
    if (!formData.has(field.key)) continue;
    const value = String(formData.get(field.key) ?? "").trim().slice(0, MAX_LENGTH);
    if (value) content[field.key] = value;
    else delete content[field.key];
  }
  const changed = CASE_STUDY_FIELDS.some((field) => (saved[field.key] ?? "") !== (content[field.key] ?? ""));

  const wasConcluded = existing?.status === "concluido";
  const missing = missingToConclude(content);
  const conclude = formData.get("intent") === "concluir" && missing.length === 0;
  const status = conclude || wasConcluded ? "concluido" : "rascunho";

  if (changed || (conclude && !wasConcluded)) {
    const data = {
      content: JSON.stringify(content),
      status,
      updatedBy: user.name,
      ...(conclude && !wasConcluded ? { concludedAt: new Date() } : {}),
    };
    await prisma.caseStudy.upsert({ where: { studentId }, create: { studentId, ...data }, update: data });
    await prisma.accessLog.create({
      data: { studentId, actor: user.name, role: user.role, action: existing ? "editou" : "criou", detail: "Estudo de caso" },
    });
    if (conclude && !wasConcluded) {
      await prisma.timelineEvent.create({
        data: { studentId, type: "avaliacao", title: "Estudo de caso concluído", description: content.sintese ?? null },
      });
    }
    revalidatePath("/estudantes/[id]", "layout");
    revalidatePath("/estudantes");
    revalidatePath("/");
  }

  const base = `/estudantes/${studentId}/estudo-de-caso`;
  if (conclude) redirect(base);

  const query = new URLSearchParams();
  if (wasConcluded) query.set("editar", "1");
  if (formData.get("intent") === "concluir") {
    // Faltam respostas em outras partes: abre a primeira delas com a lista.
    query.set("parte", sectionOfField(missing[0].key).id);
    query.set("faltam", "1");
  } else {
    const target = formData.get("irPara");
    const current = formData.get("parte");
    query.set("parte", isCaseStudySection(target) ? target : isCaseStudySection(current) ? current : "motivo");
    if (changed) query.set("salvo", "1");
  }
  redirect(`${base}?${query}`);
}
