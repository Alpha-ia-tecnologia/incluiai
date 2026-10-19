import { PARTICIPATION_TEXT, PARTICIPATION_TONE, countItems, percentOf, supportSeries, supportTrend, weeklyCounts, type SeriesPoint, type Trend, type VizTone } from "./series";
import { SUMMARY_VIEW_DETAILS } from "./access-log";
import { prisma } from "./prisma";
import { canAccessStudent, isNetworkRole, type SessionUser } from "./auth";
import { objectiveTrend } from "./insights";
import { getStudentNextStep } from "./student-journey";
import { firstName, formatDate, parseJson } from "./format";
import { CHANNELS } from "./scale";
import { todayInBrazil, upcomingEvents } from "./commemorative-dates";
import type { CharacterVariant } from "@/components/character";

// Jornada de cada perfil: a história de Maria e Dante
// (docs/jornada-do-usuario.md) contada com os dados reais de quem está usando.
// Cada capítulo se marca sozinho a partir do que já foi salvo, mostra a
// evidência e leva à ação seguinte. Os capítulos orientam, não bloqueiam:
// todas as telas continuam acessíveis a qualquer momento.

export type JourneyMarkKey = "boas_vindas" | "painel" | "recursos" | "calendario" | "cadastros" | "familia_inicio" | "terapeuta_inicio";

export type ChapterStatus = "concluido" | "agora" | "pendente" | "em_seguida" | "aguardando";
export type ChapterTone = "rose" | "sky" | "peach" | "teal" | "sage" | "lilac";

export type Chapter = {
  key: string;
  title: string;
  story: string;
  why: string;
  done: boolean;
  // Depende de outra pessoa (ex.: a escola enviar a atividade de casa).
  waiting: boolean;
  status: ChapterStatus;
  evidence: string | null;
  date: Date | null;
  progress: { done: number; total: number } | null;
  action: { label: string; href: string };
  tone: ChapterTone;
};

export type Milestone = { key: string; title: string; description: string; achieved: boolean; date: Date | null };
// Gráfico que acompanha o número (desenhado com src/components/data-viz.tsx).
export type ImpactViz =
  | { kind: "weekly"; points: SeriesPoint[] }
  | { kind: "ring"; pct: number | null; tone: VizTone }
  | { kind: "support"; values: number[]; delta: number | null; trend: Trend }
  | { kind: "dots"; items: { key: string; title: string; tone: VizTone }[] };
export type ImpactItem = { label: string; value: string; hint?: string; viz?: ImpactViz };

export type Journey = {
  kind: "professor" | "escola" | "rede" | "familia" | "terapeuta";
  title: string;
  intro: string;
  welcome: { headline: string; text: string };
  character: CharacterVariant;
  focus: { id: string; name: string; options: { id: string; name: string }[] } | null;
  chapters: Chapter[];
  current: Chapter | null;
  completed: number;
  impactTitle: string;
  impact: ImpactItem[];
  strategies: { label: string; value: number }[];
  quote: { text: string; source: string } | null;
  milestones: Milestone[];
  welcomed: boolean;
};

type ChapterInput = Omit<Chapter, "status" | "progress" | "date" | "evidence" | "waiting"> & Partial<Pick<Chapter, "progress" | "date" | "evidence" | "waiting">>;

const DAY_MS = 86_400_000;
const HOME_DONE_PREFIX = "Fizemos em casa";
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;
const listText = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);
const decimal = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function isHomeActivityNote(note: string): boolean {
  return note.startsWith(HOME_DONE_PREFIX);
}

export function homeActivityNote(title: string): string {
  return `${HOME_DONE_PREFIX} a atividade “${title}”.`;
}

// Marca um momento da jornada (boas-vindas, página visitada). Repetir não muda nada.
export async function recordJourneyMark(userId: string, key: JourneyMarkKey): Promise<void> {
  try {
    await prisma.journeyMark.upsert({ where: { userId_key: { userId, key } }, update: {}, create: { userId, key } });
  } catch (error) {
    // Duas abas abrindo a mesma página ao mesmo tempo: o marco já existe.
    if ((error as { code?: string }).code !== "P2002") throw error;
  }
}

// "Agora" é o capítulo indicado (o próximo passo do estudante, quando há) ou o
// primeiro ainda aberto que dependa da própria pessoa. Os abertos antes dele
// ficam pendentes; os depois, em seguida; os que dependem de outra pessoa, aguardando.
function withStatus(chapters: ChapterInput[], preferred?: string): Chapter[] {
  const open = (chapter: ChapterInput) => !chapter.done && !chapter.waiting;
  const current = chapters.find((chapter) => chapter.key === preferred && open(chapter)) ?? chapters.find(open);
  const currentIndex = current ? chapters.indexOf(current) : chapters.length;
  return chapters.map((chapter, index) => ({
    evidence: null, date: null, progress: null, waiting: false, ...chapter,
    status: chapter.done ? "concluido" : chapter === current ? "agora" : chapter.waiting ? "aguardando" : index < currentIndex ? "pendente" : "em_seguida",
  }));
}

function finish(journey: Omit<Journey, "current" | "completed">): Journey {
  return {
    ...journey,
    current: journey.chapters.find((chapter) => chapter.status === "agora") ?? null,
    completed: journey.chapters.filter((chapter) => chapter.done).length,
  };
}

const ratio = (done: number, total: number) => ({ done, total });

