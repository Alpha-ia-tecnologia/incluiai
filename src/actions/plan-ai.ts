"use server";

import { validBnccCode } from "@/lib/bncc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireStudentTeam } from "@/lib/auth";
import { buildObjectiveDescription } from "@/lib/objective";
import { createPlanDraft } from "@/lib/agents/generate";
import { assertCaseStudyConcluded, assertNoActivePlan } from "@/lib/records";
import { PlanProposalSchema } from "@/lib/agents/schemas";
import { planDocumentsFromForm } from "@/lib/plan-documents";

const requireTeam = requireStudentTeam;

export async function generatePlanDraft(studentId: string) {
  const user = await requireTeam(studentId);
  await createPlanDraft(studentId, user);
  revalidatePath(`/estudantes/${studentId}/ppi`);
  redirect(`/estudantes/${studentId}/ppi#proposta`);
}

export async function activatePlanDraft(studentId: string, formData: FormData) {
  const prisma = await db();
  const user = await requireTeam(studentId);
  await assertCaseStudyConcluded(studentId);
  await assertNoActivePlan(studentId);
  const draft = await prisma.planDraft.findUnique({ where: { studentId } });
  if (!draft) throw new Error("A proposta não foi encontrada. Gere uma nova proposta.");
  const proposal = PlanProposalSchema.parse(JSON.parse(draft.content));
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { name: true } });

  const text = (field: string) => String(formData.get(field) ?? "").trim();
  const initialSituation = text("initialSituation");
  const reviewDate = new Date(`${text("reviewDate")}T12:00:00`);
  if (!initialSituation || Number.isNaN(reviewDate.getTime())) {
    throw new Error("Informe o que o estudante já consegue fazer e a data de revisão.");
  }
  const chosen = formData.getAll("objetivo").map(Number).filter((index) => proposal.objectives[index]);

  await prisma.plan.create({
    data: {
      studentId,
      status: "ativo",
      initialSituation,
      ...planDocumentsFromForm((name) => formData.get(name)),
      reviewDate,
      objectives: {
        create: chosen.map((index) => {
          const objective = proposal.objectives[index];
          return {
            action: objective.action,
            condition: objective.condition,
            criterion: objective.criterion,
            deadlineWeeks: objective.deadlineWeeks,
            description: buildObjectiveDescription({ studentName: student.name, ...objective }),
            bnccCode: validBnccCode(objective.bnccCode),
            dimension: objective.dimension,
            currentSupport: objective.currentSupport,
            targetSupport: objective.targetSupport,
          };
        }),
      },
    },
  });
  await prisma.planDraft.delete({ where: { studentId } });
  await prisma.timelineEvent.create({
    data: {
      studentId,
      type: "plano",
      title: "PAEE e PEI elaborados",
      description: `Plano criado a partir de proposta ${draft.source === "ia" ? "dos agentes de IA" : "do motor de regras"}, revisada pela equipe, com ${chosen.length} objetivo(s).`,
    },
  });
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "criou", detail: "Plano individual (a partir de proposta)" } });

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  redirect(`/estudantes/${studentId}/ppi`);
}

export async function discardPlanDraft(studentId: string) {
  const prisma = await db();
  const user = await requireTeam(studentId);
  await prisma.planDraft.deleteMany({ where: { studentId } });
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "editou", detail: "Proposta de plano descartada" } });
  revalidatePath(`/estudantes/${studentId}/ppi`);
}
