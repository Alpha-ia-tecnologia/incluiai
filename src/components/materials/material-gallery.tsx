import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Badge, ButtonLink } from "@/components/ui";
import { parseJson, plural } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { MATERIAL_KIND_LABEL, normalizeMaterialContent, type MaterialKind } from "@/lib/material-content";
import { cardPictogram, type PictogramKey } from "@/lib/pictograms";
import { Pictogram } from "./pictogram";
import { MaterialStatusBadge, materialImageUrl } from "./material-view";

export type MaterialSummary = {
  id: string;
  title: string;
  kindLabel: string;
  approved: boolean;
  createdAt: Date;
  cards: number;
  activities: number;
  thumb: { at: Date } | null;
  pictogram: PictogramKey;
};


export function materialSummary(material: { id: string; title: string; kind: string; status: string; content: string; createdAt: Date; images: { createdAt: Date }[] }): MaterialSummary {
  const content = normalizeMaterialContent(parseJson<unknown>(material.content, {}));
  const first = content.cards[0];
  return {
    id: material.id,
    title: material.title,
    kindLabel: MATERIAL_KIND_LABEL[material.kind as MaterialKind] ?? material.kind,
    approved: material.status === "aprovado",
    createdAt: material.createdAt,
    cards: content.cards.length,
    activities: content.activities.length,
    thumb: material.images[0] ? { at: material.images[0].createdAt } : null,
    pictogram: first ? cardPictogram(first) : "estrela",
  };
}

export function MaterialGalleryCard({ studentId, material, href }: { studentId: string; material: MaterialSummary; href?: string }) {
  const titleId = `material-${material.id}-cartao`;
  return (
    <article id={`material-${material.id}`} aria-labelledby={titleId} className="flex w-full min-w-0 scroll-mt-24 flex-col rounded-2xl border border-line bg-paper-raised p-4 shadow-e1">
      <div className="flex h-36 items-center justify-center rounded-xl bg-brand-soft">
        {material.thumb ? (
          <Image src={materialImageUrl(material.id, 0, material.thumb.at)} alt="" width={1024} height={1024} unoptimized className="size-28 rounded-xl bg-paper-raised object-contain" />
        ) : (
          <Pictogram pictogram={material.pictogram} className="size-28" />
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge tone="info">{material.kindLabel}</Badge>
        <MaterialStatusBadge approved={material.approved} />
      </div>
      <h3 id={titleId} className="mt-2 break-words font-display text-xl font-medium leading-snug text-ink">{material.title}</h3>
      <p className="mt-1 text-sm tabular-nums text-ink-soft">
        Criado em {formatDate(material.createdAt)} · {plural(material.cards, "cartão", "cartões")} · {plural(material.activities, "atividade", "atividades")}
      </p>
      <div className="mt-auto pt-4">
        <ButtonLink href={href ?? `/estudantes/${studentId}/materiais/${material.id}`} variant="secondary">
          Abrir material<span className="sr-only">: {material.title}</span> <ArrowRight size={16} aria-hidden />
        </ButtonLink>
      </div>
    </article>
  );
}
