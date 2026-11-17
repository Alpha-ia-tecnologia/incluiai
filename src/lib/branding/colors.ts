import "server-only";
import { z } from "zod/v4";
import { claudeAgentModel } from "../agents/claude";
import { canReadFiles } from "../agents/capabilities";
import { logoPixels, logoPng, type Logo } from "./logo";
import { DERIVE_MENU, acceptAiAnswer, chooseByRules, isSaturated, pixelsToSwatches, type BrandSuggestion, type Swatch } from "./colors-core";

export type { BrandSuggestion, Swatch } from "./colors-core";

const SAMPLE_SIZE = 96;
const AI_IMAGE_SIZE = 384;

export async function extractSwatches(logo: Logo): Promise<Swatch[]> {
  const { data, width, height } = await logoPixels(logo, SAMPLE_SIZE);
  return pixelsToSwatches(data, width, height);
}

const SYSTEM = `Você escolhe as cores da plataforma de educação de uma prefeitura a partir do logo dela.
Você recebe a imagem do logo e a lista das cores achadas nele, com a fatia de cada uma.
- primary: a cor institucional, a que identifica a prefeitura. Vai nos botões e nos links.
- menu: o fundo do menu lateral, que leva texto branco por cima. Uma cor escura da lista, ou "${DERIVE_MENU}" para usar um tom escuro da cor principal.
- note: uma frase curta, em português, para quem administra a plataforma, dizendo o porquê da escolha.
Use só cores da lista. Fundo branco, preto de texto e cinzas raramente são a cor institucional.`;

// O DeepSeek não lê imagens: a escolha pela IA é só com o Claude.
export async function suggestBrandColors(logo: Logo, municipalityName: string): Promise<BrandSuggestion> {
  const swatches = await extractSwatches(logo);
  const rules = chooseByRules(swatches);
  const byRules = (note: string): BrandSuggestion => ({ colors: rules.colors, swatches, source: "regras", note });
  if (!swatches.some((swatch) => isSaturated(swatch.hex)) || !canReadFiles()) return byRules(rules.note);
  const hexes = swatches.map((swatch) => swatch.hex) as [string, ...string[]];
  try {
    const answer = await claudeAgentModel({
      agent: "cores_da_marca",
      system: SYSTEM,
      prompt: [
        `Município: ${municipalityName.replace(/\s+/g, " ").trim().slice(0, 120)}`,
        "Cores do logo (hex: fatia dos pixels visíveis):",
        ...swatches.map((swatch) => `- ${swatch.hex}: ${Math.round(swatch.share * 100)}%`),
      ].join("\n"),
      schema: z.object({ primary: z.enum(hexes), menu: z.enum([...hexes, DERIVE_MENU]), note: z.string() }),
      effort: "low",
      attachments: [{ kind: "image", mediaType: "image/png", data: (await logoPng(logo, AI_IMAGE_SIZE)).toString("base64") }],
    });
    const choice = acceptAiAnswer(swatches, answer);
    if (choice) return { colors: choice.colors, swatches, source: "ia", note: choice.note };
  } catch {
    // Limite de uso, chave inválida, rede ou resposta fora do formato: fica a regra.
  }
  return byRules("A IA não respondeu; cores escolhidas pela regra.");
}
