import { BARRIERS, CHANNELS, SENSORY_AREAS, SENSORY_LABELS, SENSORY_VALUES, SHIFTS, SUPPORT_LEVELS } from "./scale.ts";
import { UserError } from "./user-error.ts";
import { parseJson, readList, splitItems, writeList } from "./format.ts";
import { ATTENTION_MINUTES, CALMING_OPTIONS, EARLY_SIGN_OPTIONS, INTEREST_OPTIONS, STRENGTH_OPTIONS, TASK_TOLERANCE_MINUTES, TRIGGER_OPTIONS } from "./form-options.ts";
import { YES_NO, asOptions, optionsOf, type ChatAnswers, type ChatField, type ChatOption } from "./guided-chat.ts";

export const PROFILE_SUPPORT_FIELDS = [
  { key: "readingSupport", label: "Leitura", group: "Aprendizagem" },
  { key: "writingSupport", label: "Escrita", group: "Aprendizagem" },
  { key: "mathSupport", label: "Matemática", group: "Aprendizagem" },
  { key: "peerInteraction", label: "Interação com colegas", group: "Interação" },
  { key: "adultInteraction", label: "Interação com adultos", group: "Interação" },
  { key: "groupWork", label: "Trabalho em grupo", group: "Interação" },
  { key: "organization", label: "Organização", group: "Autonomia" },
  { key: "feeding", label: "Alimentação", group: "Autonomia" },
  { key: "hygiene", label: "Higiene", group: "Autonomia" },
  { key: "mobility", label: "Locomoção", group: "Autonomia" },
  { key: "fineMotor", label: "Coordenação fina", group: "Movimento" },
  { key: "grossMotor", label: "Coordenação ampla", group: "Movimento" },
] as const;
type SupportField = (typeof PROFILE_SUPPORT_FIELDS)[number]["key"];
export const SUPPORT_FIELD_LABEL = Object.fromEntries(PROFILE_SUPPORT_FIELDS.map((field) => [field.key, field.label])) as Record<SupportField, string>;
export const PROFILE_SUPPORT_GROUPS = [...new Set(PROFILE_SUPPORT_FIELDS.map((field) => field.group))].map((title) => ({ title, fields: PROFILE_SUPPORT_FIELDS.filter((field) => field.group === title) }));

export type ProfileData = Record<SupportField, number> & {
  expressiveChannel: string;
  receptiveChannel: string;
  commandSteps: number;
  attentionMinutes: number;
  sensoryProfile: string;
  usesWheelchairOrOrthosis: boolean;
  triggers: string;
  earlySigns: string;
  calmingStrategies: string;
  bestShift: string;
  taskToleranceMinutes: number;
  interests: string;
  barriers: string;
  strengths: string | null;
};

const CHANNEL_FROM_STUDY: Record<string, string> = {
  "Fala com frases curtas": "fala", "Gestos e apontar": "gestos", "Prancha de comunicação (CAA)": "caa_prancha", "PECS": "caa_pecs",
  "Tablet com aplicativo de CAA": "caa_alta_tecnologia", "Libras": "libras", "Olhar e expressões faciais": "olhar_acionador",
  "Vocalizações": "vocalizacoes", "Acionador": "olhar_acionador",
};
const BARRIER_KEY = Object.fromEntries(Object.entries(BARRIERS).map(([key, label]) => [label, key]));

export function profileSuggestionsFromStudy(study: Record<string, string | undefined>) {
  return {
    expressiveChannel: splitItems(study.comunicacaoEscola).map((item) => CHANNEL_FROM_STUDY[item]).find(Boolean) ?? "",
    interests: splitItems(study.interessesCasa).map((item) => item.replace(/,/g, " ")),
    barriers: splitItems(study.barreiras).map((item) => BARRIER_KEY[item] ?? item),
    strengths: study.potencialidades ?? "",
  };
}

