import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pause, Play } from "lucide-react";
import { requirePlatformUser } from "@/lib/auth";
import { platformDb } from "@/lib/prisma";
import { addressOf, versioned } from "@/lib/tenant";
import { STATUS_LABELS, STATUS_TONES, type MunicipalityStatus } from "@/lib/tenancy-core";
import { formatDate } from "@/lib/format";
import { changeMunicipalityStatus } from "@/actions/platform";
import { Badge, Card, PageHero, SectionTitle } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { BUTTON_CLS, inputCls, labelCls, linkCls } from "@/components/form-styles";
import { MunicipalityEditForm, RetryProvisioningForm } from "@/components/plataforma/municipality-edit";

const dateTime = (date: Date) => date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function MunicipalityPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePlatformUser();
  const { slug } = await params;
  const municipality = await platformDb().municipality.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, uf: true, networkName: true, dbName: true, status: true, provisionError: true,
      primaryColor: true, menuColor: true, colorSource: true, logoType: true, createdAt: true, updatedAt: true,
      events: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, actorName: true, action: true, detail: true, createdAt: true } },
    },
  });
  if (!municipality) notFound();
  const status = municipality.status as MunicipalityStatus;
  const address = await addressOf(municipality.slug);
  const waiting = status === "falhou" || status === "provisionando";

  return (
    <>
      <Link href="/plataforma" className={`mb-4 inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Municípios</Link>
      <PageHero
        eyebrow={<Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>}
        title={`${municipality.name} (${municipality.uf})`}
        lede={<>Cadastrado em {formatDate(municipality.createdAt)}. Banco <span className="font-mono">{municipality.dbName}</span>.</>}
        character="planning"
        actions={status === "ativo" ? <a href={address} className={BUTTON_CLS.primaryOnNavy}>Abrir {address.replace(/^https?:\/\//, "")} <ExternalLink size={16} aria-hidden /></a> : null}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid min-w-0 content-start gap-6">
          {waiting ? (
            <Card>
              <SectionTitle>Preparação do ambiente</SectionTitle>
              <p className="mb-4 text-sm leading-relaxed text-ink-soft">
                {status === "falhou"
                  ? "A última tentativa de preparar o banco não terminou. O motivo está abaixo; depois de corrigir (por exemplo, a permissão para criar bancos), tente de novo."
                  : "O ambiente está sendo preparado. Se a preparação foi interrompida (o servidor reiniciou no meio), tente de novo."}
              </p>
              {municipality.provisionError ? <p className="mb-4 break-words rounded-xl bg-coral-soft px-4 py-3 font-mono text-xs text-ink">{municipality.provisionError}</p> : null}
              <RetryProvisioningForm slug={municipality.slug} address={address} />
            </Card>
          ) : null}

          <Card>
            <SectionTitle>Cadastro e marca</SectionTitle>
            <MunicipalityEditForm
              defaults={{
                slug: municipality.slug, name: municipality.name, uf: municipality.uf, networkName: municipality.networkName,
                primaryColor: municipality.primaryColor, menuColor: municipality.menuColor, colorSource: municipality.colorSource,
                logoUrl: municipality.logoType ? versioned(`/plataforma/municipios/${municipality.slug}/logo`, municipality.updatedAt) : null,
              }}
            />
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          {status === "ativo" || status === "suspenso" ? (
            <Card>
              <SectionTitle>Acesso</SectionTitle>
              {status === "ativo" ? (
                <form action={changeMunicipalityStatus} className="grid gap-3">
                  <input type="hidden" name="slug" value={municipality.slug} />
                  <input type="hidden" name="status" value="suspenso" />
                  <p className="text-sm leading-relaxed text-ink-soft">Suspender fecha o endereço do município para todos, na hora. Os registros continuam guardados e o acesso volta ao reativar.</p>
                  <div>
                    <label htmlFor="motivo-suspensao" className={labelCls}>Motivo (fica no histórico)</label>
                    <input id="motivo-suspensao" name="reason" maxLength={300} autoComplete="off" className={inputCls} />
                  </div>
                  <div><PendingButton className={BUTTON_CLS.danger} pendingText="Suspendendo…"><Pause size={16} aria-hidden /> Suspender o acesso</PendingButton></div>
                </form>
              ) : (
                <form action={changeMunicipalityStatus} className="grid gap-3">
                  <input type="hidden" name="slug" value={municipality.slug} />
                  <input type="hidden" name="status" value="ativo" />
                  <p className="text-sm leading-relaxed text-ink-soft">O endereço está fechado. Ao reativar, as pessoas voltam a entrar com as contas de sempre.</p>
                  <div><PendingButton className={BUTTON_CLS.primary} pendingText="Reativando…"><Play size={16} aria-hidden /> Reativar o acesso</PendingButton></div>
                </form>
              )}
            </Card>
          ) : null}

          <Card>
            <SectionTitle>Histórico</SectionTitle>
            {municipality.events.length ? (
              <ol className="grid gap-3">
                {municipality.events.map((event) => (
                  <li key={event.id} className="min-w-0 border-b border-line pb-3 last:border-0 last:pb-0">
                    <p className="text-sm text-ink"><strong className="font-medium">{event.actorName}</strong> {event.action}</p>
                    {event.detail ? <p className="mt-1 break-words text-xs leading-relaxed text-ink-soft">{event.detail}</p> : null}
                    <p className="mt-1 text-xs text-ink-soft">{dateTime(event.createdAt)}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink-soft">Nada registrado ainda.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
