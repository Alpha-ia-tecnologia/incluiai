// A rede é municipal e brasileira: o dia que vale é o de Brasília (America/Sao_Paulo),
// que segue UTC−3 o ano todo desde o fim do horário de verão (Decreto nº 9.772/2019).
const TIME_ZONE = "America/Sao_Paulo";
const OFFSET = "-03:00";
export const DAY_MS = 86_400_000;

export type YMD = { year: number; month: number; day: number };

export const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const pad = (value: number) => String(value).padStart(2, "0");
const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const PARTS = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" });

export function brYmd(date: Date | string | number = new Date()): YMD {
  const parts = PARTS.formatToParts(toDate(date));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const isoOf = ({ year, month, day }: YMD) => `${year}-${pad(month)}-${pad(day)}`;

export const brDay = (date: Date | string | number = new Date()) => isoOf(brYmd(date));

// Campos só de data (nascimento) chegam gravados à meia-noite UTC (carga inicial) ou ao meio-dia: o dia UTC é o certo.
export const calendarDay = (date: Date | string) => toDate(date).toISOString().slice(0, 10);

export function isIsoDay(value: string): boolean {
  const time = Date.parse(`${value}T12:00:00Z`);
  return ISO_DAY.test(value) && !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

// Datas vindas de <input type="date"> ao meio-dia, para não trocar de dia pelo fuso.
export const dayFromInput = (value: string): Date | null => (isIsoDay(value) ? new Date(`${value}T12:00:00${OFFSET}`) : null);
export const dayStart = (iso: string) => new Date(`${iso}T00:00:00${OFFSET}`);
export const dayEnd = (iso: string) => new Date(`${iso}T23:59:59${OFFSET}`);
export const atBrasiliaTime = (iso: string, time: string) => new Date(`${iso}T${time}:00${OFFSET}`);

const utcDay = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
export const addDays = (iso: string, days: number) => new Date(utcDay(iso) + days * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (fromIso: string, toIso: string) => Math.round((utcDay(toIso) - utcDay(fromIso)) / DAY_MS);

export const daysUntil = (date: Date, now: Date = new Date()) => daysBetween(brDay(now), brDay(date));
export const isPastDay = (date: Date, now: Date = new Date()) => brDay(date) < brDay(now);

const monthIndexOf = ({ year, month }: Pick<YMD, "year" | "month">) => year * 12 + month - 1;
export const monthIndex = (date: Date | string = new Date()) => monthIndexOf(brYmd(date));
export const monthOfIndex = (index: number) => ({ year: Math.floor(index / 12), month: (index % 12) + 1 });
export const monthStart = (index: number) => {
  const { year, month } = monthOfIndex(index);
  return dayStart(`${year}-${pad(month)}-01`);
};
export const monthKey = (year: number, month: number) => `${year}-${pad(month)}`;
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const dayIndex = ({ year, month, day }: YMD) => Date.UTC(year, month - 1, day) / DAY_MS;
export const weekdayOf = ({ year, month, day }: YMD) => new Date(Date.UTC(year, month - 1, day)).getUTCDay();

export function weekStart(date: Date = new Date()): string {
  const iso = brDay(date);
  return addDays(iso, -((weekdayOf(brYmd(date)) + 6) % 7));
}

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });
const DATE_SHORT = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });
const DATE_NUMERIC = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const TIME = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const MONTH_YEAR = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, month: "long", year: "numeric" });

export const formatDate = (date: Date | string) => DATE_FORMAT.format(toDate(date));
export const formatDateShort = (date: Date | string) => DATE_SHORT.format(toDate(date));
export const formatDateNumeric = (date: Date | string) => DATE_NUMERIC.format(toDate(date));
export const formatDateTime = (date: Date | string) => DATE_TIME.format(toDate(date));
export const formatTime = (date: Date | string) => TIME.format(toDate(date));
export const formatMonth = (date: Date | string) => MONTH_YEAR.format(toDate(date));
export const isoToBr = (iso: string) => iso.split("-").reverse().join("/");

export function ageFrom(birthDate: Date | string, now: Date = new Date()): number {
  const [year, month, day] = calendarDay(birthDate).split("-").map(Number);
  const today = brYmd(now);
  return today.year - year - (today.month < month || (today.month === month && today.day < day) ? 1 : 0);
}
