import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { upsertProfile } from "@/actions/profile";
import { parseJson, readList, firstName } from "@/lib/format";
import { SUPPORT_LEVELS, CHANNELS, BARRIERS, SENSORY_AREAS, SENSORY_LABELS, SENSORY_VALUES } from "@/lib/scale";
import { SUPPORT_FIELD_LABEL, profileSuggestionsFromStudy } from "@/lib/functional-profile";
import { ButtonLink, PageHeader, Card, SectionTitle } from "@/components/ui";
import { PillLink } from "@/components/pill-link";
import { ProfileChat } from "@/components/profile-chat";
import type { ProfileAnswers } from "@/components/profile-chat";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { ActionForm } from "@/components/action-form";
import { ATTENTION_MINUTES, CALMING_OPTIONS, EARLY_SIGN_OPTIONS, INTEREST_OPTIONS, STRENGTH_OPTIONS, TASK_TOLERANCE_MINUTES, TRIGGER_OPTIONS } from "@/lib/form-options";
import { parseCaseStudy } from "@/lib/case-study";
import { MessageSquareText, ListChecks } from "lucide-react";
import { inputCls, labelCls, BUTTON_CLS } from "@/components/form-styles";
import { param, readProfileSaved, type SearchParams } from "@/lib/search-params";

const channelOptions = Object.entries(CHANNELS).map(([value, label]) => ({ value, label }));

