import { randomUUID } from "node:crypto";
import { db, forEachMunicipality } from "./prisma";
import { parseJson } from "./format";
import { notifyCensusPending } from "./notices";
import { censusMonitorOn } from "./env-config";
import { DEFAULT_MONITOR, inWindow, networkAeeEstimate, nextRun, publicRegularClasses, verifyCoverage, type Coverage, type MonitorConfig, type PlatformStudent, type SchoolInfo, type SnapshotPerson } from "./census-core";

export type SchoolResult = { schoolId: string; school: string; aee: number; confirmed: number; pending: number; percent: number | null };

const LOCK_MS = 10 * 60_000;
const TICK_MS = 60_000;
const INSTANCE = `${process.pid}:${randomUUID().slice(0, 8)}`;

export const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export async function schoolStudents(schoolId: string): Promise<PlatformStudent[]> {
  const prisma = await db();
  const students = await prisma.student.findMany({ where: { schoolId, status: "ativo" }, select: { id: true, name: true, birthDate: true, inepId: true, cpf: true }, orderBy: { name: "asc" } });
  return students.map((student) => ({ ...student, birthDate: isoDay(student.birthDate) }));
}

export type NetworkSnapshot = { schoolId: string; name: string; info: SchoolInfo; persons: SnapshotPerson[]; regularOnly: string[]; importedAt: Date };
const NO_INFO: SchoolInfo = { dependency: "", privateCategory: "", municipalPartnership: false };

export async function networkSnapshots(): Promise<NetworkSnapshot[]> {
  const prisma = await db();
  const rows = await prisma.censusSnapshot.findMany({ select: { schoolId: true, persons: true, regularOnly: true, schoolInfo: true, importedAt: true, school: { select: { name: true } } } });
  return rows.map((row) => ({
    schoolId: row.schoolId, name: row.school.name, importedAt: row.importedAt,
    info: { ...NO_INFO, ...parseJson<Partial<SchoolInfo>>(row.schoolInfo, {}) },
    persons: parseJson<SnapshotPerson[]>(row.persons, []), regularOnly: parseJson<string[]>(row.regularOnly, []),
  }));
}

const asSchools = (network: readonly NetworkSnapshot[]) => network.map((snapshot) => ({ id: snapshot.schoolId, name: snapshot.name, info: snapshot.info, persons: snapshot.persons }));

function regularElsewhere(network: readonly NetworkSnapshot[], schoolId: string): (keys: string[]) => string | null {
  const index = publicRegularClasses(asSchools(network), schoolId);
  return (keys) => keys.map((key) => index.get(key)?.school).find((name) => name !== undefined) ?? null;
}

export async function schoolCoverage(schoolId: string, network?: readonly NetworkSnapshot[]): Promise<{ coverage: Coverage; importedAt: Date; persons: SnapshotPerson[]; info: SchoolInfo } | null> {
  const all = network ?? await networkSnapshots();
  const snapshot = all.find((item) => item.schoolId === schoolId);
  if (!snapshot) return null;
  const coverage = verifyCoverage(await schoolStudents(schoolId), snapshot.persons, new Set(snapshot.regularOnly), regularElsewhere(all, schoolId));
  return { coverage, importedAt: snapshot.importedAt, persons: snapshot.persons, info: snapshot.info };
}

export const aeeEstimate = (network: readonly NetworkSnapshot[], countOnly?: string) => networkAeeEstimate(asSchools(network), countOnly);

export async function runVerification(trigger: "agendada" | "manual", actorName: string) {
  const prisma = await db();
  const network = await networkSnapshots();
  const results: SchoolResult[] = [];
  for (const snapshot of network) {
    const result = await schoolCoverage(snapshot.schoolId, network);
    if (!result) continue;
    const { coverage } = result;
    results.push({ schoolId: snapshot.schoolId, school: snapshot.name, aee: coverage.rows.length, confirmed: coverage.confirmed, pending: coverage.pending, percent: coverage.percent });
  }
  const previous = await prisma.censusCheck.findFirst({ where: { ok: true }, orderBy: { at: "desc" }, select: { schools: true } });
  const before = new Map(parseJson<SchoolResult[]>(previous?.schools, []).map((item) => [item.schoolId, item.pending]));
  const check = await prisma.censusCheck.create({
    data: {
      trigger, actorName, ok: results.length > 0,
      confirmed: results.reduce((sum, item) => sum + item.confirmed, 0),
      pending: results.reduce((sum, item) => sum + item.pending, 0),
      schools: JSON.stringify(results),
    },
  });
  for (const result of results.filter((item) => item.pending > 0 && item.pending !== before.get(item.schoolId))) {
    await notifyCensusPending({ id: result.schoolId, name: result.school }, result.pending);
  }
  return check;
}

