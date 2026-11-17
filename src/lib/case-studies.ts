import "server-only";
import { db } from "./prisma";
import { assertStudentTeam, studentForbidden, type SessionUser } from "./auth";
import { can } from "./roles";
import { AUDIT_ACTION, recordChange } from "./audit";
import { invalidateStudent } from "./invalidate";
import { UserError } from "./user-error";
import { CASE_STUDY_FIELDS, CLINICAL_CASE_FIELDS, RETIRED_CASE_FIELDS, conductedByAee, missingToConclude, parseCaseStudy, type CaseStudyContent } from "./case-study";
import { mergeIntoCaseStudy, type ReportAccepted } from "./health-report";

const MAX_LENGTH = 3000;

type CaseStudyChange =
  | { answers: (key: string) => unknown; conclude: boolean }
  | { reportFields: ReportAccepted["fields"] };

function fromForm(previous: CaseStudyContent, answers: (key: string) => unknown, clinical: boolean): CaseStudyContent {
  const content: CaseStudyContent = {};
  for (const key of RETIRED_CASE_FIELDS) if (previous[key]) content[key] = previous[key];
  for (const field of CASE_STUDY_FIELDS) {
    const value = !clinical && CLINICAL_CASE_FIELDS.has(field.key) ? previous[field.key] : String(answers(field.key) ?? "").trim().slice(0, MAX_LENGTH);
    if (value) content[field.key] = value;
  }
  return content;
}

export async function saveCaseStudy(user: SessionUser, studentId: string, change: CaseStudyChange): Promise<{ status: string; missingAee: boolean }> {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const clinical = can(user.role, "seeClinical");
  const fromReport = "reportFields" in change;
  if (fromReport && !clinical) throw studentForbidden();
  const existing = await prisma.caseStudy.findUnique({ where: { studentId }, select: { content: true, status: true } });
  const previous = parseCaseStudy(existing?.content);
  const content = fromReport ? mergeIntoCaseStudy(previous, change.reportFields) : fromForm(previous, change.answers, clinical);
  const conclude = !fromReport && change.conclude;
  if (conclude && missingToConclude(content).length > 0) {
    throw new UserError("Preencha os campos essenciais antes de concluir o estudo de caso.");
  }
  // Conduzido pelo professor do AEE (INEP).
  const missingAee = conclude && !conductedByAee(content);
  const concluding = conclude && !missingAee && existing?.status !== "concluido";
  const status = concluding || existing?.status === "concluido" ? "concluido" : "rascunho";
  const data = { content: JSON.stringify(content), status, updatedBy: user.name, ...(concluding ? { concludedAt: new Date() } : {}) };
  await prisma.caseStudy.upsert({ where: { studentId }, create: { studentId, ...data }, update: data });
  await recordChange(user, studentId, existing ? AUDIT_ACTION.edited : AUDIT_ACTION.created, fromReport ? "Estudo de caso: informações do laudo" : "Estudo de caso");
  if (concluding) {
    await prisma.timelineEvent.create({ data: { studentId, type: "avaliacao", title: "Estudo de caso concluído", description: content.sintese ?? null } });
  }
  invalidateStudent(studentId);
  return { status, missingAee };
}
