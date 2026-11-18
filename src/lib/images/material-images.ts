import { db } from "../prisma";
import { AUDIT_ACTION, recordChange, type AuditActor } from "../audit";
import { redactorFor } from "../agents/names-in-scope";
import { parseJson } from "../format";
import { MAX_MATERIAL_IMAGES, normalizeMaterialContent, type MaterialCard, type MaterialKind } from "../material-content";
import { STYLE, visualPreferences } from "./activity-image";
import { ImageGenerationError, generateImage } from "./openai-images";

// Fica fora dos arquivos "use server" para não virar uma ação pública.

const CONCURRENCY = 3;

const KIND_STYLE: Partial<Record<MaterialKind, string>> = {
  prancha_caa: "Um único conceito centralizado, grande, para comunicação alternativa.",
  regulacao: "Expressões faciais simples e calmas; cores suaves associadas ao nível (verde, amarelo, laranja).",
  historia_social: "Cena simples de escola, acolhedora, com a criança em destaque.",
};

export function buildMaterialCardPrompt(card: MaterialCard, kind: MaterialKind, preferences: string[]) {
  return [
    `Crie um pictograma quadrado para um cartão de apoio: ${card.visual || card.label}`,
    `O cartão significa: "${card.label}".`,
    KIND_STYLE[kind] ?? "",
    ...preferences,
    STYLE,
  ].filter(Boolean).join("\n");
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) await Promise.all(items.slice(index, index + size).map(work));
}

export async function generateMaterialImages(materialId: string, user: AuditActor, only?: number[]) {
  const prisma = await db();
  const material = await prisma.material.findUniqueOrThrow({
    where: { id: materialId },
    include: { images: { select: { cardIndex: true } }, student: { select: { profile: { select: { interests: true, sensoryProfile: true } } } } },
  });
  const content = normalizeMaterialContent(parseJson<unknown>(material.content, {}));
  const existing = new Set(material.images.map((image) => image.cardIndex));
  const wanted = content.cards
    .map((card, index) => ({ card, index }))
    .filter(({ index }) => index < MAX_MATERIAL_IMAGES && (only ? only.includes(index) : !existing.has(index)));
  if (!wanted.length) return { created: 0, errors: [] as string[] };

  const redactor = await redactorFor({ student: material.studentId });
  const preferences = visualPreferences(material.student.profile);
  const errors = new Set<string>();
  let created = 0;
  await inBatches(wanted, CONCURRENCY, async ({ card, index }) => {
    const prompt = redactor.redactInWords(buildMaterialCardPrompt(card, material.kind as MaterialKind, preferences));
    try {
      const image = await generateImage(prompt, "1024x1024");
      const data = { prompt, altText: card.alt || card.label, mimeType: image.mimeType, data: image.data, model: image.model, createdAt: new Date() };
      await prisma.materialImage.upsert({ where: { materialId_cardIndex: { materialId, cardIndex: index } }, create: { materialId, cardIndex: index, ...data }, update: data });
      created += 1;
    } catch (error) {
      console.error(`[imagens] cartão ${index + 1} do material ${materialId}:`, error);
      errors.add(error instanceof ImageGenerationError ? error.message : "Não foi possível gerar uma das imagens agora.");
    }
  });
  if (created) {
    await recordChange(user, material.studentId, AUDIT_ACTION.created, `Imagens do material "${material.title}" (OpenAI, sem dados pessoais)`);
  }
  return { created, errors: [...errors] };
}
