import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, claudeAgentModel } from "./claude";
import { DEEPSEEK_MODEL, DeepSeekAPIError, deepseekAgentModel } from "./deepseek";
import { aiProviders, type AiNeed } from "./capabilities";
import { AgentOutputError, type AgentModel } from "./types";
import { withRedaction, type Redactor } from "./redactor";

type Provider = { name: "Claude" | "DeepSeek"; call: AgentModel };

export function createAgentModel(redactor: Redactor, need: AiNeed) {
  const available = aiProviders();
  const providers: Provider[] = [];
  if (available.claude) providers.push({ name: "Claude", call: claudeAgentModel });
  if (available.deepseek && need === "text") providers.push({ name: "DeepSeek", call: deepseekAgentModel });

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

  const deepseekAgents = () => [...usedBy].filter(([, name]) => name === "DeepSeek").map(([agent]) => agent);
  return {
    model: withRedaction(model, redactor),
    deepseekAgents,
    modelId: () => (deepseekAgents().length ? DEEPSEEK_MODEL : CLAUDE_MODEL),
  };
}

export function describeAgentError(error: unknown) {
  if (error instanceof AgentOutputError) return error.message;
  if (error instanceof DeepSeekAPIError) return error.message;
  if (error instanceof Anthropic.RateLimitError) return "limite de uso da API atingido";
  if (error instanceof Anthropic.AuthenticationError) return "chave da API inválida";
  if (error instanceof Anthropic.APIConnectionError) return "sem conexão com a API";
  if (error instanceof Anthropic.APIError) return `erro ${error.status} da API`;
  return "erro inesperado";
}
