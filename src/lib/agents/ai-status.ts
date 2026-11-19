export type AiProviders = { claude: boolean; deepseek: boolean; openai: boolean };

const SERVICES: ReadonlyArray<[keyof AiProviders, string]> = [["claude", "Claude"], ["deepseek", "DeepSeek"], ["openai", "OpenAI"]];

/**
 * A situação da IA numa frase. Quais serviços estão ligados só aparece para quem
 * configura a IA (a Secretaria, em /configuracao-ia); para os outros, ligada ou desligada.
 */
export function aiStatusText(providers: AiProviders, showServices: boolean): string {
  if (showServices) return `${SERVICES.map(([key, name]) => `${name} ${providers[key] ? "ativo" : "não configurado"}`).join(", ")} (detalhes em /configuracao-ia)`;
  return providers.claude || providers.deepseek ? "ligada" : "desligada";
}
