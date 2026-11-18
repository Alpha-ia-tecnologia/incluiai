import { redirect } from "next/navigation";
import { EyeOff, UserCheck } from "lucide-react";
import { Assurances } from "@/components/explain";
import { getCurrentUser } from "@/lib/auth";
import { isAssistantEnabled } from "@/lib/agents/capabilities";
import { getConversation, listConversations } from "@/lib/assistant/store";
import { suggestionsFor } from "@/lib/assistant/labels";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { PageHero } from "@/components/ui";
import { CONVERSATION_PARAM } from "@/lib/assistant/catalog";
import { param, type SearchParams } from "@/lib/search-params";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const c = param((await searchParams)[CONVERSATION_PARAM]);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [conversations, selected] = await Promise.all([listConversations(user.id), c ? getConversation(user, c) : Promise.resolve(null)]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHero
        character="ideas"
        title="Converse com o assistente"
        lede="Dúvidas, propostas de plano e atividades, registro de aulas e o painel."
      >
        <Assurances
          onNavy
          label="Cuidados do assistente"
          items={[
            { icon: UserCheck, text: "Você confirma cada ação" },
            { icon: EyeOff, text: "Dados chegam à IA sem nomes" },
          ]}
        />
      </PageHero>
      <AssistantChat layout="page" enabled={isAssistantEnabled()} suggestions={suggestionsFor(user.role)} initial={selected} conversations={conversations} />
    </div>
  );
}
