import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessStudent } from "@/lib/auth";
import { createFamilyNote, markHomeActivityDone } from "@/actions/diary";
import { homeActivityNote, loadJourney, recordJourneyMark } from "@/lib/user-journey";
import { JourneyProgress, JourneyWelcome } from "@/components/journey-ui";
import { PendingButton } from "@/components/pending-button";
import { parseJson, formatDate } from "@/lib/format";
import { ROLES } from "@/lib/scale";
import { PageHeader, Card, SectionTitle, Badge, EmptyState } from "@/components/ui";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { FAMILY_ACHIEVEMENT_OPTIONS, FAMILY_MEMBER_OPTIONS } from "@/lib/form-options";
import { Trophy, ShieldCheck, Home, CircleCheck } from "lucide-react";

const familyLabelCls = "mb-2 block text-sm font-medium text-ink";
const familyInputCls = "min-h-11 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";

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
      accessLogs: { orderBy: { createdAt: "desc" }, take: 8 },
      timeline: { where: { type: "conquista" }, orderBy: { date: "desc" }, take: 5 },
      activities: {
        where: { context: "casa", status: { in: ["aceita", "aplicada"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { image: { select: { altText: true, kind: true, createdAt: true } } },
      },
    },
  });
  if (!student) notFound();
  if (!canAccessStudent(user, student.schoolId, student.id)) redirect("/");

  const isFamily = user.role === "familia";
  if (isFamily) await recordJourneyMark(user.id, "familia_inicio");
  const journey = isFamily ? await loadJourney(user) : null;
  const objectives = student.plans.flatMap((p) => p.objectives);
  const addNote = createFamilyNote.bind(null, id);
  const firstName = student.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Acompanhamento de ${firstName}`}
        lede="O que a escola está trabalhando, os avanços recentes e o espaço para a família registrar o que observa em casa."
      />
      {journey ? (journey.welcomed ? <JourneyProgress journey={journey} layout="strip" /> : <JourneyWelcome journey={journey} />) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="scroll-mt-24" id="plano">
            <SectionTitle>O que estamos trabalhando agora</SectionTitle>
            {objectives.length === 0 ? (
              <p className="text-sm text-ink-soft">A escola ainda está montando o plano de {firstName}.</p>
            ) : (
              <ul className="space-y-2.5">
                {objectives.map((o) => (
                  <li key={o.id} className="rounded-xl bg-brand-soft/50 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
                    {o.description}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="scroll-mt-24" id="casa">
            <SectionTitle><span className="flex items-center gap-1.5"><Home size={13} aria-hidden /> Atividades para fazer em casa</span></SectionTitle>
            {student.activities.length === 0 ? (
              <p className="text-sm text-ink-soft">A escola enviará sugestões de atividades para casa por aqui.</p>
            ) : (
              <ul className="space-y-3">
                {student.activities.map((a) => {
                  const steps = parseJson<string[]>(a.steps, []);
                  const doneAt = student.familyNotes.find((n) => n.note === homeActivityNote(a.title))?.date;
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

          <Card>
            <SectionTitle>Conquistas recentes</SectionTitle>
            {student.timeline.length === 0 ? (
              <p className="text-sm text-ink-soft">As conquistas registradas pela escola aparecerão aqui.</p>
            ) : (
              <ul className="space-y-2">
                {student.timeline.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm text-ink">
                    <Trophy size={15} className="mt-0.5 shrink-0 text-amber-800" aria-hidden />
                    <span>
                      <strong>{t.title}</strong>
                      {t.description ? ` — ${t.description}` : ""}
                      <span className="block text-[11px] text-ink-soft">{formatDate(t.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle>
              <span className="flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden /> Quem acessou os dados</span>
            </SectionTitle>
            {student.accessLogs.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhum acesso registrado.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-ink-soft">
                {student.accessLogs.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-1.5">
                    <Badge>{ROLES[l.role] ?? l.role}</Badge>
                    <span>{l.action} {l.detail ? `· ${l.detail}` : ""}</span>
                    <span className="ml-auto">{formatDate(l.createdAt)}</span>
                  </li>
                ))}
              </ul>
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
              <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-strong">
                Enviar
              </button>
            </form>
          </Card>

          <div>
            <SectionTitle>O que a família já registrou</SectionTitle>
            {student.familyNotes.length === 0 ? (
              <EmptyState title="Nenhum registro ainda" hint="As observações da família ajudam a equipe a planejar." />
            ) : (
              <div className="space-y-3">
                {student.familyNotes.map((n) => (
                  <Card key={n.id}>
                    <p className="text-sm leading-relaxed text-ink">“{n.note}”</p>
                    <p className="mt-1 text-[11px] text-ink-soft">{n.author} · {formatDate(n.date)}</p>
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
