import { getCurrentUser } from "@/lib/auth";
import { executeAction } from "@/lib/assistant/store";

export const dynamic = "force-dynamic";

// A pessoa confirma ou cancela uma ação preparada pelo assistente.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { decisao?: unknown };
  const decision = body.decisao === "cancelar" ? "cancelar" : body.decisao === "confirmar" ? "confirmar" : null;
  if (!decision) return Response.json({ error: "Decisão inválida." }, { status: 400 });
  try {
    const result = await executeAction(user, id, decision);
    return Response.json(result, { status: result.error ? 422 : 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Ação não encontrada." }, { status: 404 });
  }
}
