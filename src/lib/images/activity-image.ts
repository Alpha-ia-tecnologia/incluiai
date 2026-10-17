import type { Activity, FunctionalProfile } from "@prisma/client";
import { parseJson } from "../format";
import { CONTEXTS } from "../scale";
import type { ImageSize } from "./openai-images";

// Monta o pedido de imagem de apoio de uma atividade. Só entram o conteúdo
// da atividade e os interesses do estudante: nenhum nome ou dado pessoal.

export const IMAGE_KINDS = [
  { value: "sequencia", label: "Sequência visual dos passos" },
  { value: "ilustracao", label: "Ilustração da atividade" },
  { value: "cartoes", label: "Cartões de escolha (pictogramas)" },
] as const;

const STYLE = [
  "Estilo: pictograma de comunicação alternativa e aumentativa, ilustração plana para crianças.",
  "Contornos pretos simples, poucas cores suaves e bem contrastantes, fundo branco liso, sem sombras nem texturas.",
  "Sem nenhum texto, letra, palavra ou número escrito na imagem, exceto quando pedido.",
  "Pessoas genéricas e diversas, desenhadas de forma simples, sem retratar alguém real.",
].join(" ");

// `clean` anonimiza cada texto (nomes viram "o estudante", "um colega"...).
export function buildActivityImagePrompt(activity: Activity, profile: FunctionalProfile | null, kind: string, clean: (text: string) => string) {
  const steps = parseJson<string[]>(activity.steps, []).slice(0, 6).map(clean);
  const materials = parseJson<string[]>(activity.materials, []).map(clean);
  const title = clean(activity.title);
  kind = clean(kind);
  const interests = parseJson<string[]>(profile?.interests ?? null, []).slice(0, 2);
  const sensory = parseJson<Record<string, string>>(profile?.sensoryProfile ?? null, {});
  const calmVisuals = sensory.visual === "hiper"
    ? "O estudante é sensível a estímulos visuais: use pouquíssimos elementos, cores neutras e um único foco por quadro."
    : "";
  const theme = interests.length ? `Use como tema visual: ${interests.join(" e ")}.` : "";
  const where = `Contexto: ${CONTEXTS[activity.context] ?? activity.context}.`;

  let content: string;
  let size: ImageSize;
  let altText: string;
  if (kind === "sequencia") {
    size = "1536x1024";
    content = `Crie uma prancha com ${steps.length} quadros lado a lado, em ordem da esquerda para a direita, cada um mostrando uma ação da atividade "${title}". Numere os quadros com algarismos grandes (1, 2, 3...). Ações: ${steps.map((step, index) => `${index + 1}) ${step}`).join(" ")}`;
    altText = `Sequência visual em ${steps.length} quadros da atividade "${title}".`;
  } else if (kind === "cartoes") {
    size = "1536x1024";
    content = `Crie de 4 a 6 cartões quadrados separados, em grade, cada um com um pictograma de um objeto ou ação usados na atividade "${title}", para o estudante apontar ou escolher. Materiais: ${materials.join(", ") || "os da atividade"}.`;
    altText = `Cartões de escolha com pictogramas da atividade "${title}".`;
  } else if (kind === "ilustracao") {
    size = "1024x1024";
    content = `Crie uma ilustração única que mostre a atividade "${title}" acontecendo. Materiais: ${materials.join(", ") || "os da atividade"}.`;
    altText = `Ilustração da atividade "${title}".`;
  } else {
    // "Outro": descrição livre do professor.
    size = "1024x1024";
    content = `Crie a seguinte imagem de apoio para a atividade "${title}": ${kind}`;
    altText = `Imagem de apoio da atividade "${title}": ${kind}`;
  }

  return { prompt: [content, theme, where, calmVisuals, STYLE].filter(Boolean).join("\n"), size, altText };
}