export async function recentChecks() {
  const prisma = await db();
  const rows = await prisma.censusCheck.findMany({ orderBy: { at: "desc" }, take: 10 });
  return rows.map(({ schools, ...row }) => ({ ...row, schools: parseJson<SchoolResult[]>(schools, []).length }));
}

const configOf = (row: { enabled: boolean; periodStart: string; periodEnd: string; times: string }): MonitorConfig =>
  ({ enabled: row.enabled, periodStart: row.periodStart, periodEnd: row.periodEnd, times: parseJson<string[]>(row.times, DEFAULT_MONITOR.times) });

export async function getMonitor(now: Date = new Date()) {
  const prisma = await db();
  const row = await prisma.censusMonitor.upsert({
    where: { id: "rede" },
    create: { id: "rede", enabled: DEFAULT_MONITOR.enabled, periodStart: DEFAULT_MONITOR.periodStart, periodEnd: DEFAULT_MONITOR.periodEnd, times: JSON.stringify(DEFAULT_MONITOR.times), nextRunAt: nextRun(DEFAULT_MONITOR, now) },
    update: {},
  });
  return { row, config: configOf(row) };
}

export async function saveMonitorConfig(config: MonitorConfig, actorName: string, now: Date = new Date()) {
  const prisma = await db();
  await getMonitor(now);
  await prisma.censusMonitor.update({ where: { id: "rede" }, data: { enabled: config.enabled, periodStart: config.periodStart, periodEnd: config.periodEnd, times: JSON.stringify(config.times), nextRunAt: nextRun(config, now), updatedBy: actorName } });
}

export async function saveFndeCount(count: number | null, year: number | null, actorName: string, now: Date = new Date()) {
  const prisma = await db();
  await getMonitor(now);
  await prisma.censusMonitor.update({ where: { id: "rede" }, data: { fndeAee: count, fndeYear: year, updatedBy: actorName } });
}

export async function monitorTick(now: Date = new Date()): Promise<boolean> {
  const prisma = await db();
  const { row, config } = await getMonitor(now);
  if (!row.nextRunAt) {
    const next = nextRun(config, now);
    if (next) await prisma.censusMonitor.update({ where: { id: "rede" }, data: { nextRunAt: next } });
    return false;
  }
  if (row.nextRunAt > now) return false;
  const claimed = await prisma.censusMonitor.updateMany({
    where: { id: "rede", nextRunAt: { lte: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedBy: INSTANCE, lockedUntil: new Date(now.getTime() + LOCK_MS) },
  });
  if (!claimed.count) return false;
  let status = "fora da janela";
  try {
    if (config.enabled && inWindow(config, now)) {
      const check = await runVerification("agendada", "Monitor do Censo");
      status = check.ok ? `${check.confirmed} confirmados, ${check.pending} com pendência` : "nenhuma escola com arquivo aplicado";
    }
  } catch (error) {
    status = `erro: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
    console.error("[censo] verificação agendada falhou", error);
  } finally {
    const current = configOf(await prisma.censusMonitor.findUniqueOrThrow({ where: { id: "rede" } }));
    await prisma.censusMonitor.update({ where: { id: "rede" }, data: { lockedBy: null, lockedUntil: null, lastRunAt: now, lastStatus: status, nextRunAt: nextRun(current, new Date(now.getTime() + 1000)) } });
  }
  return true;
}

const timers = globalThis as unknown as { censusMonitor?: ReturnType<typeof setInterval> };

// O recarregamento do modo dev não duplica.
export function startCensusMonitor() {
  if (!censusMonitorOn() || timers.censusMonitor) return;
  const tick = () => void forEachMunicipality(() => monitorTick()).catch((error) => console.error("[censo] agendador falhou", error));
  timers.censusMonitor = setInterval(tick, TICK_MS);
  timers.censusMonitor.unref?.();
  tick();
}
