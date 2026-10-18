import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createIntersectorReport } from "@/actions/intersector";
import { loadJourney, recordJourneyMark } from "@/lib/user-journey";
import { JourneyProgress, JourneyWelcome } from "@/components/journey-ui";
import { parseJson, formatDate } from "@/lib/format";
import { CHANNELS } from "@/lib/scale";
import { PageHero, Card, SectionTitle, EmptyState } from "@/components/ui";
import { MultiChoiceField } from "@/components/choice-field";
import {
  ACCESSIBILITY_RESOURCE_OPTIONS, COMMUNICATION_OPTIONS, FACILITATOR_OPTIONS, POSITIONING_OPTIONS,
  SCHOOL_GUIDANCE_OPTIONS, SHARED_GOAL_OPTIONS, STRATEGIES_TO_TRY_OPTIONS,
} from "@/lib/form-options";
import { Check, FileText, Stethoscope } from "lucide-react";
import { DataBoard, MiniColumns, StatTile, StatusPill } from "@/components/data-viz";
import { monthlyCounts } from "@/lib/series";
import { Timeline } from "@/components/viz/timeline";
import { inputCls, labelCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const fieldStyle = { legendClassName: labelCls, inputClassName: inputCls };

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
  // "Visto pela escola": alguém da equipe abriu o resumo do estudante, onde fica
  // o relatório mais recente, enquanto este era o mais recente (mesmo critério
  // da jornada do terapeuta). Um relatório substituído antes disso não chegou
  // a aparecer no resumo.
  const reports = student.intersectorReports;
  const seenAt = await Promise.all(reports.map((report, index) => {
    const newer = index > 0 ? reports[index - 1].createdAt : null;
    return prisma.accessLog.findFirst({
      where: { studentId: student.id, detail: "Visão geral do prontuário", role: { notIn: ["familia", "terapeuta", "sistema"] }, createdAt: newer ? { gt: report.createdAt, lte: newer } : { gt: report.createdAt } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }).then((log) => log?.createdAt ?? null);
  }));
  const latest = reports[0];
  const latestSeen = seenAt[0] ?? null;
  const p = student.profile;
  const interests = parseJson<string[]>(p?.interests ?? null, []);
  const create = createIntersectorReport.bind(null, student.id);
  const firstName = student.name.split(" ")[0];

  return (
    <>
      <PageHero
        character="care"
        eyebrow={<><Stethoscope size={16} aria-hidden /> Rede de saúde</>}
        title="Articulação intersetorial"
        lede="Espaço do terapeuta: apenas informações funcionais relevantes ao ambiente escolar. Os registros clínicos completos permanecem no sistema de saúde."
      />
      {journey.welcomed ? <JourneyProgress journey={journey} layout="strip" /> : <JourneyWelcome journey={journey} />}

      <section aria-label="Seus relatórios" className="mb-6">
        <DataBoard className="sm:grid-cols-2">
          <StatTile
            label="Relatórios enviados"
            value={reports.length}
            hint={latest ? `O último em ${formatDate(latest.createdAt)}. Colunas: relatórios por mês, nos últimos 6 meses.` : "Seu primeiro relatório aparece aqui depois de enviado."}
            chart={reports.length ? <MiniColumns points={monthlyCounts(reports.map((report) => report.createdAt), 6)} label="Relatórios enviados por mês, nos últimos 6 meses" /> : undefined}
          />
          <StatTile
            label="A escola recebeu"
            value={!latest ? "—" : latestSeen ? "Sim" : "Ainda não"}
            tone={latestSeen ? "good" : "mid"}
            status={!latest ? undefined : latestSeen ? "Recebido" : "Aguardando"}
            hint={!latest ? "Depois do primeiro relatório, você vê aqui quando a equipe abre o acompanhamento." : latestSeen ? `A equipe abriu o acompanhamento de ${firstName} em ${formatDate(latestSeen)}, depois do seu último relatório.` : `A equipe ainda não abriu o acompanhamento de ${firstName} desde o seu último relatório.`}
          />
        </DataBoard>
      </section>

      <Card className="mb-6">
        <SectionTitle>Estudante acompanhado</SectionTitle>
        <p className="text-sm text-ink">
          <strong>{firstName}</strong> — {student.gradeYear}. {p ? `Comunicação: ${CHANNELS[p.expressiveChannel] ?? p.expressiveChannel}.` : "Perfil funcional ainda não preenchido pela escola."}
          {interests.length > 0 ? ` Interesses: ${interests.join(", ")}.` : ""}
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          Você vê apenas o perfil funcional e os relatórios de articulação — não tem acesso a notas, diário pedagógico ou dados administrativos.
        </p>
      </Card>

      <Card className="mb-8 max-w-3xl scroll-mt-24" id="novo-relatorio">
        <SectionTitle>Novo relatório de articulação</SectionTitle>
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">Marque o que se aplica em cada item. Se faltar alguma opção, toque em Outro e escreva. Os itens com * são obrigatórios.</p>
        <form action={create} className="grid gap-6">
          <MultiChoiceField name="communication" label="Formas de comunicação mais eficazes *" options={COMMUNICATION_OPTIONS} required {...fieldStyle} />
          <MultiChoiceField name="accessResources" label="Recursos de acessibilidade utilizados *" options={ACCESSIBILITY_RESOURCE_OPTIONS} required {...fieldStyle} />
          <MultiChoiceField name="positioning" label="Necessidades de posicionamento / mobilidade" options={POSITIONING_OPTIONS} {...fieldStyle} />
          <MultiChoiceField name="facilitators" label="Fatores que facilitam a participação *" options={FACILITATOR_OPTIONS} required {...fieldStyle} />
          <MultiChoiceField name="strategiesToTry" label="Estratégias que podem ser testadas *" options={STRATEGIES_TO_TRY_OPTIONS} required {...fieldStyle} />
          <MultiChoiceField name="schoolGuidance" label="Orientações aplicáveis à escola *" options={SCHOOL_GUIDANCE_OPTIONS} required {...fieldStyle} />
          <MultiChoiceField name="sharedGoals" label="Objetivos compartilhados escola-família *" options={SHARED_GOAL_OPTIONS} required {...fieldStyle} />
          <div>
            <button type="submit" className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong">
              Enviar para a equipe escolar
            </button>
          </div>
        </form>
      </Card>

      <div id="relatorios" className="scroll-mt-24"><SectionTitle>Relatórios enviados</SectionTitle></div>
      {reports.length === 0 ? (
        <EmptyState character="care" title="Nenhum relatório ainda" hint="Use o formulário acima para enviar as primeiras orientações para a escola." />
      ) : (
        <Card className="min-w-0">
          <Timeline
            label="Relatórios enviados, do mais recente para o mais antigo"
            items={reports.map((r, index) => {
              const seen = seenAt[index];
              return {
                key: r.id,
                date: formatDate(r.createdAt),
                // Pílula curta (não quebra linha) e o detalhe ao lado, que quebra a 320 px.
                badge: seen ? <><StatusPill tone="good"><Check size={12} aria-hidden /> Visto pela escola</StatusPill><span className="text-xs text-ink-soft">em {formatDate(seen)}</span></>
                  : index === 0 ? <StatusPill tone="mid">Aguardando a escola abrir</StatusPill>
                    : <><StatusPill tone="neutral">Sem visualização</StatusPill><span className="text-xs text-ink-soft">um relatório mais novo o substituiu</span></>,
                marker: seen ? <Check size={16} strokeWidth={3} /> : <FileText size={16} />,
                markerClassName: seen ? "bg-signal-lime text-ink-strong" : "border-2 border-dashed border-line bg-paper-raised text-ink-soft",
                title: `Relatório de ${r.authorName}`,
                body: <ReportDetails report={r} />,
              };
            })}
          />
        </Card>
      )}
    </>
  );
}

type Report = { communication: string; accessResources: string; positioning: string | null; facilitators: string; strategiesToTry: string; schoolGuidance: string; sharedGoals: string };

function ReportDetails({ report: r }: { report: Report }) {
  return (
    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
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
