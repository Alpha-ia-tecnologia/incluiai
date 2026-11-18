import { deleteConversation, getConversation } from "@/lib/assistant/store";
import { assistantRoute } from "@/lib/assistant/route";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return assistantRoute(async (user) => {
    const conversation = await getConversation(user, (await params).id);
    if (!conversation) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
    return Response.json({ conversation });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return assistantRoute(async (user) => {
    const removed = await deleteConversation(user, (await params).id);
    if (!removed) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
    return Response.json({ ok: true });
  });
}
