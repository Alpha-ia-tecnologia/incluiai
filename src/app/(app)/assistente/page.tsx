import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { hasApiKey } from "@/lib/env";
import { getConversation, listConversations } from "@/lib/assistant/store";
import { suggestionsFor } from "@/lib/assistant/labels";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { PageHero } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [conversations, selected] = await Promise.all([listConversations(user.id), c ? getConversation(user, c) : Promise.resolve(null)]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHero
        character="ideas"
        eyebrow={<><Sparkles size={18} aria-hidden /> Assistente</>}
        title="Converse com o assistente"
        lede="Tire dúvidas sobre a plataforma e o acompanhamento, peça propostas de plano e atividades, registre aulas e consulte o painel. O assistente propõe; você decide, sempre com um cartão de confirmação. Os dados chegam à IA sem nomes."
      />
      <AssistantChat layout="page" enabled={hasApiKey("ANTHROPIC_API_KEY")} suggestions={suggestionsFor(user.role)} initial={selected} conversations={conversations} />
    </div>
  );
}