const textOf = (value: unknown) => String(value ?? "");
const listOf = (value: unknown) => splitItems(textOf(value), ",");

export function profileFromForm(get: (name: string) => unknown, getAll: (name: string) => unknown[]): ProfileData {
  const interests = listOf(get("interests"));
  if (!interests.length) throw new UserError("Informe ao menos um interesse âncora.");
  const supports = Object.fromEntries(PROFILE_SUPPORT_FIELDS.map(({ key }) => [key, Number(get(key) ?? 0)])) as Record<SupportField, number>;
  if (Object.values(supports).some((value) => !Number.isInteger(value) || value < 0 || value > 5)) {
    throw new UserError("Os níveis de apoio devem estar entre 0 e 5.");
  }
  const sensory = Object.fromEntries(SENSORY_AREAS.map((area) => [area, textOf(get(`sens_${area}`)).trim() || "tipica"]));
  return {
    ...supports,
    expressiveChannel: textOf(get("expressiveChannel") ?? "fala"),
    receptiveChannel: textOf(get("receptiveChannel") ?? "fala"),
    commandSteps: Number(get("commandSteps") ?? 1),
    attentionMinutes: Number(get("attentionMinutes") ?? 10),
    sensoryProfile: JSON.stringify(sensory),
    usesWheelchairOrOrthosis: get("usesWheelchairOrOrthosis") === "on",
    triggers: writeList(listOf(get("triggers"))),
    earlySigns: writeList(listOf(get("earlySigns"))),
    calmingStrategies: writeList(listOf(get("calmingStrategies"))),
    bestShift: textOf(get("bestShift") ?? "manha"),
    taskToleranceMinutes: Number(get("taskToleranceMinutes") ?? 15),
    interests: writeList(interests),
    barriers: writeList(getAll("barriers").map(String)),
    strengths: textOf(get("strengths")).trim() || null,
  };
}

export const PROFILE_SECTIONS = [
  { title: "Comunicação", description: "Como o estudante se expressa e compreende as interações." },
  { title: "Aprendizagem", description: "Apoios necessários para acessar atividades e sustentar a atenção." },
  { title: "Interação", description: "Participação com colegas, adultos e em propostas coletivas." },
  { title: "Autonomia", description: "Apoio nas atividades cotidianas dentro da escola." },
  { title: "Sensorial", description: "Como diferentes estímulos costumam ser percebidos." },
  { title: "Motricidade", description: "Apoio para movimentos finos, globais e mobilidade." },
  { title: "Regulação e ritmo", description: "Sinais, estratégias de regulação e ritmo mais favorável." },
  { title: "Potencialidades", description: "Interesses, talentos e barreiras observadas no contexto escolar." },
];

const SUPPORT_OPTIONS: ChatOption[] = SUPPORT_LEVELS.map((item) => ({ value: String(item.level), code: item.code, label: item.label, description: item.description }));
const CHANNEL_OPTIONS: ChatOption[] = Object.entries(CHANNELS).map(([value, label]) => ({ value, label }));
const SENSORY_HINT: Record<string, string> = {
  hiper: "Percebe o estímulo com muita intensidade",
  hipo: "Pode buscar ou perceber pouco o estímulo",
  tipica: "Resposta esperada para o contexto",
};
const SENSORY_OPTIONS: ChatOption[] = Object.entries(SENSORY_VALUES).map(([value, label]) => ({ value, label, description: SENSORY_HINT[value] }));
const MINUTES = { type: "number", min: 1, max: 120, suffix: "minutos" } as const;
const NOT_SEEN = "Ainda não observado — pular";

const support = (key: SupportField, section: string, question: string): ChatField => ({ key, section, label: SUPPORT_FIELD_LABEL[key], question, input: "choice", options: SUPPORT_OPTIONS, required: true });

