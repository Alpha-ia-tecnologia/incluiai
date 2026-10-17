import { prisma } from "../prisma";
import { buildActivityImagePrompt } from "./activity-image";
import { generateImage } from "./openai-images";
import { loadAnonymizer } from "../agents/anonymize";

// Gera e guarda a imagem de apoio de uma atividade (substitui a anterior).
// Fica fora dos arquivos "use server": quem chama confere a permissão antes.
export async function createActivityImage(activityId: string, kind: string, user: { name: string; role: string }) {
  const activity = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    include: { student: { select: { profile: true } } },
  });
  const anonymizer = await loadAnonymizer(activity.studentId);
  const { prompt, size, altText } = buildActivityImagePrompt(activity, activity.student.profile, kind, anonymizer.applyNatural);
  const image = await generateImage(prompt, size);
  const data = { kind, prompt, altText, mimeType: image.mimeType, data: image.data, model: image.model, createdBy: user.name, createdAt: new Date() };
  await prisma.activityImage.upsert({ where: { activityId }, create: { activityId, ...data }, update: data });
  await prisma.accessLog.create({
    data: { studentId: activity.studentId, actor: user.name, role: user.role, action: "criou", detail: "Imagem de apoio da atividade (OpenAI, sem dados pessoais)" },
  });
}
