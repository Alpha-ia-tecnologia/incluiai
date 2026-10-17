import { prisma } from "../prisma";
import { loadAnonymizer } from "../agents/anonymize";
import { parseJson } from "../format";
import { normalizeMaterialContent, type MaterialCard, type MaterialKind } from "../material-content";
import { STYLE } from "./activity-image";
import { ImageGenerationError, generateImage } from "./openai-images";

// Pictogramas dos cartões do material, um por cartão, pela OpenAI. O pedido leva
// só a descrição visual do cartão, o estilo e o tema de interesse — nada de nome
// ou dado pessoal (o anonimizador ainda passa por cima). Fica fora dos arquivos
// "use server": quem chama confere a permissão antes.

export const MAX_MATERIAL_IMAGES = 12;
const CONCURRENCY = 3;

const KIND_STYLE: Partial<Record<MaterialKind, string>> = {
  prancha_caa: "Um único conceito centralizado, grande, para comunicação alternativa.",
  regulacao: "Expressões faciais simples e calmas; cores suaves associadas ao nível (verde, amarelo, laranja).",
  historia_social: "Cena simples de escola, acolhedora, com a criança em destaque.",
};

export function buildMaterialCardPrompt(card: MaterialCard, kind: MaterialKind, theme: string[], calmVisuals: boolean, clean: (text: string) => string) {
  return [
    `Crie um pictograma quadrado para um cartão de apoio: ${clean(card.visual || card.label)}`,
    `O cartão significa: "${clean(card.label)}".`,
    KIND_STYLE[kind] ?? "",
    theme.length ? `Quando couber, use como tema visual: ${theme.join(" e ")}.` : "",
    calmVisuals ? "O estudante é sensível a estímulos visuais: pouquíssimos elementos, cores neutras e um único foco." : "",
    STYLE,
  ].filter(Boolean).join("\n");
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) await Promise.all(items.slice(index, index + size).map(work));
}

// Gera as imagens que faltam (ou as indicadas) e devolve quantas saíram e os erros.
export async function generateMaterialImages(materialId: string, user: { name: string; role: string }, only?: number[]) {
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

  const anonymizer = await loadAnonymizer(material.studentId);
  const theme = parseJson<string[]>(material.student.profile?.interests ?? null, []).slice(0, 2);
  const calmVisuals = parseJson<Record<string, string>>(material.student.profile?.sensoryProfile ?? null, {}).visual === "hiper";
  const errors = new Set<string>();
  let created = 0;
  await inBatches(wanted, CONCURRENCY, async ({ card, index }) => {
    const prompt = buildMaterialCardPrompt(card, material.kind as MaterialKind, theme, calmVisuals, anonymizer.applyNatural);
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
    await prisma.accessLog.create({ data: { studentId: material.studentId, actor: user.name, role: user.role, action: "criou", detail: `Imagens do material "${material.title}" (OpenAI, sem dados pessoais)` } });
  }
  return { created, errors: [...errors] };
}
