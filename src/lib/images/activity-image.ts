import type { Activity, FunctionalProfile } from "@prisma/client";
import { parseJson, readList } from "../format";
import { CONTEXTS, labelOf } from "../scale";
import type { ImageSize } from "./openai-images";

export const IMAGE_KINDS = [
  { value: "sequencia", label: "Sequência visual dos passos", size: "1536x1024" },
  { value: "ilustracao", label: "Ilustração da atividade", size: "1024x1024" },
  { value: "cartoes", label: "Cartões de escolha (pictogramas)", size: "1536x1024" },
] as const satisfies readonly { value: string; label: string; size: ImageSize }[];

const imageSizeOf = (kind: string): ImageSize => IMAGE_KINDS.find((item) => item.value === kind)?.size ?? "1024x1024";
export const imageWidthOf = (kind: string) => Number(imageSizeOf(kind).split("x")[0]);

export const STYLE = [
  "Estilo: pictograma de comunicação alternativa e aumentativa, ilustração plana para crianças.",
  "Contornos pretos simples, poucas cores suaves e bem contrastantes, fundo branco liso, sem sombras nem texturas.",
  "Sem nenhum texto, letra, palavra ou número escrito na imagem, exceto quando pedido.",
  "Pessoas genéricas e diversas, desenhadas de forma simples, sem retratar alguém real.",
].join(" ");

export function visualPreferences(profile: Pick<FunctionalProfile, "interests" | "sensoryProfile"> | null): string[] {
  const theme = readList(profile?.interests ?? null).slice(0, 2);
  const calm = parseJson<Record<string, string>>(profile?.sensoryProfile ?? null, {}).visual === "hiper";
  return [
    theme.length ? `Quando couber, use como tema visual: ${theme.join(" e ")}.` : "",
    calm ? "O estudante é sensível a estímulos visuais: use pouquíssimos elementos, cores neutras e um único foco por quadro." : "",
  ].filter(Boolean);
}

export function buildActivityImagePrompt(activity: Activity, profile: FunctionalProfile | null, kindOrDescription: string) {
  const kind = kindOrDescription;
  const steps = readList(activity.steps).slice(0, 6);
  const materials = readList(activity.materials);
  const title = activity.title;
  const where = `Contexto: ${labelOf(CONTEXTS, activity.context)}.`;

  let content: string;
  let altText: string;
  if (kind === "sequencia") {
    content = `Crie uma prancha com ${steps.length} quadros lado a lado, em ordem da esquerda para a direita, cada um mostrando uma ação da atividade "${title}". Numere os quadros com algarismos grandes (1, 2, 3...). Ações: ${steps.map((step, index) => `${index + 1}) ${step}`).join(" ")}`;
    altText = `Sequência visual em ${steps.length} quadros da atividade "${title}".`;
  } else if (kind === "cartoes") {
    content = `Crie de 4 a 6 cartões quadrados separados, em grade, cada um com um pictograma de um objeto ou ação usados na atividade "${title}", para o estudante apontar ou escolher. Materiais: ${materials.join(", ") || "os da atividade"}.`;
    altText = `Cartões de escolha com pictogramas da atividade "${title}".`;
  } else if (kind === "ilustracao") {
    content = `Crie uma ilustração única que mostre a atividade "${title}" acontecendo. Materiais: ${materials.join(", ") || "os da atividade"}.`;
    altText = `Ilustração da atividade "${title}".`;
  } else {
    content = `Crie a seguinte imagem de apoio para a atividade "${title}": ${kind}`;
    altText = `Imagem de apoio da atividade "${title}": ${kind}`;
  }

  return { prompt: [content, ...visualPreferences(profile), where, STYLE].join("\n"), size: imageSizeOf(kind), altText };
}
