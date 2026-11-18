import "server-only";
import { db } from "./prisma";
import { newStudentData } from "./students";
import { AUDIT_ACTION, auditEntry, recordChange } from "./audit";
import type { SessionUser } from "./auth";
import { can, roleScope } from "./roles";
import { parseJson } from "./format";
import { parseEducacensoFile, specialEdPersons, type CensusPerson, type ParseStats } from "./educacenso";
import { digitsOnly, identityKeys } from "./student-identity";
import { parseCaseStudy } from "./case-study";
import { buildSyncPlan, censusCounts, cleanMonitorConfig, regularOnlyIds, schoolFundebNote, sumCounts, toSnapshot, type AeeEstimate, type CensusCounts, type CoverageRow, type MonitorConfig, type ReviewDecision, type SchoolInfo, type SyncPlan } from "./census-core";
import { aeeEstimate, networkSnapshots, runVerification, saveFndeCount, saveMonitorConfig, schoolCoverage, schoolStudents } from "./census-monitor";
import { censusReference, type CensusReferenceRecord } from "./federal-guidance";
import { UserError } from "./user-error";
import { DAY_MS, calendarDay, dayFromInput } from "./dates";
import { invalidateStudent } from "./invalidate";

export type CensusAccess = { network: boolean; schoolId: string | null; canImport: boolean; canConfigure: boolean };

export function censusAccess(user: SessionUser): CensusAccess | null {
  const canImport = can(user.role, "importCensus");
  const canConfigure = can(user.role, "configureCensus");
  if (!canImport && !canConfigure) return null;
  const network = roleScope(user.role) === "rede";
  return { network, schoolId: network ? null : user.schoolId, canImport, canConfigure };
}

export function canOpenSchool(user: SessionUser, schoolId: string): boolean {
  const access = censusAccess(user);
  return Boolean(access?.canImport && (!access.schoolId || access.schoolId === schoolId));
}

function requireCensusAccess(user: SessionUser): CensusAccess {
  const access = censusAccess(user);
  if (!access) throw new UserError("Você não tem acesso ao Censo Escolar.", "forbidden");
  return access;
}

export type ImportStats = ParseStats & { persons: number; special: number; edition: number };

// Sistemas de gestão costumam gravar o arquivo em Windows-1252: sem UTF-8 válido, relê assim.
export async function analyzeCensusFile(user: SessionUser, schoolId: string, content: string): Promise<string> {
  const prisma = await db();
  if (!canOpenSchool(user, schoolId)) throw new UserError("Você importa o arquivo só da sua escola.", "forbidden");
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, inepCode: true } });
  if (!school) throw new UserError("Escola não encontrada.", "not_found");
  const parsed = parseEducacensoFile(content);
  if (!parsed.school) throw new UserError("O arquivo não tem o registro 00 com o código INEP da escola. Confira se é o arquivo de migração do Educacenso (TXT com campos separados por |).");
  if (!parsed.persons.length) throw new UserError("O arquivo não tem nenhum registro 30 (pessoa física) que dê para ler.");
  if (school.inepCode && school.inepCode !== parsed.school.code) {
    throw new UserError(`O arquivo é da escola INEP ${parsed.school.code} (${parsed.school.name}), mas ${school.name} está com o código INEP ${school.inepCode}.`);
  }
  const other = await prisma.school.findFirst({ where: { inepCode: parsed.school.code, NOT: { id: schoolId } }, select: { name: true } });
  if (other) throw new UserError(`O código INEP ${parsed.school.code} do arquivo já está ligado a ${other.name}.`, "conflict");
  const special = specialEdPersons(parsed);
  const students = await schoolStudents(schoolId);
  const stats: ImportStats = { ...parsed.stats, persons: parsed.persons.length, special: special.length, edition: parsed.edition };
  await prisma.censusImport.updateMany({ where: { schoolId, status: "previa" }, data: { status: "descartada", persons: "[]", regularOnly: "[]" } });
  const created = await prisma.censusImport.create({
    data: {
      schoolId, fileSchoolCode: parsed.school.code, fileSchoolName: parsed.school.name,
      persons: JSON.stringify(special), regularOnly: JSON.stringify(regularOnlyIds(students, parsed.persons)), stats: JSON.stringify(stats),
      schoolInfo: JSON.stringify({ dependency: parsed.school.dependency, privateCategory: parsed.school.privateCategory, municipalPartnership: parsed.school.municipalPartnership } satisfies SchoolInfo),
      createdById: user.id, createdByName: user.name,
    },
  });
  return created.id;
}

