import { getCurrentUser } from "@/lib/auth";
import { deleteConversation, getConversation } from "@/lib/assistant/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });
  const { id } = await params;
  const conversation = await getConversation(user, id);
  if (!conversation) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  return Response.json({ conversation });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });
  const { id } = await params;
  const removed = await deleteConversation(user, id);
  if (!removed) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}