export const PROFILE_FIELDS: ChatField[] = [
  { key: "expressiveChannel", section: "Comunicação", label: "Canal expressivo", question: "Como {nome} costuma se expressar?", hint: "Escolha o canal usado na maior parte das situações escolares.", input: "choice", options: CHANNEL_OPTIONS, other: {}, required: true },
  { key: "receptiveChannel", section: "Comunicação", label: "Canal receptivo", question: "Como {nome} compreende melhor as orientações?", input: "choice", options: CHANNEL_OPTIONS, other: {}, required: true },
  { key: "commandSteps", section: "Comunicação", label: "Comandos compreendidos", question: "Comandos de quantas etapas costuma compreender?", hint: "Exemplo de 2 etapas: pegue o caderno e abra na página indicada.", input: "choice", options: [1, 2, 3].map((steps) => ({ value: String(steps), label: `${steps} ${steps === 1 ? "etapa" : "etapas"}` })), required: true },
  support("readingSupport", "Aprendizagem", "Quanto apoio precisa em atividades de leitura?"),
  support("writingSupport", "Aprendizagem", "Quanto apoio precisa em atividades de escrita?"),
  support("mathSupport", "Aprendizagem", "Quanto apoio precisa em atividades de matemática?"),
  { key: "attentionMinutes", section: "Aprendizagem", label: "Atenção sustentada", question: "Por quanto tempo costuma sustentar a atenção em uma atividade?", hint: "Considere uma atividade adequada, com os apoios habituais.", input: "choice", options: asOptions(ATTENTION_MINUTES), other: MINUTES, required: true },
  support("peerInteraction", "Interação", "Quanto apoio precisa para interagir com os colegas?"),
  support("adultInteraction", "Interação", "Quanto apoio precisa para interagir com adultos?"),
  support("groupWork", "Interação", "Quanto apoio precisa para participar de trabalhos em grupo?"),
  support("feeding", "Autonomia", "Quanto apoio precisa durante a alimentação?"),
  support("hygiene", "Autonomia", "Quanto apoio precisa nos cuidados de higiene?"),
  support("mobility", "Autonomia", "Quanto apoio precisa para se deslocar pela escola?"),
  support("organization", "Autonomia", "Quanto apoio precisa para organizar materiais e acompanhar transições?"),
  ...SENSORY_AREAS.map((area): ChatField => ({
    key: `sens_${area}`, section: "Sensorial", label: `Sensibilidade ${SENSORY_LABELS[area].toLowerCase()}`,
    question: `Como é a resposta ${SENSORY_LABELS[area].toLowerCase()} de {nome}?`, hint: "Considere situações observadas em diferentes momentos da rotina.",
    input: "choice", options: SENSORY_OPTIONS,
  })),
  support("fineMotor", "Motricidade", "Quanto apoio precisa em movimentos como escrever, recortar ou encaixar?"),
  support("grossMotor", "Motricidade", "Quanto apoio precisa em movimentos amplos e atividades corporais?"),
  { key: "usesWheelchairOrOrthosis", section: "Motricidade", label: "Cadeira de rodas ou órtese", question: "Usa cadeira de rodas ou órtese?", input: "choice", options: YES_NO, checkbox: true },
  { key: "triggers", section: "Regulação e ritmo", label: "Situações de desregulação", question: "Quais situações costumam gerar desconforto ou desregulação?", hint: "Marque as que se aplicam ou escreva em Outro. Se ainda não observou, pode pular.", input: "chips", options: asOptions(TRIGGER_OPTIONS), separator: ",", other: { placeholder: "Ex.: cheiro de tinta" }, skip: NOT_SEEN },
  { key: "earlySigns", section: "Regulação e ritmo", label: "Sinais precoces", question: "Quais sinais aparecem antes de um desconforto maior?", input: "chips", options: asOptions(EARLY_SIGN_OPTIONS), separator: ",", other: { placeholder: "Ex.: esfrega os olhos" }, skip: NOT_SEEN },
  { key: "calmingStrategies", section: "Regulação e ritmo", label: "Estratégias que ajudam", question: "O que costuma ajudar na regulação?", input: "chips", options: asOptions(CALMING_OPTIONS), separator: ",", other: { placeholder: "Ex.: balanço no parquinho" }, skip: NOT_SEEN },
  { key: "bestShift", section: "Regulação e ritmo", label: "Melhor turno", question: "Em qual turno demonstra melhor disponibilidade para aprender?", input: "choice", options: ["manha", "tarde"].map((value) => ({ value, label: SHIFTS[value] })), required: true },
  { key: "taskToleranceMinutes", section: "Regulação e ritmo", label: "Tolerância à tarefa", question: "Por quanto tempo costuma permanecer em uma mesma tarefa?", input: "choice", options: asOptions(TASK_TOLERANCE_MINUTES), other: MINUTES, required: true },
  { key: "interests", section: "Potencialidades", label: "Interesses âncora", question: "Quais são os principais temas ou atividades que despertam interesse?", hint: "Escolha de 3 a 5 interesses. Eles ajudam a personalizar as atividades.", input: "chips", options: asOptions(INTEREST_OPTIONS), separator: ",", other: { placeholder: "Ex.: vulcões" }, required: true },
  { key: "barriers", section: "Potencialidades", label: "Barreiras ativas", question: "Quais barreiras estão presentes no contexto escolar?", hint: "Você pode marcar mais de uma ou confirmar sem selecionar nenhuma.", input: "chips", options: Object.entries(BARRIERS).map(([value, label]) => ({ value, label })), separator: ",", submit: "multiple", other: {}, empty: "Nenhuma barreira selecionada" },
  { key: "strengths", section: "Potencialidades", label: "Potencialidades", question: "Para concluir: quais talentos, potencialidades e estratégias funcionam bem?", input: "chips", options: asOptions(STRENGTH_OPTIONS), separator: ";", other: { placeholder: "Ex.: monta quebra-cabeças de 50 peças" }, skip: NOT_SEEN },
];
const PROFILE_FIELD = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, field])) as Record<string, ChatField>;
export const profileOptions = (key: string): ChatOption[] => [...optionsOf(PROFILE_FIELD[key], {}, undefined)];
export function profileList(key: string): { separator: "," | ";"; submit: "joined" | "multiple" } {
  const field = PROFILE_FIELD[key];
  return field.input === "chips" ? { separator: field.separator ?? ";", submit: field.submit ?? "joined" } : { separator: ";", submit: "joined" };
}
export function profileMinutes(key: string) {
  const field = PROFILE_FIELD[key];
  return field.input === "choice" && field.other ? { otherType: field.other.type, otherMin: field.other.min, otherMax: field.other.max } : {};
}

export function profileAnswers(profile: ProfileData): ChatAnswers {
  const sensory = parseJson<Record<string, string>>(profile.sensoryProfile, {});
  return {
    ...Object.fromEntries(PROFILE_SUPPORT_FIELDS.map(({ key }) => [key, String(profile[key])])),
    expressiveChannel: profile.expressiveChannel,
    receptiveChannel: profile.receptiveChannel,
    commandSteps: String(profile.commandSteps),
    attentionMinutes: String(profile.attentionMinutes),
    ...Object.fromEntries(SENSORY_AREAS.map((area) => [`sens_${area}`, sensory[area] ?? "tipica"])),
    usesWheelchairOrOrthosis: profile.usesWheelchairOrOrthosis ? "sim" : "nao",
    triggers: readList(profile.triggers),
    earlySigns: readList(profile.earlySigns),
    calmingStrategies: readList(profile.calmingStrategies),
    bestShift: profile.bestShift,
    taskToleranceMinutes: String(profile.taskToleranceMinutes),
    interests: readList(profile.interests),
    barriers: readList(profile.barriers),
    strengths: splitItems(profile.strengths),
  };
}
