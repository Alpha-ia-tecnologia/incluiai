import { Bot, CheckCircle2, CircleSlash, Eye, HeartHandshake, IdCard, Languages, QrCode, RefreshCw, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Undo2, UserCheck, type LucideIcon } from "lucide-react";
import { setFamilyConsent } from "@/actions/consent";
import { formatDate } from "@/lib/format";
import { primaryButtonCls, quietButtonCls } from "@/components/form-styles";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { Assurances } from "@/components/explain";

// Autorizações no portal da família (seções 12 e 14): linguagem simples, o que
// muda com cada escolha e a possibilidade de voltar atrás a qualquer momento.
// Cada item em linhas curtas com ícone: o que a autorização permite (azul), o que
// nunca acontece (verde) e, por último, o que vale sem ela ou ao retirá-la.
type Line = { icon: LucideIcon; text: string; guarantee?: boolean };
type Item = {
  field: "aiUse" | "therapistLink" | "card";
  icon: LucideIcon;
  title: string;
  lines: Line[];
  // off: enquanto não autorizado; withdraw: quando autorizado, o que retirar faz.
  off: string;
  withdraw: { icon: LucideIcon; text: string };
};

const ITEMS: Item[] = [
  {
    field: "aiUse",
    icon: Bot,
    title: "Uso de inteligência artificial",
    lines: [
      { icon: Sparkles, text: "A escola pode pedir à IA sugestões de plano, atividades e materiais." },
      { icon: ShieldCheck, text: "Antes do envio, nome, contatos e documentos viram marcadores.", guarantee: true },
      { icon: UserCheck, text: "A equipe revisa cada sugestão.", guarantee: true },
    ],
    off: "Sem autorização: nada sai para serviços de IA, só valem as regras da plataforma.",
    withdraw: { icon: Undo2, text: "Ao retirar, nada mais sai para serviços de IA." },
  },
  {
    field: "therapistLink",
    icon: HeartHandshake,
    title: "Conexão com o terapeuta",
    lines: [
      { icon: Eye, text: "O terapeuta pode ver o perfil funcional (como aprende) e enviar orientações para a escola." },
      { icon: ShieldCheck, text: "Ele não vê notas, diário nem dados administrativos.", guarantee: true },
    ],
    off: "Sem autorização: o terapeuta não vê os dados do estudante nem envia orientações pela plataforma.",
    withdraw: { icon: Undo2, text: "Ao retirar, o terapeuta deixa de ver os dados e de enviar orientações." },
  },
  {
    field: "card",
    icon: IdCard,
    title: "Carteirinha digital",
    lines: [
      { icon: IdCard, text: "A escola pode fazer a carteirinha com foto, nome, escola e turma." },
      { icon: QrCode, text: "O código QR só abre o acompanhamento para quem entra na plataforma com permissão.", guarantee: true },
      { icon: SlidersHorizontal, text: "O verso e o contato de emergência são escolha de vocês.", guarantee: true },
    ],
    off: "Sem autorização: não há carteirinha nem foto do estudante na plataforma.",
    withdraw: { icon: Trash2, text: "Retirar a autorização apaga a foto, o contato e o código." },
  },
];

export function ConsentCard({ studentId, firstName, consent, canDecide }: {
  studentId: string;
  firstName: string;
  consent: { aiUse: boolean; therapistLink: boolean; card: boolean; updatedAt: Date | null; updatedBy: string | null };
  canDecide: boolean;
}) {
  return (
    <Card className="scroll-mt-24" id="autorizacoes">
      <SectionTitle>Autorizações</SectionTitle>
      <Assurances
        className="mb-4"
        label="Quem decide"
        items={[{ icon: UserCheck, text: `Vocês decidem sobre os dados de ${firstName}` }, { icon: RefreshCw, text: "Podem mudar quando quiserem" }]}
      />
      <ul className="grid gap-3">
        {ITEMS.map(({ field, icon: Icon, title, lines, off, withdraw }) => {
          const granted = consent[field];
          const toggle = setFamilyConsent.bind(null, studentId, field, !granted);
          const After = granted ? withdraw.icon : CircleSlash;
          return (
            <li key={field} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-ink"><Icon size={16} aria-hidden className="text-brand-strong" /> {title}</p>
                {granted ? <Badge tone="green"><CheckCircle2 size={12} aria-hidden /> Autorizado</Badge> : <Badge tone="neutral">Não autorizado</Badge>}
              </div>
              <ul className="mt-3 grid gap-2 text-sm leading-snug text-ink">
                {lines.map(({ icon: LineIcon, text, guarantee }) => (
                  <li key={text} className="flex items-start gap-2.5">
                    <LineIcon size={16} aria-hidden className={`mt-0.5 shrink-0 ${guarantee ? "text-green" : "text-brand-strong"}`} />
                    <span className="min-w-0">{text}</span>
                  </li>
                ))}
                <li className="flex items-start gap-2.5 border-t border-line pt-2 text-ink-soft">
                  <After size={16} aria-hidden className="mt-0.5 shrink-0" />
                  <span className="min-w-0">{granted ? withdraw.text : off}</span>
                </li>
              </ul>
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
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
        <Languages size={14} aria-hidden className="mt-0.5 shrink-0 text-brand-strong" />
        <span><span className="font-medium text-ink">Libras (VLibras):</span> o texto escolhido vai ao tradutor do governo federal sem nomes, documentos, datas nem contatos.</span>
      </p>
    </Card>
  );
}
