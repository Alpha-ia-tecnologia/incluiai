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
  const p = student.profile;
  const interests = parseJson<string[]>(p?.interests ?? null, []);
  const create = createIntersectorReport.bind(null, student.id);
  const firstName = student.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title="Articulação intersetorial"
        lede="Espaço do terapeuta: apenas informações funcionais relevantes ao ambiente escolar. Os registros clínicos completos permanecem no sistema de saúde."
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
            <button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong">
              Enviar para a equipe escolar
            </button>
          </div>
        </form>
      </Card>

      <div id="relatorios" className="scroll-mt-24"><SectionTitle>Relatórios enviados</SectionTitle></div>
      {student.intersectorReports.length === 0 ? (
        <EmptyState title="Nenhum relatório ainda" />
      ) : (
        <div className="space-y-3">
          {student.intersectorReports.map((r) => (
            <Card key={r.id}>
              <p className="mb-2 text-[11px] text-ink-soft">{r.authorName} · {formatDate(r.createdAt)}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-ink-soft">Comunicação eficaz</dt><dd className="text-ink">{r.communication}</dd></div>
                <div><dt className="text-xs text-ink-soft">Recursos de acessibilidade</dt><dd className="text-ink">{r.accessResources}</dd></div>
                {r.positioning ? <div><dt className="text-xs text-ink-soft">Posicionamento</dt><dd className="text-ink">{r.positioning}</dd></div> : null}
                <div><dt className="text-xs text-ink-soft">Fatores facilitadores</dt><dd className="text-ink">{r.facilitators}</dd></div>
                <div><dt className="text-xs text-ink-soft">Estratégias a testar</dt><dd className="text-ink">{r.strategiesToTry}</dd></div>
                <div><dt className="text-xs text-ink-soft">Orientações à escola</dt><dd className="text-ink">{r.schoolGuidance}</dd></div>
                <div><dt className="text-xs text-ink-soft">Objetivos compartilhados</dt><dd className="text-ink">{r.sharedGoals}</dd></div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
