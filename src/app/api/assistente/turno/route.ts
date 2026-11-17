import { getCurrentUser } from "@/lib/auth";
import { runAssistantTurn } from "@/lib/assistant/agent";
import type { AssistantEvent } from "@/lib/assistant/types";
import { unavailableResponse } from "@/lib/tenant";
import { currentTenant, withMunicipality } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  // O turno segue depois da resposta aberta: o município fica preso ao turno, sem
  // depender de ler o pedido de novo no meio da transmissão.
  const tenant = await currentTenant();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login para usar o assistente." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { text?: unknown; conversationId?: unknown; studentId?: unknown };
  const text = typeof body.text === "string" ? body.text : "";
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  const studentId = typeof body.studentId === "string" ? body.studentId : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      };
      const emit = (event: AssistantEvent) => write(`data: ${JSON.stringify(event)}\n\n`);
      // Comentário SSE a cada 15 s: proxies não cortam a conexão parada durante
      // as ferramentas longas (1 a 4 minutos). O navegador ignora a linha.
      const heartbeat = setInterval(() => write(": ping\n\n"), 15_000);
      const turn = () => runAssistantTurn({ user, conversationId, text, studentId, emit });
      (tenant.kind === "municipio" ? withMunicipality(tenant.slug, turn) : turn())
        .catch((error) => {
          console.error("[assistente] erro inesperado:", error);
          emit({ type: "error", message: "Erro inesperado no assistente." });
        })
        .finally(() => {
          clearInterval(heartbeat);
          if (open) {
            open = false;
            try { controller.close(); } catch { /* já fechado pela pessoa */ }
          }
        });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