async function elsewhereCheck(schoolId: string): Promise<(keys: string[]) => boolean> {
  const prisma = await db();
  const others = await prisma.student.findMany({ where: { NOT: { schoolId } }, select: { name: true, birthDate: true, inepId: true, cpf: true } });
  const keys = new Set(others.flatMap((student) => identityKeys({ ...student, birthDate: calendarDay(student.birthDate) })));
  return (candidate) => candidate.some((key) => keys.has(key));
}

export async function loadImport(user: SessionUser, importId: string) {
  const prisma = await db();
  const censusImport = await prisma.censusImport.findUnique({ where: { id: importId }, include: { school: { select: { id: true, name: true, inepCode: true } } } });
  if (!censusImport || !canOpenSchool(user, censusImport.schoolId)) return null;
  const persons = parseJson<CensusPerson[]>(censusImport.persons, []);
  const decisions = parseJson<ReviewDecision[]>(censusImport.decisions, []);
  const students = await schoolStudents(censusImport.schoolId);
  const plan: SyncPlan | null = censusImport.status === "previa" ? buildSyncPlan(persons, students, { now: new Date(), decisions, elsewhere: await elsewhereCheck(censusImport.schoolId) }) : null;
  const schoolNote = schoolFundebNote({ dependency: "", privateCategory: "", municipalPartnership: false, ...parseJson<Partial<SchoolInfo>>(censusImport.schoolInfo, {}) });
  return { censusImport, persons, decisions, students, plan, schoolNote, stats: parseJson<ImportStats | null>(censusImport.stats, null) };
}

export async function saveDecision(user: SessionUser, importId: string, decision: ReviewDecision): Promise<void> {
  const prisma = await db();
  const loaded = await loadImport(user, importId);
  if (!loaded || loaded.censusImport.status !== "previa") throw new UserError("Esta prévia não está mais aberta.", "conflict");
  const person = loaded.persons.find((item) => item.key === decision.personKey);
  if (!person) throw new UserError("Pessoa não encontrada na prévia.", "not_found");
  if (decision.decision === "link" && !loaded.students.some((student) => student.id === decision.studentId)) throw new UserError("Escolha um estudante da escola para vincular.");
  if (decision.decision === "create" && !person.birthDate) throw new UserError("Sem data de nascimento válida no arquivo: cadastre pelo formulário ou ignore.");
  if (decision.decision === "ignore" && !decision.reason?.trim()) throw new UserError("Diga o motivo para ignorar.");
  const decisions = [...loaded.decisions.filter((item) => item.personKey !== decision.personKey), { ...decision, reason: decision.reason?.trim().slice(0, 200) || null }];
  await prisma.censusImport.update({ where: { id: importId }, data: { decisions: JSON.stringify(decisions) } });
}

export async function undoDecision(user: SessionUser, importId: string, personKey: string) {
  const prisma = await db();
  const loaded = await loadImport(user, importId);
  if (!loaded || loaded.censusImport.status !== "previa") return;
  await prisma.censusImport.update({ where: { id: importId }, data: { decisions: JSON.stringify(loaded.decisions.filter((item) => item.personKey !== personKey)) } });
}

export async function discardImport(user: SessionUser, importId: string): Promise<string | null> {
  const prisma = await db();
  const censusImport = await prisma.censusImport.findUnique({ where: { id: importId }, select: { schoolId: true, status: true } });
  if (!censusImport || !canOpenSchool(user, censusImport.schoolId)) return null;
  if (censusImport.status === "previa") await prisma.censusImport.update({ where: { id: importId }, data: { status: "descartada", persons: "[]", regularOnly: "[]" } });
  return censusImport.schoolId;
}

// Tipos de AEE (registro 60) e recursos nas avaliações (registro 30).
export type CensusMeta = { syncedAt: string; schoolInep: string; aee: boolean; regular: boolean; aeeClass: string | null; regularClass: string | null; services: string[]; resources?: string[] };
export const censusMetaOf = (value: string | null) => parseJson<CensusMeta | null>(value, null);

export const maskCpf = (cpf: string) => (cpf.length === 11 ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : cpf);

export type ImportSummary = { created: number; updated: number; unchanged: number; ignored: number; missing: number };

export async function schoolImports(schoolId: string) {
  const prisma = await db();
  const rows = await prisma.censusImport.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, createdAt: true, createdByName: true, result: true } });
  return rows.map(({ result, ...row }) => ({ ...row, summary: parseJson<ImportSummary | null>(result, null) }));
}

