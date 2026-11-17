import { getCurrentUser } from "@/lib/auth";
import { latestConversation, listConversations } from "@/lib/assistant/store";
import { unavailableResponse } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });
  const url = new URL(request.url);
  if (url.searchParams.get("ultima")) {
    return Response.json({ conversation: await latestConversation(user) });
  }
  return Response.json({ conversations: await listConversations(user.id) });
}
