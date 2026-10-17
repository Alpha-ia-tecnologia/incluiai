import type { DiaryEntry, FunctionalProfile, Objective, Student } from "@prisma/client";
import { prisma } from "../prisma";
import { parseJson, ageFrom } from "../format";
import { BARRIERS, CHANNELS, DIMENSIONS, SENSORY_LABELS, SENSORY_VALUES, STAGES, supportInfo } from "../scale";
import { CASE_STUDY_FIELDS, parseCaseStudy } from "../case-study";
import { splitItems } from "../form-options";
import { strategiesThatWorked } from "../insights";

// Monta o contexto enviado aos agentes. Minimização de dados (LGPD): não
// enviamos nome, data de nascimento, responsável nem escola; do estudo de
// caso ficam de fora as informações clínicas e a composição familiar.

const EXCLUDED_CASE_FIELDS = new Set(["diagnostico", "saude", "acompanhamentos", "moraCom", "entrevistados"]);

const SUPPORT_FIELDS: [keyof FunctionalProfile, string][] = [
  ["readingSupport", "Leitura"], ["writingSupport", "Escrita"], ["mathSupport", "Matemática"],
  ["peerInteraction", "Interação com colegas"], ["adultInteraction", "Interação com adultos"], ["groupWork", "Trabalho em grupo"],
  ["feeding", "Alimentação"], ["hygiene", "Higiene"], ["mobility", "Deslocamento"], ["organization", "Organização de materiais"],
  ["fineMotor", "Movimentos finos"], ["grossMotor", "Movimentos amplos"],
];

const supportText = (level: number) => {
  const info = supportInfo(level);
  return `${info.code} (${info.description.toLowerCase()})`;
};

function studentLine(student: Student) {
  return `Estudante de ${ageFrom(student.birthDate)} anos, ${student.gradeYear}, ${STAGES[student.stage] ?? student.stage}.${student.hasAEE ? ` Frequenta o AEE (${student.aeeFrequency ?? "frequência não informada"}).` : " Ainda não frequenta o AEE."}${student.supportProfessional ? " Conta com profissional de apoio." : ""}`;
}

export function profileText(profile: FunctionalProfile) {
  const sensory = parseJson<Record<string, string>>(profile.sensoryProfile, {});
  const sensoryNotes = Object.entries(sensory)
    .filter(([, value]) => value && value !== "tipica")
    .map(([area, value]) => `${SENSORY_LABELS[area] ?? area}: ${(SENSORY_VALUES[value] ?? value).toLowerCase()}`);
  const list = (value: string) => parseJson<string[]>(value, []).join(", ") || "não informado";
  return [
    `Comunicação: expressa-se por ${CHANNELS[profile.expressiveChannel] ?? profile.expressiveChannel}; compreende melhor por ${CHANNELS[profile.receptiveChannel] ?? profile.receptiveChannel}; compreende comandos de ${profile.commandSteps} etapa(s).`,
    `Níveis de apoio (0 independente a 5 apoio físico total): ${SUPPORT_FIELDS.map(([field, label]) => `${label}: ${supportText(profile[field] as number)}`).join("; ")}.`,
    `Atenção: cerca de ${profile.attentionMinutes} min. Permanece na tarefa por cerca de ${profile.taskToleranceMinutes} min. Melhor turno: ${profile.bestShift === "tarde" ? "tarde" : "manhã"}.`,
    sensoryNotes.length ? `Sensorial: ${sensoryNotes.join("; ")}.` : "Sensorial: sem particularidades registradas.",
    profile.usesWheelchairOrOrthosis ? "Usa cadeira de rodas ou órtese." : "",
    `Situações de desconforto: ${list(profile.triggers)}. Sinais de que precisa de pausa: ${list(profile.earlySigns)}. O que acalma: ${list(profile.calmingStrategies)}.`,
    `Interesses âncora: ${list(profile.interests)}.`,
    `Barreiras: ${parseJson<string[]>(profile.barriers, []).map((item) => BARRIERS[item] ?? item).join(", ") || "não informadas"}.`,
    profile.strengths ? `Pontos fortes: ${profile.strengths}.` : "",
  ].filter(Boolean).join("\n");
}

