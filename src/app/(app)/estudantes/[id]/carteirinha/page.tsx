import { redirect } from "next/navigation";
import { History, LockKeyhole, RefreshCw, ShieldAlert, Trash2, Users } from "lucide-react";
import { Assurances } from "@/components/explain";
import { prisma } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/auth";
import { canManageCard, loadCardView } from "@/lib/student-card";
import { formatDate } from "@/lib/format";
import { removeCardPhoto, rotateStudentCard, uploadCardPhoto } from "@/actions/student-card";
import { Card, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { PendingButton } from "@/components/pending-button";
import { StudentCardView } from "@/components/student-card-view";
import { CardPhotoForm } from "@/components/student-card-forms";
import { dangerButtonCls, quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

export default async function StudentCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudentPage(id, "Carteirinha");
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true, schoolId: true } });
  // Aba de trabalho: quem só lê a ficha (Secretaria com motivo) fica no resumo.
  if (!canManageCard(user, student.schoolId, id)) redirect(`/estudantes/${id}`);
  const view = await loadCardView(id);
  const firstName = student.name.split(" ")[0];

  if (!view) {
    return (
      <>
        <PageHeader level={2} title="Carteirinha" />
        <Card className="max-w-2xl">
          <p className="flex items-start gap-2 text-sm leading-relaxed text-ink">
            <ShieldAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-amber" />
            A família de {firstName} ainda não autorizou a carteirinha. Ela decide no portal dela, em Autorizações.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="id-card-screen-only">
        <PageHeader level={2} title="Carteirinha" actions={<PrintButton label="Imprimir carteirinha" />} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Carteirinha" className="min-w-0">
          <StudentCardView view={view} />
          <p className="id-card-screen-only mt-3 text-sm text-ink-soft">Impressa, recorte pela borda e dobre na linha do meio.</p>
        </section>

        <aside className="id-card-screen-only min-w-0 space-y-5">
          <Card>
            <CardPhotoForm action={uploadCardPhoto.bind(null, id)} hasPhoto={view.settings.hasPhoto} />
            {view.settings.hasPhoto ? (
              <form action={removeCardPhoto.bind(null, id)} className="mt-3">
                <button type="submit" className={dangerButtonCls}><Trash2 size={16} aria-hidden /> Remover a foto</button>
              </form>
            ) : null}
          </Card>
          <Card>
            <h3 className="text-sm font-medium text-ink">Código da carteirinha</h3>
            <p className="mt-1 text-sm text-ink-soft">Emitido em {formatDate(view.issuedAt)}. Perdeu a carteirinha? O código novo desativa a anterior.</p>
            <form action={rotateStudentCard.bind(null, id)} className="mt-3">
              <PendingButton className={quietButtonCls} pendingText="Gerando o código…"><RefreshCw size={16} aria-hidden /> Gerar código novo</PendingButton>
            </form>
          </Card>
          <Assurances
            label="Como a carteirinha protege o estudante"
            items={[
              { icon: LockKeyhole, text: "O QR pede login" },
              { icon: History, text: "Cada leitura vai ao histórico" },
              { icon: Users, text: "Verso e contato: a família escolhe" },
            ]}
          />
        </aside>
      </div>
    </>
  );
}