export async function loadJourney(user: SessionUser, options: { studentId?: unknown } = {}): Promise<Journey> {
  const marks = new Map((await prisma.journeyMark.findMany({ where: { userId: user.id } })).map((mark) => [mark.key, mark.createdAt]));
  if (user.role === "familia") return familyJourney(user, marks);
  if (user.role === "terapeuta") return therapistJourney(user, marks);
  if (user.role === "secretaria") return networkJourney(user, marks);
  if (isNetworkRole(user.role)) return schoolJourney(user, marks);
  return teacherJourney(user, marks, typeof options.studentId === "string" ? options.studentId : undefined);
}

type Marks = Map<string, Date>;

// ---------------------------------------------------------------------------
// Professor da sala comum, do AEE e profissional de apoio: a história de um
// estudante, como a de Maria e Dante.
// ---------------------------------------------------------------------------
async function teacherJourney(user: SessionUser, marks: Marks, requestedId?: string): Promise<Journey> {
  const aee = user.role === "professor_aee";
  const candidates = await prisma.student.findMany({
    where: { status: "ativo", ...(user.schoolId ? { schoolId: user.schoolId } : {}) },
    select: { id: true, name: true, schoolId: true },
    orderBy: { name: "asc" },
  });
  const students = candidates.filter((student) => canAccessStudent(user, student.schoolId, student.id));
  const welcome = {
    headline: `Boas-vindas, ${firstName(user.name)}!`,
    text: aee
      ? "Sua história na IncluiEdu acompanha cada estudante em seis capítulos: ouvir a história, conhecer como aprende, combinar o objetivo, preparar a aula, registrar e ajustar. A plataforma lembra onde você parou."
      : "Sua história na IncluiEdu acompanha cada estudante em seis capítulos: ouvir a história, conhecer como aprende, combinar o objetivo, preparar uma aula com a turma, registrar e ajustar. A plataforma lembra onde você parou.",
  };
  const base = {
    kind: "professor" as const, character: (aee ? "planning" : "learning") as CharacterVariant,
    impactTitle: "O que a história já mostra", welcomed: marks.has("boas_vindas"), welcome,
  };
  if (!students.length) {
    return finish({
      ...base, title: "Sua história começa com um estudante", focus: null, chapters: [], impact: [], strategies: [], quote: null, milestones: [],
      intro: "Quando um estudante da sua escola for cadastrado, a história do acompanhamento dele aparece aqui, capítulo por capítulo.",
    });
  }

  // Foco: o estudante pedido, ou o último que a pessoa abriu, ou o primeiro da lista.
  const ids = students.map((student) => student.id);
  const lastOpened = requestedId && ids.includes(requestedId) ? null : await prisma.accessLog.findFirst({
    where: { actor: user.name, role: user.role, studentId: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: { studentId: true },
  });
  const focusId = requestedId && ids.includes(requestedId) ? requestedId : lastOpened?.studentId ?? ids[0];

  const [s, milestones] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: focusId },
      include: {
        caseStudy: { select: { status: true, concludedAt: true, updatedAt: true } },
        profile: { select: { expressiveChannel: true, interests: true, updatedAt: true } },
        plans: { include: { objectives: true }, orderBy: { createdAt: "desc" } },
        activities: { where: { status: { in: ["aceita", "aplicada"] } }, orderBy: { createdAt: "asc" }, select: { title: true, createdAt: true } },
        diaryEntries: { orderBy: { date: "asc" } },
        familyNotes: { orderBy: { date: "desc" }, take: 1, select: { note: true, date: true, author: true } },
      },
    }),
    teamMilestones(ids),
  ]);

  const name = firstName(s.name);
  const path = `/estudantes/${s.id}`;
  const activePlan = s.plans.find((plan) => plan.status === "ativo");
  const activeObjectives = activePlan?.objectives.filter((objective) => objective.status === "ativo") ?? [];
  const allObjectives = s.plans.flatMap((plan) => plan.objectives);
  const entries = s.diaryEntries;
  const lastEntry = entries.at(-1);
  const interests = parseJson<string[]>(s.profile?.interests, []);
  const reviewed = allObjectives.filter((objective) => objective.status === "alcancado" || objective.status === "em_revisao");
  const advancing = activeObjectives.filter((objective) => objectiveTrend(objective, entries).trend === "avancando");
  const caseDone = s.caseStudy?.status === "concluido";

  const next = getStudentNextStep({
    id: s.id,
    caseStudy: (s.caseStudy?.status as "rascunho" | "concluido" | undefined) ?? null,
    hasProfile: !!s.profile,
    hasPlan: !!activePlan,
    hasObjective: activeObjectives.length > 0,
    hasPreparedActivity: s.activities.length > 0,
    hasDiary: entries.length > 0,
  });
  const preferred = (["estudo", "conhecer", "planejar", "preparar", entries.length ? "acompanhar" : "registrar"] as const)[next.step - 1];

  const chapters = withStatus([
    {
      key: "estudo", tone: "rose",
      title: `Ouvir a história de ${name}`,
      story: aee
        ? `Antes de planejar, converse com a família, com a escola e com ${name}, observe nos espaços da escola e registre a síntese. O estudo de caso é o ponto de partida do plano.`
        : `O estudo de caso reúne o que a família, a escola e ${name} contam. Em geral, a professora do AEE conduz; você contribui com o que observa na sala comum.`,
      why: "Entender a história evita planejar a partir de suposições.",
      done: caseDone,
      evidence: caseDone ? "A síntese do caso orienta o plano." : s.caseStudy ? "Em andamento: salvo como rascunho." : null,
      date: caseDone ? s.caseStudy?.concludedAt ?? s.caseStudy?.updatedAt ?? null : null,
      action: { label: caseDone ? "Ver o estudo de caso" : s.caseStudy ? "Continuar o estudo de caso" : "Fazer o estudo de caso", href: `${path}/estudo-de-caso` },
    },
    {
      key: "conhecer", tone: "sky",
      title: `Conhecer como ${name} aprende`,
      story: `Registre como ${name} se comunica, do que gosta e quais apoios ajudam. Os interesses viram a âncora das atividades.`,
      why: "Atividades que partem dos interesses do estudante prendem a atenção e reduzem as recusas.",
      done: !!s.profile,
      evidence: s.profile ? `Comunicação: ${CHANNELS[s.profile.expressiveChannel] ?? s.profile.expressiveChannel}${interests.length ? `. Gosta de ${listText(interests.slice(0, 3).map((item) => item.toLowerCase()))}` : ""}.` : null,
      date: s.profile?.updatedAt ?? null,
      action: { label: s.profile ? "Ver como aprende" : "Contar como aprende", href: `${path}/perfil` },
    },
    {
      key: "planejar", tone: "peach",
      title: `Combinar o que ${name} vai aprender`,
      story: `No plano de ensino, defina com a equipe um objetivo observável: o que ${name} vai fazer, com qual apoio, em qual critério e em quanto tempo.`,
      why: "Um objetivo claro mostra se o apoio está diminuindo, sem depender de nota.",
      done: activeObjectives.length > 0,
      evidence: activeObjectives[0]?.description ?? (activePlan ? "O plano está ativo, ainda sem objetivo." : null),
      date: activePlan?.createdAt ?? null,
      action: { label: activeObjectives.length ? "Abrir o plano de ensino" : "Criar o plano e o objetivo", href: `${path}/ppi` },
    },
    {
      key: "preparar", tone: "teal",
      title: `Preparar uma aula com ${name} junto da turma`,
      story: "Escolha o objetivo e o conteúdo da aula. Leia as sugestões para a sala comum, o AEE e a casa, e aceite a que você vai usar. A decisão é sua.",
      why: "Participar da mesma aula, com os apoios certos, é o que a inclusão pede.",
      done: s.activities.length > 0,
      evidence: s.activities.length ? `${plural(s.activities.length, "atividade preparada", "atividades preparadas")}. A mais recente: “${s.activities.at(-1)!.title}”.` : null,
      date: s.activities[0]?.createdAt ?? null,
      action: { label: "Preparar uma atividade", href: `${path}/atividades` },
    },
    {
      key: "registrar", tone: "sage",
      title: "Registrar como foi a aula",
      story: `Depois da aula, conte como ${name} participou, qual apoio foi necessário e o que aconteceu. São três escolhas e, se quiser, uma observação.`,
      why: "Cada registro mostra o que funcionou e orienta a próxima aula.",
      done: entries.length > 0,
      evidence: lastEntry ? `${plural(entries.length, "registro", "registros")}. O último em ${formatDate(lastEntry.date)}.` : null,
      date: entries[0]?.date ?? null,
      action: { label: "Registrar uma aula", href: `${path}/diario` },
    },
    {
      key: "acompanhar", tone: "lilac",
      title: "Ver o que mudou e ajustar",
      story: `Com alguns registros, compare o apoio de que ${name} precisou ao longo das aulas. Quando as evidências mostrarem, marque o objetivo como alcançado ou em revisão e combine o próximo passo com a equipe.`,
      why: "Revisar no tempo certo evita insistir no que não funciona e reconhece cada avanço.",
      done: reviewed.length > 0 || advancing.length > 0,
      evidence: advancing.length ? `${plural(advancing.length, "objetivo avançando", "objetivos avançando")}: ${name} já precisa de menos apoio.`
        : reviewed.length ? `${plural(reviewed.length, "objetivo revisado", "objetivos revisados")} pela equipe.`
          : entries.length ? "Com mais registros, a tendência de cada objetivo aparece no resumo." : null,
      action: { label: "Ver a evolução", href: `${path}/linha-do-tempo` },
    },
  ], preferred);

  // O que a história já mostra: só números que vêm dos registros de aula.
  const withEntries = allObjectives.filter((objective) => objective.status !== "em_revisao" && entries.some((entry) => entry.objectiveId === objective.id));
  const impact: ImpactItem[] = [];
  if (entries.length) {
    const full = entries.filter((entry) => entry.participation === "total").length;
    impact.push({ label: "Aulas registradas", value: String(entries.length), hint: `A última em ${formatDate(lastEntry!.date)}. Colunas: aulas por semana, nas últimas 8.`, viz: { kind: "weekly", points: weeklyCounts(entries.map((entry) => entry.date), 8) } });
    impact.push({
      label: "Participação plena", value: `${Math.round((full / entries.length) * 100)}%`, hint: `${full} de ${entries.length} aulas. Cada marca é uma aula, da mais antiga à mais recente.`,
      viz: { kind: "dots", items: entries.slice(-16).map((entry) => ({ key: entry.id, title: `${formatDate(entry.date)}: ${PARTICIPATION_TEXT[entry.participation] ?? entry.participation}`, tone: PARTICIPATION_TONE[entry.participation] ?? "neutral" })) },
    });
  }
  if (withEntries.length) {
    const start = average(withEntries.map((objective) => objective.currentSupport));
    const now = average(withEntries.map((objective) => entries.findLast((entry) => entry.objectiveId === objective.id)!.supportLevel));
    const levels = supportSeries(entries.filter((entry) => withEntries.some((objective) => objective.id === entry.objectiveId))).map((point) => point.value);
    const { trend, delta } = supportTrend(levels);
    impact.push({ label: "Nível de apoio", value: `${decimal(start)} → ${decimal(now)}`, hint: "De 5 (apoio físico total) a 0 (independente). Na linha, subir é precisar de menos apoio.", viz: { kind: "support", values: levels.slice(-20), delta, trend } });
  }
  const note = s.familyNotes[0];

  return finish({
    ...base,
    title: `Sua história com ${name}`,
    intro: `${s.gradeYear} · ${s.className}. Cada capítulo mostra o que já foi feito e o próximo passo. Você pode abrir qualquer etapa quando precisar.`,
    focus: { id: s.id, name: s.name, options: students.map((student) => ({ id: student.id, name: student.name })) },
    chapters,
    impact,
    strategies: countItems(entries.map((entry) => entry.whatWorked), 6),
    quote: note ? { text: note.note, source: `${note.author}, ${formatDate(note.date)}` } : null,
    milestones,
  });
}