export async function applyImport(user: SessionUser, importId: string): Promise<{ schoolId: string; created: number; updated: number }> {
  const prisma = await db();
  const loaded = await loadImport(user, importId);
  if (!loaded?.plan) throw new UserError("Esta prévia não está mais aberta.", "conflict");
  const { censusImport, persons, plan } = loaded;
  if (plan.totals.review) throw new UserError(`Resolva ${plan.totals.review === 1 ? "a revisão" : `as ${plan.totals.review} revisões`} antes de aplicar.`);
  const now = new Date();
  const byKey = new Map(persons.map((person) => [person.key, person]));
  const meta = (person: CensusPerson) => JSON.stringify({ syncedAt: now.toISOString(), schoolInep: censusImport.fileSchoolCode, aee: person.hasAee, regular: person.hasRegular, aeeClass: person.aeeClassName || null, regularClass: person.regularClassName || null, services: person.aeeServices, resources: person.assessmentResources } satisfies CensusMeta);
  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    await tx.school.update({ where: { id: censusImport.schoolId }, data: { inepCode: censusImport.fileSchoolCode } });
    for (const item of plan.items) {
      const person = byKey.get(item.key);
      if (!person) continue;
      if (item.action === "create" && item.create) {
        const data = item.create;
        await tx.student.create({
          data: newStudentData(user, {
            name: data.name, birthDate: data.birthDate, stage: data.stage, gradeYear: "A informar", className: data.className, shift: "A informar",
            schoolId: censusImport.schoolId, guardianName: "A informar", inepId: data.inepId, cpf: data.cpf, census: meta(person),
          }, "censo"),
        });
        created += 1;
      } else if (item.studentId) {
        const data: { census: string; name?: string; birthDate?: Date; inepId?: string; cpf?: string } = { census: meta(person) };
        for (const diff of item.diffs) {
          if (diff.field === "name") data.name = diff.to;
          else if (diff.field === "birthDate") data.birthDate = dayFromInput(diff.to) ?? undefined;
          else if (diff.field === "inepId") data.inepId = diff.to;
          else if (diff.field === "cpf") data.cpf = diff.to;
        }
        await tx.student.update({ where: { id: item.studentId }, data });
        if (item.diffs.length) {
          await tx.accessLog.create({ data: { studentId: item.studentId, ...auditEntry(user, AUDIT_ACTION.updated, `Dados do Censo Escolar: ${item.diffs.map((diff) => diff.label).join(", ")}`) } });
          updated += 1;
        }
      }
    }
    const snapshotPersons = toSnapshot(persons);
    const snapshot = { inepCode: censusImport.fileSchoolCode, fileSchoolName: censusImport.fileSchoolName, persons: JSON.stringify(snapshotPersons), regularOnly: censusImport.regularOnly, schoolInfo: censusImport.schoolInfo, counts: JSON.stringify(censusCounts(snapshotPersons)), importedById: user.id, importedByName: user.name, importedAt: now };
    await tx.censusSnapshot.upsert({ where: { schoolId: censusImport.schoolId }, create: { schoolId: censusImport.schoolId, ...snapshot }, update: snapshot });
    await tx.censusImport.update({
      where: { id: importId },
      data: { status: "aplicada", appliedAt: now, persons: "[]", regularOnly: "[]", result: JSON.stringify({ created, updated, unchanged: plan.totals.unchanged, ignored: plan.totals.ignored, missing: plan.totals.missing } satisfies ImportSummary) },
    });
  }, { timeout: 30_000 });
  return { schoolId: censusImport.schoolId, created, updated };
}

export async function setStudentInep(user: SessionUser, studentId: string, inepId: string): Promise<void> {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student || !canOpenSchool(user, student.schoolId)) throw new UserError("Você não pode alterar este estudante.", "forbidden");
  const digits = digitsOnly(inepId);
  if (digits.length !== 12) throw new UserError("O ID INEP tem 12 números.");
  await prisma.student.update({ where: { id: studentId }, data: { inepId: digits } });
  await recordChange(user, studentId, AUDIT_ACTION.updated, "ID INEP do Censo Escolar");
  invalidateStudent(studentId);
}

export async function setSchoolInep(user: SessionUser, schoolId: string, inepCode: string): Promise<void> {
  const prisma = await db();
  if (!canOpenSchool(user, schoolId)) throw new UserError("Você altera só a sua escola.", "forbidden");
  const code = digitsOnly(inepCode);
  if (code.length !== 8) throw new UserError("O código INEP da escola tem 8 números.");
  const other = await prisma.school.findFirst({ where: { inepCode: code, NOT: { id: schoolId } }, select: { name: true } });
  if (other) throw new UserError(`O código ${code} já está ligado a ${other.name}.`, "conflict");
  await prisma.school.update({ where: { id: schoolId }, data: { inepCode: code } });
}

