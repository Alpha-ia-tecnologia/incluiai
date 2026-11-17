import { splitItems } from "./form-options.ts";
import { SENSORY_AREAS } from "./scale.ts";
import { UserError } from "./user-error.ts";

export const PROFILE_SUPPORT_FIELDS = [
  "readingSupport", "writingSupport", "mathSupport",
  "peerInteraction", "adultInteraction", "groupWork",
  "feeding", "hygiene", "mobility", "organization",
  "fineMotor", "grossMotor",
] as const;
type SupportField = (typeof PROFILE_SUPPORT_FIELDS)[number];

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

const textOf = (value: unknown) => String(value ?? "");
const listOf = (value: unknown) => splitItems(textOf(value), ",");

export function profileFromForm(get: (name: string) => unknown, getAll: (name: string) => unknown[]): ProfileData {
  const interests = listOf(get("interests"));
  if (!interests.length) throw new UserError("Informe ao menos um interesse âncora.");
  const supports = Object.fromEntries(PROFILE_SUPPORT_FIELDS.map((field) => [field, Number(get(field) ?? 0)])) as Record<SupportField, number>;
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
    triggers: JSON.stringify(listOf(get("triggers"))),
    earlySigns: JSON.stringify(listOf(get("earlySigns"))),
    calmingStrategies: JSON.stringify(listOf(get("calmingStrategies"))),
    bestShift: textOf(get("bestShift") ?? "manha"),
    taskToleranceMinutes: Number(get("taskToleranceMinutes") ?? 15),
    interests: JSON.stringify(interests),
    barriers: JSON.stringify(getAll("barriers").map(String)),
    strengths: textOf(get("strengths")).trim() || null,
  };
}