function SupportSelect({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <div>
      <label htmlFor={name} className={labelCls}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue} className={inputCls}>
        {SUPPORT_LEVELS.map((l) => (
          <option key={l.level} value={l.level}>{l.level} · {l.code} — {l.label}</option>
        ))}
      </select>
    </div>
  );
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const prisma = await db();
  const { id } = await params;
  await requireStudentPage(id, "Como aprende", { tab: "perfil" });
  const query = await searchParams;
  const modo = param(query.modo);
  const savedAt = readProfileSaved(query);
  const [student, profile, caseStudy] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id } }),
    prisma.functionalProfile.findUnique({ where: { studentId: id } }),
    prisma.caseStudy.findUnique({ where: { studentId: id }, select: { content: true } }),
  ]);
  const p = profile;
  const study = !p && caseStudy ? parseCaseStudy(caseStudy.content) : {};
  const suggested = profileSuggestionsFromStudy(study);
  const hasSuggestions = Boolean(suggested.expressiveChannel || suggested.interests.length || suggested.barriers.length || suggested.strengths);
  const sensory = parseJson<Record<string, string>>(p?.sensoryProfile ?? null, {});
  const barriers = readList(p?.barriers ?? null);
  const csv = (v: string | null | undefined) => readList(v ?? null).join(", ");
  const upsert = upsertProfile.bind(null, id);
  const initialAnswers: ProfileAnswers = p
    ? {
        expressiveChannel: p.expressiveChannel,
        receptiveChannel: p.receptiveChannel,
        commandSteps: String(p.commandSteps),
        readingSupport: String(p.readingSupport),
        writingSupport: String(p.writingSupport),
        mathSupport: String(p.mathSupport),
        attentionMinutes: String(p.attentionMinutes),
        peerInteraction: String(p.peerInteraction),
        adultInteraction: String(p.adultInteraction),
        groupWork: String(p.groupWork),
        feeding: String(p.feeding),
        hygiene: String(p.hygiene),
        mobility: String(p.mobility),
        organization: String(p.organization),
        sens_auditiva: sensory.auditiva ?? "tipica",
        sens_visual: sensory.visual ?? "tipica",
        sens_tatil: sensory.tatil ?? "tipica",
        sens_vestibular: sensory.vestibular ?? "tipica",
        sens_proprioceptiva: sensory.proprioceptiva ?? "tipica",
        fineMotor: String(p.fineMotor),
        grossMotor: String(p.grossMotor),
        usesWheelchairOrOrthosis: p.usesWheelchairOrOrthosis ? "sim" : "nao",
        triggers: csv(p.triggers),
        earlySigns: csv(p.earlySigns),
        calmingStrategies: csv(p.calmingStrategies),
        bestShift: p.bestShift,
        taskToleranceMinutes: String(p.taskToleranceMinutes),
        interests: csv(p.interests),
        barriers,
        strengths: p.strengths ?? "",
      }
    : {
        ...(suggested.expressiveChannel ? { expressiveChannel: suggested.expressiveChannel } : {}),
        ...(suggested.interests.length ? { interests: suggested.interests.join(", ") } : {}),
        ...(suggested.barriers.length ? { barriers: suggested.barriers } : {}),
        ...(suggested.strengths ? { strengths: suggested.strengths.replace(/;\s*/g, ", ") } : {}),
      };
  const suggestionNote = hasSuggestions ? (
    <p className="mb-4 max-w-3xl rounded-xl bg-sky-soft px-4 py-3 text-xs leading-relaxed text-sky-ink">
      Sugestões do estudo de caso já preenchidas. Confira antes de salvar.
    </p>
  ) : null;
  const chatMode = modo !== "formulario";

  if (chatMode) {
    return (
      <>
        <PageHeader
          level={2}
          title="Como aprende"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PillLink slug="comunicacao-alternativa" />
              <ButtonLink href={`/estudantes/${id}/perfil?modo=formulario`} variant="quiet">
                <ListChecks size={16} aria-hidden /> Abrir formulário completo
              </ButtonLink>
            </div>
          }
        />

        {p ? (
          <p className="mb-4 max-w-3xl rounded-xl bg-brand-soft/60 px-4 py-3 text-xs leading-relaxed text-brand-strong">
            {savedAt ? "Perfil salvo. Atualize sempre que algo mudar." : "Perfil já salvo. Atualize o que mudou."}
          </p>
        ) : suggestionNote}
        <ProfileChat
          action={upsert}
          firstName={firstName(student.name)}
          initialAnswers={initialAnswers}
          hasSavedProfile={Boolean(p)}
          savedAt={savedAt}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        level={2}
        title="Como aprende"
        lede="Em cada item, escolha o apoio de que o estudante precisa hoje."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PillLink slug="comunicacao-alternativa" />
            <ButtonLink href={`/estudantes/${id}/perfil`} variant="quiet">
              <MessageSquareText size={16} aria-hidden /> Responder uma pergunta por vez
            </ButtonLink>
          </div>
        }
      />
      {suggestionNote}
      <ActionForm action={upsert} className="max-w-3xl">
        <div className="space-y-5">
          <Card>
            <SectionTitle>Comunicação</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              <ChoiceField name="expressiveChannel" label="Como se comunica" options={channelOptions} defaultValue={p?.expressiveChannel ?? "fala"} required />
              <ChoiceField name="receptiveChannel" label="Como compreende melhor" options={channelOptions} defaultValue={p?.receptiveChannel ?? "fala"} required />
              <div>
                <label htmlFor="commandSteps" className={labelCls}>Quantas etapas compreende por vez</label>
                <select id="commandSteps" name="commandSteps" defaultValue={p?.commandSteps ?? 1} className={inputCls}>
                  <option value={1}>1 etapa</option>
                  <option value={2}>2 etapas</option>
                  <option value={3}>3 etapas</option>
                </select>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Aprendizagem</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <SupportSelect name="readingSupport" label={SUPPORT_FIELD_LABEL.readingSupport} defaultValue={p?.readingSupport ?? 2} />
              <SupportSelect name="writingSupport" label={SUPPORT_FIELD_LABEL.writingSupport} defaultValue={p?.writingSupport ?? 2} />
              <SupportSelect name="mathSupport" label={SUPPORT_FIELD_LABEL.mathSupport} defaultValue={p?.mathSupport ?? 2} />
              <ChoiceField name="attentionMinutes" label="Tempo de atenção" options={ATTENTION_MINUTES} defaultValue={String(p?.attentionMinutes ?? 10)} required otherType="number" otherMin={1} otherMax={120} otherPlaceholder="Minutos" />
            </div>
          </Card>

          <Card>
            <SectionTitle>Interação e autonomia</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <SupportSelect name="peerInteraction" label={SUPPORT_FIELD_LABEL.peerInteraction} defaultValue={p?.peerInteraction ?? 2} />
              <SupportSelect name="adultInteraction" label={SUPPORT_FIELD_LABEL.adultInteraction} defaultValue={p?.adultInteraction ?? 1} />
              <SupportSelect name="groupWork" label={SUPPORT_FIELD_LABEL.groupWork} defaultValue={p?.groupWork ?? 2} />
              <SupportSelect name="organization" label={SUPPORT_FIELD_LABEL.organization} defaultValue={p?.organization ?? 2} />
              <SupportSelect name="feeding" label={SUPPORT_FIELD_LABEL.feeding} defaultValue={p?.feeding ?? 0} />
              <SupportSelect name="hygiene" label={SUPPORT_FIELD_LABEL.hygiene} defaultValue={p?.hygiene ?? 0} />
              <SupportSelect name="mobility" label={SUPPORT_FIELD_LABEL.mobility} defaultValue={p?.mobility ?? 0} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Sensações e movimentos</SectionTitle>
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              {SENSORY_AREAS.map((area) => (
                <div key={area}>
                  <label htmlFor={`sens_${area}`} className={labelCls}>{SENSORY_LABELS[area]}</label>
                  <select id={`sens_${area}`} name={`sens_${area}`} defaultValue={sensory[area] ?? "tipica"} className={inputCls}>
                    {Object.entries(SENSORY_VALUES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SupportSelect name="fineMotor" label={SUPPORT_FIELD_LABEL.fineMotor} defaultValue={p?.fineMotor ?? 1} />
              <SupportSelect name="grossMotor" label={SUPPORT_FIELD_LABEL.grossMotor} defaultValue={p?.grossMotor ?? 0} />
            </div>
            <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="usesWheelchairOrOrthosis" defaultChecked={p?.usesWheelchairOrOrthosis} className="size-4 accent-[var(--brand)]" />
              Usa cadeira de rodas ou órtese
            </label>
          </Card>

          <Card>
            <SectionTitle>Bem-estar e ritmo</SectionTitle>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <MultiChoiceField name="triggers" label="O que causa desconforto" options={TRIGGER_OPTIONS} defaultValue={readList(p?.triggers ?? null)} separator="," />
              </div>
              <div className="sm:col-span-2">
                <MultiChoiceField name="earlySigns" label="Como demonstra que precisa de uma pausa" options={EARLY_SIGN_OPTIONS} defaultValue={readList(p?.earlySigns ?? null)} separator="," />
              </div>
              <div className="sm:col-span-2">
                <MultiChoiceField name="calmingStrategies" label="Estratégias que acalmam" options={CALMING_OPTIONS} defaultValue={readList(p?.calmingStrategies ?? null)} separator="," />
              </div>
              <div>
                <label htmlFor="bestShift" className={labelCls}>Melhor turno</label>
                <select id="bestShift" name="bestShift" defaultValue={p?.bestShift ?? "manha"} className={inputCls}>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
              <ChoiceField name="taskToleranceMinutes" label="Tempo de participação na atividade" options={TASK_TOLERANCE_MINUTES} defaultValue={String(p?.taskToleranceMinutes ?? 15)} required otherType="number" otherMin={1} otherMax={120} otherPlaceholder="Minutos" />
            </div>
          </Card>

          <Card className="border-amber/50">
            <SectionTitle>Do que o estudante gosta</SectionTitle>
            <MultiChoiceField name="interests" label="Escolha de 3 a 5 temas *" options={INTEREST_OPTIONS} defaultValue={p ? readList(p.interests) : suggested.interests} required separator="," />
          </Card>

          <Card>
            <SectionTitle>Dificuldades e pontos fortes</SectionTitle>
            <div className="space-y-5">
              <MultiChoiceField name="barriers" label="O que dificulta a participação" options={Object.entries(BARRIERS).map(([value, label]) => ({ value, label }))} defaultValue={p ? barriers : suggested.barriers} submit="multiple" />
              <MultiChoiceField name="strengths" label="O que faz bem e o que ajuda a participar" options={STRENGTH_OPTIONS} defaultValue={p ? p.strengths ?? "" : suggested.strengths} />
            </div>
          </Card>

          <button type="submit" className={BUTTON_CLS.primary}>
            Salvar informações
          </button>
        </div>
      </ActionForm>
    </>
  );
}


