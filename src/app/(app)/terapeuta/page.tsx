import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createIntersectorReport } from "@/actions/intersector";
import { loadJourney, recordJourneyMark } from "@/lib/user-journey";
import { JourneyProgress, JourneyWelcome } from "@/components/journey-ui";
import { parseJson, formatDate } from "@/lib/format";
import { CHANNELS } from "@/lib/scale";
import { PageHeader, Card, SectionTitle, Badge, EmptyState } from "@/components/ui";
import { MultiChoiceField } from "@/components/choice-field";
import {
  ACCESSIBILITY_RESOURCE_OPTIONS, COMMUNICATION_OPTIONS, FACILITATOR_OPTIONS, POSITIONING_OPTIONS,
  SCHOOL_GUIDANCE_OPTIONS, SHARED_GOAL_OPTIONS, STRATEGIES_TO_TRY_OPTIONS,
} from "@/lib/form-options";
import { Stethoscope } from "lucide-react";

export const dynamic = "force-dynamic";

const inputCls = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";
const labelCls = "mb-2 block text-sm font-medium text-ink";
const fieldStyle = { legendClassName: labelCls, inputClassName: inputCls, visibleCount: 6 };
const groupTitleCls = "text-sm font-semibold text-ink";

type Report = { id: string; authorName: string; createdAt: Date; communication: string; accessResources: string; positioning: string | null; facilitators: string; strategiesToTry: string; schoolGuidance: string; sharedGoals: string };

function ReportFields({ report: r }: { report: Report }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-ink-soft">Comunicação eficaz</dt><dd className="text-ink">{r.communication}</dd></div>
      <div><dt className="text-xs text-ink-soft">Recursos de acessibilidade</dt><dd className="text-ink">{r.accessResources}</dd></div>
      {r.positioning ? <div><dt className="text-xs text-ink-soft">Posicionamento</dt><dd className="text-ink">{r.positioning}</dd></div> : null}
      <div><dt className="text-xs text-ink-soft">Fatores facilitadores</dt><dd className="text-ink">{r.facilitators}</dd></div>
      <div><dt className="text-xs text-ink-soft">Estratégias a testar</dt><dd className="text-ink">{r.strategiesToTry}</dd></div>
      <div><dt className="text-xs text-ink-soft">Orientações à escola</dt><dd className="text-ink">{r.schoolGuidance}</dd></div>
      <div><dt className="text-xs text-ink-soft">Objetivos compartilhados</dt><dd className="text-ink">{r.sharedGoals}</dd></div>
    </dl>
  );
}

export default async function TherapistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "terapeuta" || !user.studentId) redirect("/");
  await recordJourneyMark(user.id, "terapeuta_inicio");
  const journey = await loadJourney(user);

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: user.studentId },
    include: {
      profile: true,
      intersectorReports: { orderBy: { createdAt: "desc" } },
    },
  });
  const p = student.profile;
  const interests = parseJson<string[]>(p?.interests ?? null, []);
  const create = createIntersectorReport.bind(null, student.id);
  const firstName = student.name.split(" ")[0];
  const [latest, ...olderReports] = student.intersectorReports;

  return (
    <>
      <PageHeader
        title="Orientações para a escola"
        lede={`Conte à escola o que ajuda ${firstName} a participar das aulas. Só entram informações funcionais: os registros clínicos continuam no sistema de saúde.`}
        actions={<Badge tone="brand"><Stethoscope size={12} aria-hidden /> Rede de saúde</Badge>}
      />
      {journey.welcomed ? <JourneyProgress journey={journey} layout="strip" /> : <JourneyWelcome journey={journey} />}

      <Card className="mb-6">
        <SectionTitle>Estudante acompanhado</SectionTitle>
        <p className="text-sm text-ink">
          <strong>{firstName}</strong> — {student.gradeYear}. {p ? `Comunicação: ${CHANNELS[p.expressiveChannel] ?? p.expressiveChannel}.` : "Perfil funcional ainda não preenchido pela escola."}
          {interests.length > 0 ? ` Interesses: ${interests.join(", ")}.` : ""}
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          Você vê como {firstName} aprende e as orientações que enviou. Notas, diário de aula e dados administrativos ficam só com a escola.
        </p>
      </Card>

      <Card className="mb-8 max-w-3xl scroll-mt-24" id="novo-relatorio">
        <SectionTitle>Enviar novas orientações</SectionTitle>
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">Marque o que se aplica em cada item. Se faltar alguma opção, toque em Outro e escreva. Os itens com * são obrigatórios.</p>
        <form action={create} className="grid gap-8">
          <div className="grid gap-6">
            <h3 className={groupTitleCls}>Como {firstName} participa melhor</h3>
            <MultiChoiceField name="communication" label="Formas de comunicação mais eficazes *" options={COMMUNICATION_OPTIONS} required {...fieldStyle} />
            <MultiChoiceField name="accessResources" label="Recursos de acessibilidade utilizados *" options={ACCESSIBILITY_RESOURCE_OPTIONS} required {...fieldStyle} />
            <MultiChoiceField name="positioning" label="Necessidades de posicionamento / mobilidade" options={POSITIONING_OPTIONS} {...fieldStyle} />
            <MultiChoiceField name="facilitators" label="Fatores que facilitam a participação *" options={FACILITATOR_OPTIONS} required {...fieldStyle} />
          </div>
          <div className="grid gap-6 border-t border-line pt-6">
            <h3 className={groupTitleCls}>O que a escola pode fazer</h3>
            <MultiChoiceField name="strategiesToTry" label="Estratégias que podem ser testadas *" options={STRATEGIES_TO_TRY_OPTIONS} required {...fieldStyle} />
            <MultiChoiceField name="schoolGuidance" label="Orientações aplicáveis à escola *" options={SCHOOL_GUIDANCE_OPTIONS} required {...fieldStyle} />
            <MultiChoiceField name="sharedGoals" label="Objetivos compartilhados escola-família *" options={SHARED_GOAL_OPTIONS} required {...fieldStyle} />
          </div>
          <div>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-medium text-white hover:bg-brand-hover">
              Enviar para a equipe escolar
            </button>
          </div>
        </form>
      </Card>

      <div id="relatorios" className="scroll-mt-24"><SectionTitle>Orientações enviadas</SectionTitle></div>
      {student.intersectorReports.length === 0 ? (
        <EmptyState title="Nenhuma orientação enviada ainda" hint="Quando você enviar, a equipe da escola vê na página do estudante." />
      ) : (
        <div className="space-y-3">
          {/* O mais recente fica aberto; os anteriores, recolhidos. */}
          <Card>
            <p className="mb-2 text-xs text-ink-soft">Mais recente · {latest.authorName} · {formatDate(latest.createdAt)}</p>
            <ReportFields report={latest} />
          </Card>
          {olderReports.length > 0 ? (
            <details className="rounded-2xl border border-line px-4">
              <summary className="flex min-h-12 cursor-pointer items-center py-3 text-sm font-medium text-ink">Orientações anteriores ({olderReports.length})</summary>
              <div className="space-y-3 pb-4">
                {olderReports.map((r) => (
                  <div key={r.id} className="border-t border-line pt-3">
                    <p className="mb-2 text-xs text-ink-soft">{r.authorName} · {formatDate(r.createdAt)}</p>
                    <ReportFields report={r} />
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </>
  );
}
