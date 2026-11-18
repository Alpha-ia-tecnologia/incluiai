import { executeAction } from "@/lib/assistant/tools";
import { assistantRoute } from "@/lib/assistant/route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return assistantRoute(async (user) => {
    const body = await request.json().catch(() => ({})) as { decisao?: unknown };
    const decision = body.decisao === "cancelar" ? "cancelar" : body.decisao === "confirmar" ? "confirmar" : null;
    if (!decision) return Response.json({ error: "Decisão inválida." }, { status: 400 });
    const result = await executeAction(user, (await params).id, decision);
    return Response.json(result, { status: result.error ? 422 : 200 });
  });
}
