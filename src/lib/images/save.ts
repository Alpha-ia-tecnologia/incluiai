import { db } from "../prisma";
import { buildActivityImagePrompt } from "./activity-image";
import { generateImage } from "./openai-images";
import { redactorFor } from "../agents/names-in-scope";

// Fica fora dos arquivos "use server" para não virar uma ação pública.
export async function createActivityImage(activityId: string, kind: string, user: { name: string; role: string }) {
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
  await prisma.accessLog.create({
    data: { studentId: activity.studentId, actor: user.name, role: user.role, action: "criou", detail: "Imagem de apoio da atividade (OpenAI, sem dados pessoais)" },
  });
}