export async function verifyCensusNow(user: SessionUser): Promise<void> {
  requireCensusAccess(user);
  await runVerification("manual", user.name);
}

export async function saveCensusWindow(user: SessionUser, raw: MonitorConfig): Promise<void> {
  if (!requireCensusAccess(user).canConfigure) throw new UserError("Só a Secretaria configura a janela do Censo.", "forbidden");
  await saveMonitorConfig(cleanMonitorConfig(raw), user.name);
}

export async function saveFnde(user: SessionUser, raw: { count: string; year: number }): Promise<void> {
  if (!requireCensusAccess(user).canConfigure) throw new UserError("Só a Secretaria informa o número do FNDE.", "forbidden");
  const count = raw.count ? Number(raw.count) : null;
  if (count !== null && (!Number.isInteger(count) || count < 0 || count > 1_000_000)) throw new UserError("Informe um número inteiro de matrículas.");
  if (count !== null && (!Number.isInteger(raw.year) || raw.year < 2020 || raw.year > 2100)) throw new UserError("Informe o ano do Fundeb.");
  await saveFndeCount(count, count === null ? null : raw.year, user.name);
}

export type SchoolOverview = {
  id: string;
  name: string;
  inepCode: string | null;
  importedAt: Date | null;
  importedByName: string | null;
  counts: CensusCounts | null;
  note: ReturnType<typeof schoolFundebNote> | null;
  coverage: { confirmed: number; pending: number; percent: number | null; rows: CoverageRow[] } | null;
  platformAee: number;
  attended: number;
  referenced: number;
  canOpen: boolean;
};

export type ReferenceRow = { id: string; name: string; backed: boolean; records: CensusReferenceRecord[]; pending: string | null };
export async function schoolReferences(schoolId: string): Promise<ReferenceRow[]> {
  const prisma = await db();
  const students = await prisma.student.findMany({
    where: { schoolId, status: "ativo" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, caseStudy: { select: { status: true, content: true } }, plans: { where: { status: "ativo" }, select: { id: true }, take: 1 } },
  });
  return students.map((student) => ({
    id: student.id, name: student.name,
    ...censusReference(student.caseStudy && { status: student.caseStudy.status, content: parseCaseStudy(student.caseStudy.content) }, student.plans.length > 0),
  }));
}

export async function censusOverview(user: SessionUser) {
  const prisma = await db();
  const access = censusAccess(user);
  if (!access) return null;
  const since = new Date(Date.now() - 60 * DAY_MS);
  const schools = await prisma.school.findMany({
    where: access.schoolId ? { id: access.schoolId } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true, inepCode: true, censusSnapshot: { select: { importedAt: true, importedByName: true, counts: true } } },
  });
  const network = await networkSnapshots();
  const rows: SchoolOverview[] = [];
  for (const school of schools) {
    const result = school.censusSnapshot ? await schoolCoverage(school.id, network) : null;
    const [references, attended] = await Promise.all([
      schoolReferences(school.id),
      prisma.student.count({ where: { schoolId: school.id, status: "ativo", aeeSessions: { some: { status: "realizado", date: { gte: since } } } } }),
    ]);
    const platformAee = references.length;
    const referenced = references.filter((row) => row.backed).length;
    rows.push({
      id: school.id, name: school.name, inepCode: school.inepCode,
      importedAt: school.censusSnapshot?.importedAt ?? null, importedByName: access.network ? null : school.censusSnapshot?.importedByName ?? null,
      counts: school.censusSnapshot ? parseJson<CensusCounts | null>(school.censusSnapshot.counts, null) : null,
      note: result ? schoolFundebNote(result.info) : null,
      coverage: result ? { confirmed: result.coverage.confirmed, pending: result.coverage.pending, percent: result.coverage.percent, rows: access.network ? [] : result.coverage.rows } : null,
      platformAee, attended, referenced, canOpen: canOpenSchool(user, school.id),
    });
  }
  const withFile = rows.filter((row) => row.counts);
  const estimate: AeeEstimate = aeeEstimate(network, access.schoolId ?? undefined);
  return {
    access,
    estimate,
    schools: rows,
    totals: sumCounts(withFile.map((row) => row.counts as CensusCounts)),
    withFile: withFile.length,
    platformAee: rows.reduce((sum, row) => sum + row.platformAee, 0),
    attended: rows.reduce((sum, row) => sum + row.attended, 0),
    referenced: rows.reduce((sum, row) => sum + row.referenced, 0),
    pending: rows.reduce((sum, row) => sum + (row.coverage?.pending ?? 0), 0),
  };
}
