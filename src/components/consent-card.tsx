import { Bot, CheckCircle2, HeartHandshake } from "lucide-react";
import { setFamilyConsent } from "@/actions/consent";
import { formatDate } from "@/lib/format";
import { primaryButtonCls, quietButtonCls } from "@/components/form-styles";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";

// Autorizações no portal da família (seções 12 e 14): linguagem simples, o que
// muda com cada escolha e a possibilidade de voltar atrás a qualquer momento.
const ITEMS = [
  {
    field: "aiUse" as const,
    icon: Bot,
    title: "Uso de inteligência artificial",
    on: "A escola pode pedir sugestões de plano, atividades e materiais a serviços de IA. Nome, contatos e documentos são trocados por marcadores antes do envio, e cada sugestão é revisada pela equipe.",
    off: "Sem autorização, a escola usa só as regras da própria plataforma: nenhuma informação sai para serviços de IA.",
  },
  {
    field: "therapistLink" as const,
    icon: HeartHandshake,
    title: "Conexão com o terapeuta",
    on: "O terapeuta vê o perfil funcional (como aprende) e envia orientações para a escola. Ele não vê notas, diário nem dados administrativos.",
    off: "Sem autorização, o terapeuta não vê os dados do estudante nem envia orientações pela plataforma.",
  },
];

export function ConsentCard({ studentId, firstName, consent, canDecide }: {
  studentId: string;
  firstName: string;
  consent: { aiUse: boolean; therapistLink: boolean; updatedAt: Date | null; updatedBy: string | null };
  canDecide: boolean;
}) {
  return (
    <Card className="scroll-mt-24" id="autorizacoes">
      <SectionTitle>Autorizações</SectionTitle>
      <p className="mb-4 text-sm leading-relaxed text-ink-soft">Vocês decidem como os dados de {firstName} são usados e podem mudar a decisão quando quiserem.</p>
      <ul className="grid gap-3">
        {ITEMS.map(({ field, icon: Icon, title, on, off }) => {
          const granted = consent[field];
          const toggle = setFamilyConsent.bind(null, studentId, field, !granted);
          return (
            <li key={field} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-ink"><Icon size={16} aria-hidden className="text-brand-strong" /> {title}</p>
                {granted ? <Badge tone="green"><CheckCircle2 size={12} aria-hidden /> Autorizado</Badge> : <Badge tone="neutral">Não autorizado</Badge>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{granted ? on : off}</p>
              {canDecide ? (
                <form action={toggle} className="mt-3">
                  <PendingButton className={granted ? quietButtonCls : primaryButtonCls} pendingText="Salvando a decisão…">
                    {granted ? "Retirar a autorização" : "Autorizar"}<span className="sr-only">: {title}</span>
                  </PendingButton>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      {consent.updatedAt ? <p className="mt-3 text-xs text-ink-soft">Última decisão em {formatDate(consent.updatedAt)}{consent.updatedBy ? ` por ${consent.updatedBy}` : ""}.</p> : null}
      <p className="mt-3 text-xs leading-relaxed text-ink-soft"><span className="font-medium text-ink">Tradução para Libras:</span> quem usa o botão de Libras (VLibras) envia o texto escolhido ao tradutor do governo federal. Antes do envio, a plataforma troca nomes, documentos, datas e contatos por termos como &ldquo;o estudante&rdquo;.</p>
    </Card>
  );
}
