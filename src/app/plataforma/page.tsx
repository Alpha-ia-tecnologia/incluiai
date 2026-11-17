import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { requirePlatformUser } from "@/lib/auth";
import { platformDb } from "@/lib/prisma";
import { addressOf, versioned } from "@/lib/tenant";
import { STATUS_LABELS, STATUS_TONES, type MunicipalityStatus } from "@/lib/tenancy-core";
import { formatDate } from "@/lib/format";
import { Badge, EmptyState, PageHero } from "@/components/ui";
import { linkCls, BUTTON_CLS } from "@/components/form-styles";

export const dynamic = "force-dynamic";

export default async function MunicipalitiesPage() {
  await requirePlatformUser();
  const municipalities = await platformDb().municipality.findMany({
    select: { slug: true, name: true, uf: true, status: true, primaryColor: true, menuColor: true, logoType: true, createdAt: true, updatedAt: true },
    orderBy: { name: "asc" },
  });
  const addresses = await Promise.all(municipalities.map((municipality) => addressOf(municipality.slug)));
  return (
    <>
      <PageHero
        title="Municípios"
        lede="Cada município tem o próprio endereço, o próprio banco de dados e a própria marca. Daqui você cadastra, acompanha a preparação e suspende ou reativa o acesso. Os dados dos estudantes ficam só no ambiente de cada município."
        character="planning"
        preload
        actions={<Link href="/plataforma/novo" className={BUTTON_CLS.primaryOnNavy}><Plus size={16} aria-hidden /> Novo município</Link>}
      />
      {municipalities.length === 0 ? (
        <EmptyState title="Nenhum município cadastrado ainda" hint="Cadastre o primeiro: o ambiente fica pronto em cerca de um minuto, com o endereço e a primeira conta da Secretaria." action={<Link href="/plataforma/novo" className="task-action"><Plus size={18} aria-hidden /> Cadastrar o primeiro município</Link>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" aria-label="Municípios cadastrados">
          {municipalities.map((municipality, index) => (
            <li key={municipality.slug} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-paper-raised p-5">
              <div className="flex min-w-0 items-start gap-3">
                {municipality.logoType ? (
                  <Image src={versioned(`/plataforma/municipios/${municipality.slug}/logo`, municipality.updatedAt)} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-xl border border-line bg-white object-contain p-1" />
                ) : (
                  <span aria-hidden className="size-12 shrink-0 rounded-xl" style={{ backgroundColor: municipality.menuColor }} />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-medium leading-snug">
                    <Link href={`/plataforma/municipios/${municipality.slug}`} className="hover:underline">{municipality.name} ({municipality.uf})</Link>
                  </h2>
                  <a href={addresses[index]} className={`mt-1 inline-block break-all text-sm ${linkCls}`}>{addresses[index].replace(/^https?:\/\//, "")}</a>
                </div>
                <Badge tone={STATUS_TONES[municipality.status as MunicipalityStatus] ?? "neutral"}>{STATUS_LABELS[municipality.status as MunicipalityStatus] ?? municipality.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-4 rounded-full border border-line" style={{ backgroundColor: municipality.primaryColor }} />
                  <span aria-hidden className="size-4 rounded-full border border-line" style={{ backgroundColor: municipality.menuColor }} />
                  <span>Cores {municipality.primaryColor} e {municipality.menuColor}</span>
                </span>
                <span>Cadastrado em {formatDate(municipality.createdAt)}</span>
              </div>
              <Link href={`/plataforma/municipios/${municipality.slug}`} className="task-action task-action-secondary mt-auto" aria-label={`Abrir ${municipality.name}`}>Abrir <ArrowRight size={16} aria-hidden /></Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
