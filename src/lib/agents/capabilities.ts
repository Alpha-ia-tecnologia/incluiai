import { studentConsent } from "../consent";
import { claudeSettings, deepseekSettings, openaiSettings } from "../env-config";

export function aiProviders() {
  return {
    claude: Boolean(claudeSettings().apiKey),
    // A DeepSeek processa e guarda dados na China (LGPD): só entra com DEEPSEEK_ENABLED=1.
    deepseek: Boolean(deepseekSettings().apiKey) && deepseekSettings().enabled,
    openai: Boolean(openaiSettings().apiKey),
  };
}

export const isAIEnabled = () => aiProviders().claude || aiProviders().deepseek;
// Foto, PDF, laudo e logo: a DeepSeek não lê arquivos, e laudo de saúde não vai à DeepSeek (LGPD).
export const canReadFiles = () => aiProviders().claude;
export const isAssistantEnabled = () => aiProviders().claude;
export const isImageGenerationEnabled = () => aiProviders().openai;

export type AiNeed = "text" | "files";
export type AiGate = "liberada" | "desligada" | "sem_autorizacao";

const configuredFor = (need: AiNeed) => (need === "files" ? canReadFiles() : isAIEnabled());

export async function aiGate(need: AiNeed, studentId?: string | null): Promise<AiGate> {
  if (!configuredFor(need)) return "desligada";
  if (studentId && !(await studentConsent(studentId)).aiUse) return "sem_autorizacao";
  return "liberada";
}

export async function studentAI(studentId: string) {
  const consent = (await studentConsent(studentId)).aiUse;
  return {
    text: consent && isAIEnabled(),
    files: consent && canReadFiles(),
    images: consent && isImageGenerationEnabled(),
    waitingConsent: { text: !consent && isAIEnabled(), files: !consent && canReadFiles() },
  };
}
