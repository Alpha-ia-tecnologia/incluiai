import { db } from "../prisma";
import { AUDIT_ACTION, recordChange, type AuditActor } from "../audit";
import { buildActivityImagePrompt } from "./activity-image";
import { generateImage } from "./openai-images";
import { redactorFor } from "../agents/names-in-scope";
import { isImageGenerationEnabled, studentAI } from "../agents/capabilities";
import { UserError } from "../user-error";

export async function assertImagesAllowed(studentId: string) {
  if (!isImageGenerationEnabled()) throw new UserError("A geração de imagens não está configurada (falta OPENAI_API_KEY).");
  if (!(await studentAI(studentId)).images) throw new UserError("A família ainda não autorizou o uso de IA com os dados deste estudante.");
}

// Fica fora dos arquivos "use server" para não virar uma ação pública.
export async function createActivityImage(activityId: string, kind: string, user: AuditActor) {
  const prisma = await db();
  const activity = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    include: { student: { select: { profile: true } } },
  });
  const redactor = await redactorFor({ student: activity.studentId });
  const request = buildActivityImagePrompt(activity, activity.student.profile, kind);
  const prompt = redactor.redactInWords(request.prompt);
  const altText = redactor.redactInWords(request.altText);
  const image = await generateImage(prompt, request.size);
  const data = { kind, prompt, altText, mimeType: image.mimeType, data: image.data, model: image.model, createdBy: user.name, createdAt: new Date() };
  await prisma.activityImage.upsert({ where: { activityId }, create: { activityId, ...data }, update: data });
  await recordChange(user, activity.studentId, AUDIT_ACTION.created, "Imagem de apoio da atividade (OpenAI, sem dados pessoais)");
}
