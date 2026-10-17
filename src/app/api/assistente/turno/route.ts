import { getCurrentUser } from "@/lib/auth";
import { runAssistantTurn } from "@/lib/assistant/agent";
import type { AssistantEvent } from "@/lib/assistant/types";

export const dynamic = "force-dynamic";

// Um turno do assistente, transmitido por eventos (SSE). Se a pessoa fechar
// a tela no meio, o turno continua até o fim: o histórico precisa ficar completo.
export async function POST(request: Request) {
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
      runAssistantTurn({ user, conversationId, text, studentId, emit })
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
