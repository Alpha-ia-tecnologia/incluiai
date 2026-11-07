import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPage } from "@/components/status-page";

// Avisos da leitura do QR da carteirinha. Não dizem de quem é a carteirinha.
const NOTICES = {
  inativa: {
    title: "Esta carteirinha não vale mais",
    text: "O código foi trocado ou a família retirou a autorização. Peça a carteirinha atual à escola.",
  },
  "sem-acesso": {
    title: "Você não tem acesso a este estudante",
    text: "A carteirinha só abre o acompanhamento para a família e para a equipe com acesso ao estudante.",
  },
} as const;

export default async function CardNoticePage({ params }: { params: Promise<{ motivo: string }> }) {
  const { motivo } = await params;
  const notice = NOTICES[motivo as keyof typeof NOTICES];
  if (!notice) notFound();
  return (
    <StatusPage character="care" eyebrow="Carteirinha" title={notice.title} actions={<Link href="/" className="task-action">Ir para o início</Link>}>
      <p>{notice.text}</p>
    </StatusPage>
  );
}
