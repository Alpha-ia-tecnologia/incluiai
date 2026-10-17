import { getCurrentUser } from "@/lib/auth";
import { latestConversation, listConversations } from "@/lib/assistant/store";

export const dynamic = "force-dynamic";

// Lista as conversas da pessoa; com ?ultima=1, devolve a mais recente completa.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });
  const url = new URL(request.url);
  if (url.searchParams.get("ultima")) {
    return Response.json({ conversation: await latestConversation(user) });
  }
  return Response.json({ conversations: await listConversations(user.id) });
}
