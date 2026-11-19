import { redirect } from "next/navigation";
import { Check, ShieldCheck, UserCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/roles";
import { aiProviders } from "@/lib/agents/capabilities";
import { claudeSettings, deepseekSettings, openaiSettings } from "@/lib/env-config";
import { Assurances, HowToRead } from "@/components/explain";
import { PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/viz/charts";

export default async function AiSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "configureAi")) redirect("/");

  const active = aiProviders();
  const providers = [
    { key: "claude", name: "Claude", vendor: "Anthropic", purpose: "Planos, atividades, assistente e leitura de arquivos", model: claudeSettings().model, active: active.claude, note: null },
    {
      key: "deepseek", name: "DeepSeek", vendor: "DeepSeek", purpose: "Reserva, quando o Claude falha", model: deepseekSettings().model, active: active.deepseek,
      note: "Processa e guarda dados na China (LGPD): só entra com a ligação explícita, e cada envio fica no histórico de acessos que a família vê.",
    },
    { key: "openai", name: "OpenAI", vendor: "OpenAI", purpose: "Imagens de apoio", model: openaiSettings().imageModel, active: active.openai, note: null },
  ];

  return (
    <>
      <PageHeader title="Configuração da IA" lede="O que está ligado nesta instalação. A troca é feita pela equipe técnica, na configuração do servidor." />
      <section aria-labelledby="servicos-titulo" className="ui-card max-w-3xl">
        <h2 id="servicos-titulo" className="text-xl font-medium tracking-tight">Serviços de IA</h2>
        <ul className="mt-2 divide-y divide-line">
          {providers.map((provider) => (
            <li key={provider.key} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-medium text-ink">{provider.name}{provider.vendor !== provider.name ? <span className="font-normal text-ink-soft"> · {provider.vendor}</span> : null}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{provider.purpose}{provider.active ? ` · modelo ${provider.model}` : ""}</p>
                {provider.note ? <p className="mt-1.5 text-sm text-ink">{provider.note}</p> : null}
              </div>
              {provider.active ? <StatusPill tone="good"><Check size={12} strokeWidth={3} aria-hidden /> Ativo</StatusPill> : <StatusPill tone="neutral">Não configurado</StatusPill>}
            </li>
          ))}
        </ul>
        <Assurances className="mt-3" label="Cuidados com a IA" items={[{ icon: UserCheck, text: "A IA propõe, o professor decide" }, { icon: ShieldCheck, text: "Dados pessoais saem como marcadores" }]} />
        <HowToRead summary="Para a equipe técnica" className="mt-3">
          <ul className="list-disc space-y-1 pl-5">
            <li><code>ANTHROPIC_API_KEY</code> liga o Claude (modelo em <code>ANTHROPIC_MODEL</code>).</li>
            <li><code>DEEPSEEK_API_KEY</code> com <code>DEEPSEEK_ENABLED=1</code> liga a reserva; a chave sozinha não basta.</li>
            <li><code>OPENAI_API_KEY</code> liga as imagens de apoio.</li>
          </ul>
        </HowToRead>
      </section>
    </>
  );
}
