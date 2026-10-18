import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessStudent } from "@/lib/auth";
import { createFamilyNote, markHomeActivityDone } from "@/actions/diary";
import { homeActivityNote, loadJourney, recordJourneyMark } from "@/lib/user-journey";
import { JourneyProgress, JourneyWelcome } from "@/components/journey-ui";
import { PendingButton } from "@/components/pending-button";
import { Character } from "@/components/character";
import { parseJson, formatDate } from "@/lib/format";
import { ROLES } from "@/lib/scale";
import { PageHero, Card, SectionTitle, EmptyState } from "@/components/ui";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { FAMILY_ACHIEVEMENT_OPTIONS, FAMILY_MEMBER_OPTIONS } from "@/lib/form-options";
import { Trophy, ShieldCheck, Home, CircleCheck, BookOpen } from "lucide-react";
import { MaterialGalleryCard, materialSummary } from "@/components/materials/material-gallery";
import { DataBoard, StatTile } from "@/components/data-viz";
import { SIGNAL } from "@/components/charts";
import { percentOf } from "@/lib/series";
import { RingTile } from "@/components/viz/ring-tile";
import { SupportTrack } from "@/components/viz/support-track";
import { Timeline } from "@/components/viz/timeline";
import { labelCls as familyLabelCls, inputCls as familyInputCls } from "@/components/form-styles";


export const dynamic = "force-dynamic";

