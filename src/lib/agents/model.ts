import { claudeAgentModel } from "./claude";
import { deepseekAgentModel } from "./deepseek";
import type { AgentModel } from "./types";
import { hasApiKey, isDeepSeekEnabled } from "../env";
import { withAnonymization, type Anonymizer } from "./anonymize";

// Cadeia de provedores dos agentes: Claude → DeepSeek (se configurado) →
// erro, que leva as ações ao motor de regras. Os grafos recebem um
// AgentModel por parâmetro, o que permite testá-los sem chamar a API.

export { AGENT_MODEL, claudeAgentModel } from "./claude";
export { DEEPSEEK_MODEL, deepseekAgentModel } from "./deepseek";
export { AgentOutputError, type AgentModel, type AgentRequest } from "./types";

export function isAIEnabled(): boolean {
  return hasApiKey("ANTHROPIC_API_KEY") || isDeepSeekEnabled();
}

export { isDeepSeekEnabled };

type Provider = { name: "Claude" | "DeepSeek"; call: AgentModel };

// Cria o modelo de uma execução e registra quais provedores responderam,
// para a trilha da proposta e o histórico de acessos.
export function createAgentModel(anonymizer: Anonymizer) {
  const providers: Provider[] = [];
  if (hasApiKey("ANTHROPIC_API_KEY")) providers.push({ name: "Claude", call: claudeAgentModel });
  if (isDeepSeekEnabled()) providers.push({ name: "DeepSeek", call: deepseekAgentModel });

  const usedBy = new Map<string, Provider["name"]>();
  const model: AgentModel = async (request) => {
    let lastError: unknown = new Error("Nenhum provedor de IA configurado.");
    for (const [index, provider] of providers.entries()) {
      try {
        const result = await provider.call(request);
        usedBy.set(request.agent, provider.name);
        return result;
      } catch (error) {
        lastError = error;
        const next = providers[index + 1];
        if (next) {
          const reason = error instanceof Error ? error.message.split("\n")[0].slice(0, 160) : String(error);
          console.warn(`[agentes] ${request.agent}: ${provider.name} falhou (${reason}); tentando ${next.name}.`);
        }
      }
    }
    throw lastError;
  };

  return {
    // Todo pedido sai anonimizado, qualquer que seja o provedor.
    model: withAnonymization(model, anonymizer),
    // Agentes atendidos pelo DeepSeek nesta execução (por fallback ou por ser o único provedor).
    deepseekAgents: () => [...usedBy].filter(([, name]) => name === "DeepSeek").map(([agent]) => agent),
  };
}
