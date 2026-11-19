import Link from "next/link";
import { ArrowLeft, ChevronDown, IdCard, ShieldCheck } from "lucide-react";
import { AUDIT_ACTION } from "@/lib/audit";
import { studentConsent } from "@/lib/consent";
import { formatDate } from "@/lib/dates";
import { firstName as firstNameOf } from "@/lib/format";
import { requireFamilyPortal } from "@/lib/page-context";
import { isFamilyOf } from "@/lib/policy";
import { db } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";
import { canViewCard, loadCardView } from "@/lib/student-card";
import { rotateStudentCard, saveCardPreferences } from "@/actions/student-card";
import { ActionForm } from "@/components/action-form";
import { ConsentCard } from "@/components/consent-card";
import { BUTTON_CLS } from "@/components/form-styles";
import { PendingButton } from "@/components/pending-button";
import { CardPreferencesForm } from "@/components/student-card-forms";
import { StudentCardView } from "@/components/student-card-view";
import { Card, PageHeader, SectionTitle } from "@/components/ui";

const ACCESS_SHOWN = 8;

export default async function FamilyPrivacyPage({ params }: { params: Promise<{ id: string }> }) {
  const prisma = await db();
  const { id } = await params;
  const { user, student } = await requireFamilyPortal(id, "Privacidade (portal da família)");
  const [recent, justified, consent] = await Promise.all([
    prisma.accessLog.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.accessLog.findMany({ where: { studentId: id, action: AUDIT_ACTION.justifiedAccess }, orderBy: { createdAt: "desc" }, take: 50 }),
    studentConsent(id),
  ]);
  const accessLogs = [...new Map([...recent, ...justified].map((log) => [log.id, log])).values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const isFamily = isFamilyOf(user, id);
  const firstName = firstNameOf(student.name);
  const cardView = consent.card && canViewCard(user, student) ? await loadCardView(id) : null;

  return (
    <>
      <Link href={`/familia/${id}`} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Acompanhamento de {firstName}</Link>
      <PageHeader title="Privacidade e acessos" />
      <div className="grid max-w-3xl gap-5">
        <ConsentCard studentId={id} firstName={firstName} consent={consent} canDecide={isFamily && user.studentIds.includes(id)} />

        {cardView ? (
          <Card className="scroll-mt-24" id="carteirinha">
            <SectionTitle><span className="flex items-center gap-1.5"><IdCard size={14} aria-hidden /> Carteirinha de {firstName}</span></SectionTitle>
            <StudentCardView view={cardView} />
            {isFamily ? (
              <div className="mt-5 border-t border-line pt-5">
                <CardPreferencesForm action={saveCardPreferences.bind(null, id)} firstName={firstName} settings={cardView.settings} guardian={cardView.guardian} hasProfile={cardView.settings.hasProfile} />
                <ActionForm action={rotateStudentCard.bind(null, id)} className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-sm text-ink-soft">Perderam a carteirinha? Troquem o código: a antiga deixa de abrir.</p>
                  <PendingButton className={BUTTON_CLS.quiet} pendingText="Trocando o código…">Trocar o código</PendingButton>
                </ActionForm>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card className="scroll-mt-24" id="acessos">
          <SectionTitle><span className="flex items-center gap-1.5"><ShieldCheck size={14} aria-hidden /> Quem acessou os dados</span></SectionTitle>
          {accessLogs.length === 0 ? (
            <p className="text-sm text-ink-soft">Nenhum acesso registrado.</p>
          ) : (
            <>
              <AccessList logs={accessLogs.slice(0, ACCESS_SHOWN)} />
              {accessLogs.length > ACCESS_SHOWN ? (
                <details className="group mt-3">
                  <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 py-2 text-sm font-medium text-brand-strong [&::-webkit-details-marker]:hidden">
                    Ver o histórico completo ({accessLogs.length} registros{recent.length === 200 ? ", os mais recentes e os acessos justificados" : ""}) <ChevronDown size={16} aria-hidden className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <AccessList logs={accessLogs.slice(ACCESS_SHOWN)} />
                </details>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function AccessList({ logs }: { logs: { id: string; actor: string; role: string; action: string; detail: string | null; createdAt: Date }[] }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {logs.map((log) => (
        <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
          <span className="min-w-0">
            <span className="font-medium text-ink">{log.actor}</span> <span className="text-xs text-ink-soft">({roleLabel(log.role)})</span>
            <span className="block text-xs text-ink-soft">{log.action}{log.detail ? ` · ${log.detail}` : ""}</span>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-ink-soft">{formatDate(log.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