export default async function FamilyStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      school: true,
      plans: { where: { status: "ativo" }, include: { objectives: { where: { status: "ativo" } } } },
      familyNotes: { orderBy: { date: "desc" } },
      accessLogs: { orderBy: { createdAt: "desc" }, take: 200 },
      timeline: { where: { type: "conquista" }, orderBy: { date: "desc" }, take: 5 },
      activities: {
        where: { context: "casa", status: { in: ["aceita", "aplicada"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { image: { select: { altText: true, kind: true, createdAt: true } } },
      },
      // Só material aprovado pela equipe chega à família.
      materials: {
        where: { status: "aprovado" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, title: true, kind: true, status: true, content: true, createdAt: true, images: { where: { cardIndex: 0 }, select: { createdAt: true } } },
      },
    },
  });
  if (!student) notFound();
  if (!canAccessStudent(user, student.schoolId, student.id)) redirect("/");
  // O portal guarda o que a família registra: o terapeuta tem o espaço dele.
  if (user.role === "terapeuta") redirect("/terapeuta");

  const isFamily = user.role === "familia";
  if (isFamily) await recordJourneyMark(user.id, "familia_inicio");
  const journey = isFamily ? await loadJourney(user) : null;
  const objectives = student.plans.flatMap((p) => p.objectives);
  const addNote = createFamilyNote.bind(null, id);
  const firstName = student.name.split(" ")[0];
  // Feita = a família avisou pela própria página (nota com o título da atividade).
  const homeActivities = student.activities.map((activity) => ({ activity, doneAt: student.familyNotes.find((n) => n.note === homeActivityNote(activity.title))?.date }));
  const homeDone = homeActivities.filter((item) => item.doneAt).length;
  const lastNote = student.familyNotes[0];

  return (
    <>
      <PageHero
        character="care"
        title={`Acompanhamento de ${firstName}`}
        lede="O que a escola está trabalhando, os avanços recentes e o espaço para a família registrar o que observa em casa."
      />
      {journey ? (journey.welcomed ? <JourneyProgress journey={journey} layout="strip" /> : <JourneyWelcome journey={journey} />) : null}

      <section aria-label={`Resumo do acompanhamento de ${firstName}`} className="mb-6">
        <DataBoard className="sm:grid-cols-2">
          <StatTile label="Objetivos em andamento" value={objectives.length} hint={objectives.length ? "No plano de ensino ativo." : "A escola ainda está montando o plano."} />
          {/* Sem atividade enviada, não há o que medir: um anel vazio pareceria quebrado. */}
          {homeActivities.length ? (
            <RingTile
              id="familia-casa"
              pct={percentOf(homeDone, homeActivities.length)}
              label="Atividades de casa feitas"
              value={`${homeDone} de ${homeActivities.length}`}
              color={SIGNAL.lime}
              hint="Das atividades mais recentes que a escola enviou."
            />
          ) : (
            <StatTile label="Atividades de casa" value={0} hint="A escola ainda não enviou atividades para casa. Elas aparecem aqui quando chegarem." />
          )}
          <StatTile label="Conquistas recentes" value={student.timeline.length} hint={student.timeline[0] ? `A mais recente em ${formatDate(student.timeline[0].date)}.` : "As conquistas registradas pela escola aparecem aqui."} />
          <StatTile label="Registros da família" value={student.familyNotes.length} hint={lastNote ? `O último em ${formatDate(lastNote.date)}.` : "Conte para a escola o que vocês observam em casa."} />
        </DataBoard>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="scroll-mt-24" id="plano">
            <SectionTitle>O que estamos trabalhando agora</SectionTitle>
            {objectives.length === 0 ? (
              <p className="text-sm text-ink-soft">A escola ainda está montando o plano de {firstName}.</p>
            ) : (
              <ul className="space-y-3">
                {objectives.map((o) => (
                  <li key={o.id} className="min-w-0 rounded-xl border border-line bg-paper px-3.5 py-3">
                    <p className="text-sm leading-relaxed text-ink">{o.description}</p>
                    <div className="mt-3"><SupportTrack current={o.currentSupport} target={o.targetSupport} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="scroll-mt-24" id="casa">
            <SectionTitle><span className="flex items-center gap-1.5"><Home size={13} aria-hidden /> Atividades para fazer em casa</span></SectionTitle>
            {homeActivities.length === 0 ? (
              <p className="text-sm text-ink-soft">A escola enviará sugestões de atividades para casa por aqui.</p>
            ) : (
              <ul className="space-y-3">
                {homeActivities.map(({ activity: a, doneAt }) => {
                  const steps = parseJson<string[]>(a.steps, []);
                  return (
                    <li key={a.id} className="rounded-lg border border-line bg-paper px-3.5 py-2.5">
                      <p className="text-sm font-medium text-ink">{a.title}</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-sm text-ink-soft">
                        {steps.map((s) => <li key={s}>{s}</li>)}
                      </ol>
                      {a.image ? (
                        <Image
                          src={`/api/atividades/${a.id}/imagem?v=${a.image.createdAt.getTime()}`}
                          alt={a.image.altText}
                          width={a.image.kind === "sequencia" || a.image.kind === "cartoes" ? 1536 : 1024}
                          height={1024}
                          unoptimized
                          className="mt-3 h-auto w-full rounded-lg border border-line bg-white"
                        />
                      ) : null}
                      {doneAt ? <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-green"><CircleCheck size={14} aria-hidden /> Vocês fizeram esta atividade em {formatDate(doneAt)}. A escola foi avisada.</p> : null}
                      {isFamily ? (
                        <form action={markHomeActivityDone.bind(null, a.id)} className="mt-3">
                          <PendingButton className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-green/50 bg-green-soft px-4 text-sm font-medium text-green hover:bg-green-soft/70" pendingText="Avisando a escola...">
                            <CircleCheck size={16} aria-hidden /> {doneAt ? "Fizemos de novo" : "Fizemos esta atividade"}
                          </PendingButton>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="scroll-mt-24" id="materiais">
            <SectionTitle><span className="flex items-center gap-1.5"><BookOpen size={13} aria-hidden /> Materiais para usar em casa</span></SectionTitle>
            {student.materials.length === 0 ? (
              <p className="text-sm text-ink-soft">Quando a escola aprovar um material de apoio para {firstName}, ele aparece aqui, com os cartões e a dica para casa.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {student.materials.map((material) => (
                  <MaterialGalleryCard key={material.id} studentId={id} material={materialSummary(material)} href={`/familia/${id}/materiais/${material.id}`} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Conquistas recentes</SectionTitle>
            {student.timeline.length === 0 ? (
              <p className="text-sm text-ink-soft">As conquistas registradas pela escola aparecerão aqui.</p>
            ) : (
              <>
              {/* Momento de comemorar: o personagem do acolhimento acompanha as conquistas. */}
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-soft/60 p-3">
                <Character variant="care" className="w-14" />
                <p className="text-sm leading-relaxed text-ink">Cada conquista conta. Comemore com {firstName} e conte para a escola o que vocês veem em casa.</p>
              </div>
              <Timeline
                label={`Conquistas recentes de ${firstName}, da mais nova para a mais antiga`}
                items={student.timeline.map((t) => ({
                  key: t.id,
                  date: formatDate(t.date),
                  title: t.title,
                  body: t.description || undefined,
                  marker: <Trophy size={16} />,
                  markerClassName: "bg-amber-soft text-amber-800",
                }))}
              />
              </>
            )}
          </Card>

          <Card>
            <SectionTitle>
              <span className="flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden /> Quem acessou os dados</span>
            </SectionTitle>
            {/* Seção 12: a família entende quem acessou os dados, com nome, papel e o que fez. */}
            {student.accessLogs.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhum acesso registrado.</p>
            ) : (
              <>
                <AccessList logs={student.accessLogs.slice(0, 8)} />
                {student.accessLogs.length > 8 ? (
                  <details className="mt-3">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand-strong">Ver o histórico completo ({student.accessLogs.length} registros{student.accessLogs.length === 200 ? ", os mais recentes" : ""})</summary>
                    <AccessList logs={student.accessLogs.slice(8)} />
                  </details>
                ) : null}
              </>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="scroll-mt-24 border-green/40" id="conquista">
            <SectionTitle>Registrar uma conquista de casa</SectionTitle>
            <p className="mb-3 text-xs leading-relaxed text-ink-soft">
              Algumas aprendizagens aparecem primeiro em casa — conte para a equipe da escola.
            </p>
            <form action={addNote} className="space-y-4">
              <MultiChoiceField name="note" label="O que aconteceu? *" options={FAMILY_ACHIEVEMENT_OPTIONS} required otherPlaceholder={`Ex.: ${firstName} pediu água durante o jantar`} legendClassName={familyLabelCls} inputClassName={familyInputCls} />
              <ChoiceField name="author" label="Quem observou" options={FAMILY_MEMBER_OPTIONS} placeholder="Escolha (opcional)" otherPlaceholder="Ex.: madrinha" labelClassName={familyLabelCls} inputClassName={familyInputCls} />
              <button type="submit" className="min-h-11 rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-strong">
                Enviar
              </button>
            </form>
          </Card>

          <div>
            <SectionTitle>O que a família já registrou</SectionTitle>
            {student.familyNotes.length === 0 ? (
              <EmptyState character="care" title="Nenhum registro ainda" hint="As observações da família ajudam a equipe a planejar." />
            ) : (
              <div className="space-y-3">
                {student.familyNotes.map((n) => (
                  <Card key={n.id}>
                    <p className="text-sm leading-relaxed text-ink">“{n.note}”</p>
                    <p className="mt-1 text-xs text-ink-soft">{n.author} · {formatDate(n.date)}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Cada acesso: quem (nome e papel), o que fez e quando.
function AccessList({ logs }: { logs: { id: string; actor: string; role: string; action: string; detail: string | null; createdAt: Date }[] }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {logs.map((log) => (
        <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
          <span className="min-w-0">
            <span className="font-medium text-ink">{log.actor}</span> <span className="text-xs text-ink-soft">({ROLES[log.role] ?? log.role})</span>
            <span className="block text-xs text-ink-soft">{log.action}{log.detail ? ` · ${log.detail}` : ""}</span>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-ink-soft">{formatDate(log.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
