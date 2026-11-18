import { latestConversation } from "@/lib/assistant/store";
import { assistantRoute } from "@/lib/assistant/route";

export async function GET() {
  return assistantRoute(async (user) => Response.json({ conversation: await latestConversation(user) }));
}