function caseStudyText(content: string | null | undefined) {
  const study = parseCaseStudy(content);
  return CASE_STUDY_FIELDS
    .filter((field) => !EXCLUDED_CASE_FIELDS.has(field.key) && study[field.key])
    .map((field) => `${field.label}: ${field.type === "multi" ? splitItems(study[field.key]).join(", ") : study[field.key]}`)
    .join("\n");
}

function diaryText(entries: DiaryEntry[]) {
  if (entries.length === 0) return "Ainda não há registros de aula.";
  const recent = entries.slice(-10);
  const average = recent.reduce((sum, entry) => sum + entry.supportLevel, 0) / recent.length;
  const counts = { total: 0, parcial: 0, recusou: 0 } as Record<string, number>;
  for (const entry of recent) counts[entry.participation] = (counts[entry.participation] ?? 0) + 1;
  const worked = strategiesThatWorked(entries);
  const recommendations = [...new Set(recent.flatMap((entry) => splitItems(entry.recommendation)))].slice(-4);
  return [
    `Últimos ${recent.length} registros: participou de toda a atividade ${counts.total}x, de parte ${counts.parcial}x, recusou ${counts.recusou}x. Apoio médio: ${supportText(Math.round(average))}.`,
    worked.length ? `O que funcionou: ${worked.join(", ")}.` : "",
    recommendations.length ? `Recomendações recentes da equipe: ${recommendations.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
}

// Contexto para o plano: estudo de caso + como aprende + registros + objetivos anteriores.
export async function loadPlanContext(studentId: string) {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      profile: true,
      caseStudy: true,
      diaryEntries: { orderBy: { date: "asc" } },
      plans: { include: { objectives: true }, orderBy: { createdAt: "desc" } },
    },
  });
  const previousObjectives = student.plans.flatMap((plan) => plan.objectives).slice(0, 6);
  const sections = [
    studentLine(student),
    student.caseStudy ? `\n## Estudo de caso\n${caseStudyText(student.caseStudy.content)}` : "",
    student.profile ? `\n## Como aprende\n${profileText(student.profile)}` : "",
    `\n## Registros de aula\n${diaryText(student.diaryEntries)}`,
    previousObjectives.length
      ? `\n## Objetivos de planos anteriores\n${previousObjectives.map((objective) => `- ${DIMENSIONS[objective.dimension] ?? objective.dimension}: ${objective.action} (${objective.status === "alcancado" ? "alcançado" : objective.status === "em_revisao" ? "em revisão" : "em andamento"})`).join("\n")}`
      : "",
  ];
  return {
    student,
    text: sections.filter(Boolean).join("\n"),
    hasEnoughData: Boolean(student.caseStudy || student.profile),
  };
}

// Contexto para atividades: objetivo + como aprende + o que já funcionou.
export function activityContextText(input: {
  student: Student;
  profile: FunctionalProfile;
  objective: Objective;
  lessonTopic?: string;
  entries?: DiaryEntry[];
}) {
  const { student, profile, objective, lessonTopic, entries = [] } = input;
  return [
    studentLine(student),
    `\n## Objetivo trabalhado\n${objective.action}, ${objective.condition}, em ${objective.criterion} (${DIMENSIONS[objective.dimension] ?? objective.dimension}).`,
    `Apoio atual: ${supportText(objective.currentSupport)}. Apoio que queremos alcançar: ${supportText(objective.targetSupport)}.`,
    objective.bnccCode ? `Habilidade da BNCC: ${objective.bnccCode}.` : "",
    `\n## Conteúdo da aula da turma\n${lessonTopic?.trim() || "Não informado: escolha um conteúdo comum ao ano escolar."}`,
    `\n## Como aprende\n${profileText(profile)}`,
    `\n## Registros de aula\n${diaryText(entries.filter((entry) => !entry.objectiveId || entry.objectiveId === objective.id))}`,
  ].filter(Boolean).join("\n");
}