// Conquistas da equipe com os estudantes acompanhados, com a data da primeira vez.
async function teamMilestones(ids: string[]): Promise<Milestone[]> {
  const scope = { studentId: { in: ids } };
  const [caseStudy, objective, applied, tenth, achieved, family, report] = await Promise.all([
    prisma.caseStudy.findFirst({ where: { ...scope, status: "concluido" }, orderBy: { concludedAt: "asc" }, select: { concludedAt: true, updatedAt: true } }),
    prisma.objective.findFirst({ where: { plan: scope }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.diaryEntry.findFirst({ where: { ...scope, activityId: { not: null } }, orderBy: { date: "asc" }, select: { date: true } }),
    prisma.diaryEntry.findFirst({ where: scope, orderBy: { date: "asc" }, skip: 9, select: { date: true } }),
    prisma.timelineEvent.findFirst({ where: { ...scope, type: "conquista", title: "Objetivo alcançado" }, orderBy: { date: "asc" }, select: { date: true } }),
    prisma.familyNote.findFirst({ where: scope, orderBy: { date: "asc" }, select: { date: true } }),
    prisma.intersectorReport.findFirst({ where: scope, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const milestone = (key: string, title: string, description: string, date: Date | null | undefined): Milestone => ({ key, title, description, achieved: !!date, date: date ?? null });
  return [
    milestone("estudo", "Primeiro estudo de caso", "A história de um estudante foi ouvida e sintetizada.", caseStudy ? caseStudy.concludedAt ?? caseStudy.updatedAt : null),
    milestone("objetivo", "Primeiro objetivo combinado", "Um objetivo observável entrou no plano.", objective?.createdAt),
    milestone("aula", "Primeira atividade usada em aula", "Uma atividade preparada virou aula registrada.", applied?.date),
    milestone("dez", "10 aulas registradas", "A memória do acompanhamento ganhou corpo.", tenth?.date),
    milestone("alcancado", "Primeiro objetivo alcançado", "As evidências mostraram a conquista.", achieved?.date),
    milestone("familia", "Família participando", "A família contou uma conquista de casa.", family?.date),
    milestone("saude", "Rede de apoio conectada", "A equipe de saúde enviou orientações à escola.", report?.createdAt),
  ];
}

// ---------------------------------------------------------------------------
// Coordenação e gestão escolar: a história da escola.
// ---------------------------------------------------------------------------
async function schoolJourney(user: SessionUser, marks: Marks): Promise<Journey> {
  const now = new Date();
  const where = { status: "ativo", ...(user.schoolId ? { schoolId: user.schoolId } : {}) };
  const [school, students] = await Promise.all([
    user.schoolId ? prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }) : null,
    prisma.student.findMany({
      where,
      select: {
        id: true,
        plans: { where: { status: "ativo" }, select: { reviewDate: true, objectives: { where: { status: "ativo" }, select: { id: true }, take: 1 } } },
        diaryEntries: { where: { date: { gte: new Date(now.getTime() - 30 * DAY_MS) } }, select: { id: true }, take: 1 },
        familyNotes: { select: { id: true }, take: 1 },
        intersectorReports: { select: { id: true }, take: 1 },
      },
    }),
  ]);
  const total = students.length;
  const withPlan = students.filter((student) => student.plans.some((plan) => plan.objectives.length)).length;
  const plans = students.flatMap((student) => student.plans);
  const onTime = plans.filter((plan) => plan.reviewDate >= now).length;
  const recorded = students.filter((student) => student.diaryEntries.length).length;
  const connected = students.filter((student) => student.familyNotes.length || student.intersectorReports.length).length;
  const nextDate = upcomingEvents(todayInBrazil(now))[0];
  const place = school?.name ?? "sua escola";

  const chapters = withStatus([
    {
      key: "painel", tone: "sky", title: "Conhecer o panorama da escola",
      story: "O Painel de indicadores reúne a jornada de cada estudante, os avisos de acompanhamento e o que a equipe registrou. É o ponto de partida da conversa com a equipe.",
      why: "Olhar o conjunto ajuda a decidir onde apoiar primeiro.",
      done: marks.has("painel"), date: marks.get("painel") ?? null,
      evidence: marks.has("painel") ? "Você já abriu o painel." : null,
      action: { label: "Abrir o painel", href: "/painel" },
    },
    {
      key: "plano", tone: "peach", title: "Garantir um plano para cada estudante",
      story: "Todo estudante do AEE precisa de um plano individual com pelo menos um objetivo. Na tabela de estudantes do painel, o botão ↗ leva direto ao próximo passo de cada um.",
      why: "Sem objetivo combinado, não há como acompanhar o avanço.",
      done: total > 0 && withPlan === total, progress: ratio(withPlan, total),
      evidence: `${withPlan} de ${plural(total, "estudante", "estudantes")} com plano e objetivo.`,
      action: { label: "Ver quem ainda não tem plano", href: "/painel#atencao" },
    },
    {
      key: "revisao", tone: "rose", title: "Manter os planos revisados no prazo",
      story: "Cada plano tem uma data de revisão. Combine com a professora do AEE e a sala comum uma conversa rápida a partir dos registros.",
      why: "Revisar no tempo certo evita insistir no que não funciona.",
      done: plans.length > 0 && onTime === plans.length, progress: plans.length ? ratio(onTime, plans.length) : null,
      evidence: plans.length ? `${onTime} de ${plural(plans.length, "plano", "planos")} dentro do prazo de revisão.` : "Nenhum plano ativo ainda.",
      action: { label: "Ver revisões vencidas", href: "/painel#atencao" },
    },
    {
      key: "registros", tone: "sage", title: "Apoiar o registro das aulas",
      story: "Os registros em três toques mostram o que funciona. Quando um estudante fica sem registro, vale perguntar à equipe do que ela precisa.",
      why: "Queda no ritmo de registros costuma anteceder o abandono do acompanhamento.",
      done: total > 0 && recorded === total, progress: ratio(recorded, total),
      evidence: `${recorded} de ${plural(total, "estudante", "estudantes")} com aula registrada nos últimos 30 dias.`,
      action: { label: "Ver o ritmo de registros", href: "/painel#aulas" },
    },
    {
      key: "rede", tone: "teal", title: "Aproximar a família e a saúde",
      story: "Famílias contam conquistas de casa e terapeutas enviam orientações funcionais. Tudo aparece no resumo do estudante para a equipe.",
      why: "O que acontece fora da escola completa o que a equipe vê na sala.",
      done: total > 0 && connected === total, progress: ratio(connected, total),
      evidence: `${connected} de ${plural(total, "estudante", "estudantes")} com participação da família ou da saúde.`,
      action: { label: "Ver família e rede de apoio", href: "/painel#familia" },
    },
    {
      key: "calendario", tone: "lilac", title: "Celebrar as datas inclusivas",
      story: "O calendário inclusivo traz datas como o Dia do Autismo e o Dia Nacional da Libras, com ideias de atividade para a turma toda.",
      why: "Datas comemorativas aproximam a comunidade escolar do tema da inclusão.",
      done: marks.has("calendario"), date: marks.get("calendario") ?? null,
      evidence: nextDate ? `Próxima data: ${nextDate.entry.title}.` : null,
      action: { label: "Abrir o calendário", href: "/calendario" },
    },
  ]);

  const ids = students.map((student) => student.id);
  return finish({
    kind: "escola", character: "planning", welcomed: marks.has("boas_vindas"),
    title: `A história de ${place}`,
    intro: "Os capítulos acompanham o trabalho da coordenação: conhecer o panorama, garantir planos e revisões, apoiar os registros e aproximar família e saúde.",
    welcome: {
      headline: `Boas-vindas, ${firstName(user.name)}!`,
      text: `Aqui você acompanha a história de ${place}: quem precisa de atenção, planos em dia, aulas registradas e família e saúde por perto.`,
    },
    focus: null, chapters,
    impactTitle: "A escola em números",
    impact: [
      { label: "Estudantes acompanhados", value: String(total) },
      { label: "Com plano e objetivo", value: total ? `${Math.round((withPlan / total) * 100)}%` : "—", hint: `${withPlan} de ${total} estudantes`, viz: { kind: "ring", pct: percentOf(withPlan, total), tone: "good" } },
      { label: "Com aula registrada", value: String(recorded), hint: `de ${total} estudantes, nos últimos 30 dias`, viz: { kind: "ring", pct: percentOf(recorded, total), tone: "info" } },
    ],
    strategies: [], quote: null,
    milestones: ids.length ? await teamMilestones(ids) : [],
  });
}

// ---------------------------------------------------------------------------
// Secretaria de Educação: a história da rede.
// ---------------------------------------------------------------------------
async function networkJourney(user: SessionUser, marks: Marks): Promise<Journey> {
  const [schools, students, resources] = await Promise.all([
    prisma.school.findMany({ select: { id: true, _count: { select: { classes: true } } } }),
    prisma.student.findMany({
      where: { status: "ativo" },
      select: {
        id: true, accessibilityNotes: true,
        profile: { select: { expressiveChannel: true } },
        plans: { where: { status: "ativo" }, select: { objectives: { where: { status: "ativo" }, select: { id: true }, take: 1 } } },
      },
    }),
    prisma.resource.aggregate({ _count: { _all: true }, _sum: { timesUsed: true } }),
  ]);
  const withClasses = schools.filter((school) => school._count.classes > 0).length;
  const total = students.length;
  const withPlan = students.filter((student) => student.plans.some((plan) => plan.objectives.length)).length;
  const caa = students.filter((student) => student.profile && (student.profile.expressiveChannel.startsWith("caa") || student.profile.expressiveChannel === "olhar_acionador"));
  const caaReady = caa.filter((student) => student.accessibilityNotes?.trim()).length;
  const nextDate = upcomingEvents(todayInBrazil(new Date()))[0];

  const chapters = withStatus([
    {
      key: "painel", tone: "sky", title: "Conhecer a rede no painel",
      story: "O Painel de indicadores mostra a rede inteira ou uma escola: jornada dos estudantes, avisos, aulas registradas, uso da IA e acessos aos dados.",
      why: "Dados agregados orientam formação, compra de recursos e apoio às escolas.",
      done: marks.has("painel"), date: marks.get("painel") ?? null,
      evidence: marks.has("painel") ? "Você já abriu o painel." : null,
      action: { label: "Abrir o painel", href: "/painel" },
    },
    {
      key: "cadastros", tone: "sage", title: "Organizar escolas e turmas",
      story: "Com as escolas e turmas cadastradas, o cadastro de estudantes fica mais rápido e o planejamento por turma funciona.",
      why: "Cadastros organizados evitam estudantes duplicados ou fora da turma certa.",
      done: schools.length > 0 && withClasses === schools.length, progress: ratio(withClasses, schools.length),
      evidence: `${withClasses} de ${plural(schools.length, "escola", "escolas")} com turmas cadastradas.`,
      action: { label: "Abrir escolas e turmas", href: "/cadastros" },
    },
    {
      key: "plano", tone: "peach", title: "Garantir um plano para cada estudante",
      story: "Todo estudante do AEE precisa de um plano individual com objetivo. No painel, filtre por escola para ver onde a equipe precisa de apoio.",
      why: "O plano é a base para medir o avanço sem depender de nota.",
      done: total > 0 && withPlan === total, progress: ratio(withPlan, total),
      evidence: `${withPlan} de ${plural(total, "estudante", "estudantes")} da rede com plano e objetivo.`,
      action: { label: "Ver no painel", href: "/painel#atencao" },
    },
    {
      key: "caa", tone: "rose", title: "Garantir recursos de comunicação",
      story: "Estudantes que se comunicam por comunicação alternativa ou acionador precisam de recursos registrados. O painel aponta quantos ainda faltam.",
      why: "Sem o recurso certo, o estudante fica sem voz na aula.",
      done: caa.length === caaReady, progress: caa.length ? ratio(caaReady, caa.length) : null,
      evidence: caa.length ? `${caaReady} de ${plural(caa.length, "estudante", "estudantes")} com comunicação alternativa têm recursos registrados.` : "Nenhum estudante com comunicação alternativa registrado.",
      action: { label: "Ver o perfil dos estudantes", href: "/painel#perfil" },
    },
    {
      key: "recursos", tone: "teal", title: "Fortalecer o banco de práticas",
      story: "O banco municipal reúne atividades e materiais com evidência de uso. Cada resultado registrado ajuda outras escolas a escolher.",
      why: "Boas práticas de uma escola podem servir à rede inteira.",
      done: marks.has("recursos"), date: marks.get("recursos") ?? null,
      evidence: `${plural(resources._count._all, "recurso", "recursos")} e ${plural(resources._sum.timesUsed ?? 0, "uso registrado", "usos registrados")}.`,
      action: { label: "Abrir o banco de recursos", href: "/recursos" },
    },
    {
      key: "calendario", tone: "lilac", title: "Celebrar as datas inclusivas",
      story: "O calendário inclusivo ajuda a rede a planejar campanhas e atividades nas datas do público do AEE.",
      why: "Campanhas na rede reduzem barreiras atitudinais.",
      done: marks.has("calendario"), date: marks.get("calendario") ?? null,
      evidence: nextDate ? `Próxima data: ${nextDate.entry.title}.` : null,
      action: { label: "Abrir o calendário", href: "/calendario" },
    },
  ]);

  return finish({
    kind: "rede", character: "ideas", welcomed: marks.has("boas_vindas"),
    title: "A história da rede",
    intro: "Os capítulos acompanham o trabalho da Secretaria: conhecer a rede, organizar os cadastros, garantir planos e recursos e fortalecer as boas práticas.",
    welcome: {
      headline: `Boas-vindas, ${firstName(user.name)}!`,
      text: "Aqui você acompanha a história da rede municipal: onde as escolas precisam de apoio, que recursos faltam e quais práticas funcionam.",
    },
    focus: null, chapters,
    impactTitle: "A rede em números",
    impact: [
      { label: "Escolas", value: String(schools.length) },
      { label: "Estudantes acompanhados", value: String(total) },
      { label: "Com plano e objetivo", value: total ? `${Math.round((withPlan / total) * 100)}%` : "—", hint: `${withPlan} de ${total} estudantes`, viz: { kind: "ring", pct: percentOf(withPlan, total), tone: "good" } },
    ],
    strategies: [], quote: null,
    milestones: total ? await teamMilestones(students.map((student) => student.id)) : [],
  });
}

// ---------------------------------------------------------------------------
// Família: acompanhar, fazer em casa e contar conquistas.
// ---------------------------------------------------------------------------
async function familyJourney(user: SessionUser, marks: Marks): Promise<Journey> {
  const welcomed = marks.has("boas_vindas");
  if (!user.studentIds.length) {
    return finish({
      kind: "familia", character: "care", welcomed, title: "Sua história com a escola",
      intro: "Seu acesso ainda precisa ser vinculado a um estudante. Peça à equipe da escola para conferir o cadastro.",
      welcome: { headline: `Boas-vindas, ${firstName(user.name)}!`, text: "Assim que o acesso for vinculado, você acompanha aqui o que a escola trabalha." },
      focus: null, chapters: [], impactTitle: "", impact: [], strategies: [], quote: null, milestones: [],
    });
  }
  const s = await prisma.student.findUniqueOrThrow({
    where: { id: user.studentIds[0] },
    include: {
      plans: { where: { status: "ativo" }, include: { objectives: { where: { status: "ativo" } } } },
      activities: { where: { context: "casa", status: { in: ["aceita", "aplicada"] } }, select: { id: true } },
      familyNotes: { orderBy: { date: "asc" }, select: { note: true, date: true } },
      timeline: { where: { type: "conquista" }, orderBy: { date: "asc" }, select: { title: true, date: true } },
      accessLogs: { where: { role: { notIn: ["familia", "terapeuta", "sistema"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const name = firstName(s.name);
  const path = `/familia/${s.id}`;
  const objectives = s.plans.flatMap((plan) => plan.objectives);
  const homeDone = s.familyNotes.filter((note) => isHomeActivityNote(note.note));
  const stories = s.familyNotes.filter((note) => !isHomeActivityNote(note.note));

  const chapters = withStatus([
    {
      key: "conhecer", tone: "sky", title: `Saber o que a escola trabalha com ${name}`,
      story: `Na página de ${name}, você vê os objetivos combinados pela escola, escritos em linguagem do dia a dia.`,
      why: "Quando a família conhece o objetivo, consegue reforçar em casa.",
      done: marks.has("familia_inicio"), date: marks.get("familia_inicio") ?? null,
      evidence: objectives.length ? `A escola está trabalhando ${plural(objectives.length, "objetivo", "objetivos")} com ${name}.` : "A escola ainda está montando o plano.",
      action: { label: "Ver o que a escola trabalha", href: `${path}#plano` },
    },
    {
      key: "casa", tone: "teal", title: "Fazer uma atividade em casa",
      story: s.activities.length
        ? "A escola preparou atividades curtas, com objetos que vocês já têm em casa. Depois de fazer, toque em “Fizemos esta atividade” para a escola saber."
        : "Quando a escola enviar uma atividade para casa, ela aparece na página do acompanhamento. Depois de fazer, é só avisar a escola.",
      why: "A mesma aprendizagem em casa e na escola se fortalece mais rápido.",
      done: homeDone.length > 0, date: homeDone[0]?.date ?? null, waiting: s.activities.length === 0,
      evidence: homeDone.length ? `${plural(homeDone.length, "atividade feita", "atividades feitas")} em casa.` : s.activities.length ? `${plural(s.activities.length, "atividade disponível", "atividades disponíveis")}.` : null,
      action: { label: "Ver atividades para casa", href: `${path}#casa` },
    },
    {
      key: "conquista", tone: "sage", title: "Contar uma conquista de casa",
      story: `Algumas aprendizagens aparecem primeiro em casa. Conte para a escola o que ${name} conseguiu fazer e quem viu.`,
      why: "A equipe usa o que a família observa para planejar as próximas aulas.",
      done: stories.length > 0, date: stories[0]?.date ?? null,
      evidence: stories.length ? `Última conquista contada: “${stories.at(-1)!.note}”` : null,
      action: { label: "Contar uma conquista", href: `${path}#conquista` },
    },
  ]);

  const lastAccess = s.accessLogs[0];
  return finish({
    kind: "familia", character: "care", welcomed,
    title: `Sua história com ${name}`,
    intro: "Escola e família caminhando juntas. Cada capítulo mostra o que você já fez e o que pode fazer em seguida.",
    welcome: {
      headline: `Boas-vindas, ${firstName(user.name)}!`,
      text: `Aqui você acompanha o que a escola trabalha com ${name}, faz atividades em casa e conta as conquistas que vê no dia a dia.`,
    },
    focus: null, chapters,
    impactTitle: "O que já aconteceu",
    impact: [
      { label: "Objetivos em andamento", value: String(objectives.length) },
      { label: "Conquistas registradas pela escola", value: String(s.timeline.length), hint: s.timeline.at(-1) ? `A última em ${formatDate(s.timeline.at(-1)!.date)}` : undefined },
      { label: "Conquistas contadas pela família", value: String(stories.length) },
    ],
    strategies: [],
    quote: lastAccess ? { text: `A equipe da escola consultou o acompanhamento de ${name} em ${formatDate(lastAccess.createdAt)}.`, source: "Quem acessou os dados fica registrado na página do acompanhamento." } : null,
    milestones: [
      { key: "plano", title: "Plano combinado", description: `A escola definiu o primeiro objetivo de ${name}.`, achieved: objectives.length > 0, date: s.plans[0]?.createdAt ?? null },
      { key: "casa", title: "Primeira atividade em casa", description: "Vocês fizeram uma atividade enviada pela escola.", achieved: homeDone.length > 0, date: homeDone[0]?.date ?? null },
      { key: "conquista", title: "Primeira conquista contada", description: "A escola soube de um avanço de casa.", achieved: stories.length > 0, date: stories[0]?.date ?? null },
      { key: "escola", title: "Conquista na escola", description: "A escola registrou um objetivo alcançado.", achieved: s.timeline.length > 0, date: s.timeline[0]?.date ?? null },
    ],
  });
}

// ---------------------------------------------------------------------------
// Terapeuta: orientações funcionais que chegam à escola.
// ---------------------------------------------------------------------------
async function therapistJourney(user: SessionUser, marks: Marks): Promise<Journey> {
  const welcomed = marks.has("boas_vindas");
  if (!user.studentIds.length) {
    return finish({
      kind: "terapeuta", character: "care", welcomed, title: "Sua história com a escola",
      intro: "Seu acesso ainda precisa ser vinculado a um estudante. Peça à equipe da escola para conferir o cadastro.",
      welcome: { headline: `Boas-vindas, ${firstName(user.name)}!`, text: "Assim que o acesso for vinculado, você compartilha aqui orientações com a escola." },
      focus: null, chapters: [], impactTitle: "", impact: [], strategies: [], quote: null, milestones: [],
    });
  }
  const s = await prisma.student.findUniqueOrThrow({
    where: { id: user.studentIds[0] },
    include: {
      profile: { select: { expressiveChannel: true, interests: true } },
      intersectorReports: { orderBy: { createdAt: "asc" }, select: { createdAt: true } },
    },
  });
  const name = firstName(s.name);
  const reports = s.intersectorReports;
  const last = reports.at(-1);
  // A escola recebeu: alguém da equipe abriu o resumo do estudante, onde as
  // orientações aparecem, depois do último relatório.
  const seen = last ? await prisma.accessLog.findFirst({
    where: { studentId: s.id, detail: { in: SUMMARY_VIEW_DETAILS }, role: { notIn: ["familia", "terapeuta", "sistema"] }, createdAt: { gt: last.createdAt } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  }) : null;
  const interests = parseJson<string[]>(s.profile?.interests, []);

  const chapters = withStatus([
    {
      key: "conhecer", tone: "sky", title: `Conhecer ${name} na escola`,
      story: `Você vê o que a escola registrou sobre a comunicação e os interesses de ${name}. Notas, diário e dados administrativos ficam com a escola.`,
      why: "Partir do que a escola já sabe evita repetir orientações.",
      done: marks.has("terapeuta_inicio"), date: marks.get("terapeuta_inicio") ?? null,
      evidence: s.profile ? `Comunicação: ${CHANNELS[s.profile.expressiveChannel] ?? s.profile.expressiveChannel}${interests.length ? `. Gosta de ${listText(interests.slice(0, 3).map((item) => item.toLowerCase()))}` : ""}.` : "A escola ainda não preencheu o perfil.",
      action: { label: "Ver o estudante", href: "/terapeuta" },
    },
    {
      key: "orientar", tone: "teal", title: "Enviar orientações para a escola",
      story: "Marque as formas de comunicação, os recursos e as estratégias que ajudam na escola. Só entram informações funcionais: o prontuário clínico fica no sistema de saúde.",
      why: "Orientações práticas chegam à sala comum e ao AEE no resumo do estudante.",
      done: reports.length > 0, date: reports[0]?.createdAt ?? null,
      evidence: last ? `Último relatório enviado em ${formatDate(last.createdAt)}.` : null,
      action: { label: "Escrever orientações", href: "/terapeuta#novo-relatorio" },
    },
    {
      key: "recebido", tone: "sage", title: "Saber que a escola recebeu",
      story: `Quando a equipe abre o acompanhamento de ${name}, suas orientações estão lá, no resumo do estudante.`,
      why: "Saber que a orientação chegou fecha o ciclo entre saúde e escola.",
      done: !!seen, date: seen?.createdAt ?? null, waiting: !!last && !seen,
      evidence: seen ? `A equipe abriu o acompanhamento em ${formatDate(seen.createdAt)}, depois do seu último relatório.` : last ? "A equipe ainda não abriu o acompanhamento desde o seu último relatório." : null,
      action: { label: "Ver relatórios enviados", href: "/terapeuta#relatorios" },
    },
    {
      key: "atualizar", tone: "lilac", title: "Atualizar as orientações",
      story: "Quando algo mudar na terapia, envie um novo relatório. A equipe vê sempre o mais recente.",
      why: "Orientações atualizadas acompanham o momento do estudante.",
      done: reports.length >= 2, date: reports[1]?.createdAt ?? null,
      evidence: reports.length >= 2 ? `${plural(reports.length, "relatório enviado", "relatórios enviados")}.` : null,
      action: { label: "Enviar um novo relatório", href: "/terapeuta#novo-relatorio" },
    },
  ]);

  return finish({
    kind: "terapeuta", character: "care", welcomed,
    title: `Sua história com ${name}`,
    intro: "Saúde e escola trabalhando juntas. Cada capítulo mostra o que já foi feito e o que pode ser feito em seguida.",
    welcome: {
      headline: `Boas-vindas, ${firstName(user.name)}!`,
      text: `Aqui você compartilha orientações funcionais com a escola de ${name} e vê quando elas chegam à equipe.`,
    },
    focus: null, chapters,
    impactTitle: "O que já aconteceu",
    impact: [
      { label: "Relatórios enviados", value: String(reports.length), hint: last ? `O último em ${formatDate(last.createdAt)}` : undefined },
      { label: "A escola recebeu", value: seen ? "Sim" : "Ainda não", hint: seen ? formatDate(seen.createdAt) : undefined },
    ],
    strategies: [], quote: null,
    milestones: [
      { key: "primeiro", title: "Primeira orientação", description: "A escola recebeu suas primeiras orientações.", achieved: reports.length > 0, date: reports[0]?.createdAt ?? null },
      { key: "recebido", title: "Orientação lida", description: "A equipe abriu o acompanhamento depois do relatório.", achieved: !!seen, date: seen?.createdAt ?? null },
      { key: "atualizado", title: "Orientações atualizadas", description: "Você enviou um novo relatório.", achieved: reports.length >= 2, date: reports[1]?.createdAt ?? null },
    ],
  });
}
