import Link from "next/link";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui";
import { linkCls } from "@/components/form-styles";
import { STATUS_LABEL, type EvidenceGroup, type EvidenceStatus } from "@/lib/evidence";

// O checklist do dossiê, na tela e na impressão. `tabs` diz para quais abas
// da ficha a pessoa pode ir (a Secretaria só lê as abas de consulta).

const TONE = { ok: "green", conferir: "amber", pendente: "coral", info: "neutral" } as const;
const ICON = { ok: CircleCheck, conferir: TriangleAlert, pendente: CircleAlert, info: Info };

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const Icon = ICON[status];
  return <Badge tone={TONE[status]}><Icon size={12} aria-hidden /> {STATUS_LABEL[status]}</Badge>;
}

export function EvidenceList({ groups, studentId, tabs }: { groups: EvidenceGroup[]; studentId: string; tabs?: ReadonlySet<string> }) {
  return (
    <div className="grid min-w-0 gap-6">
      {groups.map((group) => (
        <section key={group.title} aria-labelledby={`dossie-${group.items[0].id}`} className="min-w-0">
          <h3 id={`dossie-${group.items[0].id}`} className="mb-3 text-base font-medium text-ink">{group.title}</h3>
          <ul className="grid min-w-0 gap-3">
            {group.items.map((item) => (
              <li key={item.id} className="min-w-0 rounded-2xl border border-line bg-paper p-4 print:break-inside-avoid">
                <div className="flex flex-wrap items-center gap-2">
                  <EvidenceBadge status={item.status} />
                  <span className="text-xs text-ink-soft">{item.norm}</span>
                </div>
                <h4 className="mt-2 text-sm font-medium text-ink">{item.label}</h4>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.detail}</p>
                {tabs?.has(item.tab) && item.status !== "info" ? (
                  <p className="mt-2 text-sm print:hidden"><Link href={`/estudantes/${studentId}${item.tab ? `/${item.tab}` : ""}`} className={linkCls}>Ver o registro<span className="sr-only">: {item.label}</span></Link></p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
