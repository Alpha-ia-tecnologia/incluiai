import { prisma } from "../prisma";
import type { TraceStep } from "./schemas";

// Transparência (LGPD): quando o DeepSeek atende algum agente, a trilha da
// proposta e o histórico de acessos visto pela família registram o envio.
// Fica fora dos arquivos "use server" para não virar uma ação pública.
export async function recordDeepSeekUse(studentId: string, agents: string[], trace?: TraceStep[]) {
  if (agents.length === 0) return;
  trace?.push({ agent: "Provedor de IA", summary: `Respondido pelo DeepSeek (fallback): ${agents.join(", ")}.` });
  await prisma.accessLog.create({
    data: {
      studentId,
      actor: "Agentes de IA",
      role: "sistema",
      action: "enviou",
      detail: "Informações pedagógicas, sem dados pessoais, enviadas ao DeepSeek (fallback de IA)",
    },
  });
}
