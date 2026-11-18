import { BARRIERS, SENSORY_AREAS } from "./scale.ts";
import { UserError } from "./user-error.ts";
import { splitItems, writeList } from "./format.ts";

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
