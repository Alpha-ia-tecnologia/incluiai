import { redirect } from "next/navigation";
import { EyeOff, UserCheck } from "lucide-react";
import { Assurances } from "@/components/explain";
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
        title="Converse com o assistente"
        lede="Dúvidas, propostas de plano e atividades, registro de aulas e o painel."
      >
        <Assurances
          label="Cuidados do assistente"
          items={[
            { icon: UserCheck, text: "Você confirma cada ação" },
            { icon: EyeOff, text: "Dados chegam à IA sem nomes" },
          ]}
        />
      </PageHero>
      <AssistantChat layout="page" enabled={hasApiKey("ANTHROPIC_API_KEY")} suggestions={suggestionsFor(user.role)} initial={selected} conversations={conversations} />
    </div>
  );
}
