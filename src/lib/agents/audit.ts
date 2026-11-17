import { db } from "../prisma";
import { AI_PROVIDER } from "./descriptors";
import type { TraceStep } from "./types";

// Fica fora dos arquivos "use server" para não virar uma ação pública.
export async function recordDeepSeekUse(studentId: string, agents: string[], trace: TraceStep[], purpose = "fallback de IA") {
  const prisma = await db();
  if (agents.length === 0) return;
  trace.push({ agent: AI_PROVIDER, summary: `Respondido pelo DeepSeek (fallback): ${agents.join(", ")}.` });
  await prisma.accessLog.create({
    data: {
      studentId,
      actor: "Agentes de IA",
      role: "sistema",
      action: "enviou",
      detail: `Informações pedagógicas, sem dados pessoais, enviadas ao DeepSeek (${purpose})`,
    },
  });
}
