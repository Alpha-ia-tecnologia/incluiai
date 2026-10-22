// Censo Escolar no servidor: verificação dos estudantes do AEE contra a
// referência de cada escola e o monitor da janela do Censo. Sem "server-only"
// de propósito: o agendador nasce em src/instrumentation.ts, fora das páginas.
// A importação do arquivo fica em census.ts; as regras puras, em census-rules.ts.
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { parseJson } from "./format";
import { DEFAULT_MONITOR, inWindow, nextRun, verifyCoverage, type Coverage, type MonitorConfig, type PlatformStudent, type SnapshotPerson } from "./census-rules";

export type SchoolResult = { schoolId: string; school: string; aee: number; confirmed: number; pending: number; percent: number | null };

const LOCK_MS = 10 * 60_000;
const TICK_MS = 60_000;
const INSTANCE = `${process.pid}:${randomUUID().slice(0, 8)}`;

export const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export async function schoolStudents(schoolId: string): Promise<PlatformStudent[]> {
  const students = await prisma.student.findMany({ where: { schoolId, status: "ativo" }, select: { id: true, name: true, birthDate: true, inepId: true, cpf: true, hasAEE: true }, orderBy: { name: "asc" } });
  return students.map((student) => ({ ...student, birthDate: isoDay(student.birthDate) }));
}

// Cobertura de uma escola contra a referência guardada (null sem arquivo aplicado).
export async function schoolCoverage(schoolId: string): Promise<{ coverage: Coverage; importedAt: Date; persons: SnapshotPerson[] } | null> {
  const snapshot = await prisma.censusSnapshot.findUnique({ where: { schoolId } });
  if (!snapshot) return null;
  const persons = parseJson<SnapshotPerson[]>(snapshot.persons, []);
  const coverage = verifyCoverage(await schoolStudents(schoolId), persons, new Set(parseJson<string[]>(snapshot.regularOnly, [])));
  return { coverage, importedAt: snapshot.importedAt, persons };
}

// Verifica todas as escolas com referência. Avisa a coordenação e a gestão da
// escola quando o número de pendências muda (duas verificações por dia não
// repetem o mesmo aviso).
export async function runVerification(trigger: "agendada" | "manual", actorName: string) {
  const snapshots = await prisma.censusSnapshot.findMany({ select: { schoolId: true, school: { select: { name: true } } } });
  const results: SchoolResult[] = [];
  for (const snapshot of snapshots) {
    const result = await schoolCoverage(snapshot.schoolId);
    if (!result) continue;
    const { coverage } = result;
    results.push({ schoolId: snapshot.schoolId, school: snapshot.school.name, aee: coverage.rows.length, confirmed: coverage.confirmed, pending: coverage.pending, percent: coverage.percent });
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
    const users = await prisma.user.findMany({ where: { role: { in: ["coordenacao", "gestao"] }, schoolId: result.schoolId, deactivatedAt: null }, select: { id: true } });
    const title = `Censo: ${result.pending} ${result.pending === 1 ? "estudante do AEE" : "estudantes do AEE"} com pendência na ${result.school}`;
    if (users.length) await prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, kind: "censo_pendencias", title, href: "/censo" })) });
  }
  return check;
}

// --- Monitor da janela ---

const configOf = (row: { enabled: boolean; periodStart: string; periodEnd: string; times: string }): MonitorConfig =>
  ({ enabled: row.enabled, periodStart: row.periodStart, periodEnd: row.periodEnd, times: parseJson<string[]>(row.times, DEFAULT_MONITOR.times) });

export async function getMonitor(now: Date = new Date()) {
  const row = await prisma.censusMonitor.upsert({
    where: { id: "rede" },
    create: { id: "rede", enabled: DEFAULT_MONITOR.enabled, periodStart: DEFAULT_MONITOR.periodStart, periodEnd: DEFAULT_MONITOR.periodEnd, times: JSON.stringify(DEFAULT_MONITOR.times), nextRunAt: nextRun(DEFAULT_MONITOR, now) },
    update: {},
  });
  return { row, config: configOf(row) };
}

// Salvar a janela já reagenda a próxima verificação: a tela e o agendador concordam.
export async function saveMonitorConfig(config: MonitorConfig, actorName: string, now: Date = new Date()) {
  await getMonitor(now);
  await prisma.censusMonitor.update({ where: { id: "rede" }, data: { enabled: config.enabled, periodStart: config.periodStart, periodEnd: config.periodEnd, times: JSON.stringify(config.times), nextRunAt: nextRun(config, now), updatedBy: actorName } });
}

// Uma passada do agendador. A trava (lockedUntil) impede que duas instâncias
// verifiquem juntas; servidor parado no horário marcado verifica ao voltar.
export async function monitorTick(now: Date = new Date()): Promise<boolean> {
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

// Uma vez por processo (o recarregamento do modo dev não duplica). CENSUS_MONITOR=0 desliga.
export function startCensusMonitor() {
  if (process.env.CENSUS_MONITOR === "0" || timers.censusMonitor) return;
  const tick = () => void monitorTick().catch((error) => console.error("[censo] agendador falhou", error));
  timers.censusMonitor = setInterval(tick, TICK_MS);
  timers.censusMonitor.unref?.();
  tick();
}
