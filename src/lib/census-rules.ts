// Regras do Censo Escolar, puras para teste com node --test
// (src/lib/census-rules.test.mjs): a conciliação do arquivo do Educacenso com
// o cadastro, a verificação dos estudantes do AEE contra a referência de cada
// escola (dupla matrícula), as contagens e a janela do monitor. Portado do
// IncluiAI e adaptado ao cadastro do IncluiEdu.
import { digitsOnly, identityKeys, normalizeName, titleCase, type CensusPerson, type Dependency } from "./educacenso.ts";

export type PlatformStudent = { id: string; name: string; birthDate: string; inepId: string | null; cpf: string | null; hasAEE: boolean };
export type MatchBy = "inep" | "cpf" | "nome_nascimento" | "nome" | "manual";
export const MATCH_LABEL: Record<MatchBy, string> = { inep: "ID INEP", cpf: "CPF", nome_nascimento: "nome e nascimento", nome: "nome", manual: "vínculo manual" };

// Referência guardada por escola: só o público da educação especial, sem o arquivo.
// Os campos opcionais vieram depois: referências antigas não os têm.
export type SnapshotPerson = {
  key: string; name: string; inepId: string; cpf: string; birthDate: string;
  special: boolean; aee: boolean; regular: boolean; stage: string;
  aeeLinks?: number; aeeNoService?: number; activityLinks?: number; overlap?: boolean; regularRemote?: boolean;
};
export const toSnapshot = (persons: CensusPerson[]): SnapshotPerson[] =>
  persons.map((person) => ({
    key: person.key, name: person.name, inepId: person.inepId, cpf: person.cpf, birthDate: person.birthDate,
    special: person.special, aee: person.hasAee, regular: person.hasRegular, stage: person.stageGroup,
    aeeLinks: person.aeeLinks, aeeNoService: person.aeeLinksWithoutService, activityLinks: person.activityLinks, overlap: person.scheduleOverlap, regularRemote: person.regularRemote,
  }));

type Identified = { inepId?: string | null; cpf?: string | null; name: string; birthDate?: string | null };

function findMatch<T extends Identified>(person: Identified, list: readonly T[]): { found?: T; by?: MatchBy; sameName: T[] } {
  const inep = digitsOnly(person.inepId ?? "");
  const cpf = digitsOnly(person.cpf ?? "");
  if (inep) {
    const found = list.find((item) => digitsOnly(item.inepId ?? "") === inep);
    if (found) return { found, by: "inep", sameName: [] };
  }
  if (cpf.length === 11) {
    const found = list.find((item) => digitsOnly(item.cpf ?? "") === cpf);
    if (found) return { found, by: "cpf", sameName: [] };
  }
  const name = normalizeName(person.name);
  const sameName = list.filter((item) => normalizeName(item.name) === name);
  if (person.birthDate) {
    const found = sameName.find((item) => item.birthDate === person.birthDate);
    if (found) return { found, by: "nome_nascimento", sameName: [] };
  }
  if (sameName.length === 1) return { found: sameName[0], by: "nome", sameName: [] };
  return { sameName };
}

// --- Etapa estimada pela idade (corte etário de 31 de março) ---

export function stageFromAge(birthDate: string, now: Date): string {
  const [year, month] = birthDate.split("-").map(Number);
  // Idade em 31 de março do ano corrente: quem faz aniversário depois ainda não completou.
  const age = now.getUTCFullYear() - year - (month > 3 ? 1 : 0);
  if (age <= 5) return "educacao_infantil";
  if (age <= 10) return "anos_iniciais";
  if (age <= 14) return "anos_finais";
  if (age <= 17) return "ensino_medio";
  return "eja";
}

// --- Plano de conciliação do arquivo com o cadastro da escola ---

export type ReviewDecision = { personKey: string; decision: "link" | "create" | "ignore"; studentId?: string | null; reason?: string | null };
export type FieldDiff = { field: "name" | "birthDate" | "inepId" | "cpf" | "hasAEE"; label: string; from: string; to: string };
export type NewStudent = { name: string; birthDate: string; inepId: string | null; cpf: string | null; hasAEE: boolean; className: string; stage: string };
export type PlanItem = {
  key: string;
  censusName: string;
  action: "create" | "update" | "unchanged" | "review";
  studentId?: string;
  studentName?: string;
  matchedBy?: MatchBy;
  diffs: FieldDiff[];
  warnings: string[];
  person: Pick<CensusPerson, "special" | "hasAee" | "hasRegular" | "aeeClassName" | "regularClassName" | "stageGroup" | "aeeServices">;
  candidates?: { id: string; name: string; birthDate: string }[];
  elsewhere?: boolean; // há alguém igual em outra escola da rede (transferência?)
  decision?: ReviewDecision["decision"];
  create?: NewStudent;
};
export type SyncPlan = {
  items: PlanItem[];
  ignored: { key: string; censusName: string; reason: string }[];
  missing: { id: string; name: string }[];
  totals: { persons: number; create: number; update: number; unchanged: number; review: number; ignored: number; missing: number; doublePending: number };
};

const yesNo = (value: boolean) => (value ? "Sim" : "Não");

type WarningInput = Pick<CensusPerson, "special" | "hasAee" | "hasRegular"> & Partial<Pick<CensusPerson, "regularRemote" | "aeeLinks" | "aeeLinksWithoutService" | "activityLinks" | "scheduleOverlap">>;

export function personWarnings(person: WarningInput): string[] {
  const warnings: string[] = [];
  if (person.hasAee && !person.hasRegular) {
    warnings.push(person.regularRemote
      ? "Classe comum semipresencial ou a distância: o FNDE só conta a dupla matrícula com escolarização presencial."
      : "Dupla matrícula não confirmada: há matrícula no AEE, mas nenhuma em classe comum presencial no arquivo. Se o aluno estuda em outra escola ou rede, confira lá.");
  }
  if (person.aeeLinksWithoutService) warnings.push("Vínculo no AEE sem nenhum tipo de atendimento marcado: o Educacenso recusa o arquivo da escola.");
  if (person.scheduleOverlap) warnings.push("O horário do AEE coincide com o da classe comum. Desde 2025 a dupla matrícula conta mesmo assim (Nota Técnica Conjunta nº 12/2025), mas o Educacenso pode recusar vínculos com horário coincidente: confira.");
  if ((person.activityLinks ?? 0) > 4) warnings.push("Mais de 4 vínculos em AEE ou atividade complementar: o Educacenso não importa a pessoa.");
  if ((person.aeeLinks ?? 0) > 1) warnings.push("Mais de um vínculo no AEE: o Fundeb conta um só por aluno.");
  if (person.special && !person.hasAee) warnings.push("Público da educação especial sem matrícula no AEE no arquivo.");
  if (!person.special && person.hasAee) warnings.push("Matrícula no AEE sem a marcação de educação especial: o Educacenso recusa o arquivo da escola.");
  return warnings;
}

function diffsFor(person: CensusPerson, student: PlatformStudent): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  if (normalizeName(student.name) !== normalizeName(person.name)) diffs.push({ field: "name", label: "Nome", from: student.name, to: titleCase(person.name) });
  if (person.birthDate && student.birthDate !== person.birthDate) diffs.push({ field: "birthDate", label: "Data de nascimento", from: student.birthDate, to: person.birthDate });
  if (person.inepId && digitsOnly(student.inepId ?? "") !== person.inepId) diffs.push({ field: "inepId", label: "ID INEP", from: student.inepId ?? "", to: person.inepId });
  if (person.cpf.length === 11 && digitsOnly(student.cpf ?? "") !== person.cpf) diffs.push({ field: "cpf", label: "CPF", from: student.cpf ?? "", to: person.cpf });
  // O Censo confirma o AEE; tirar o atendimento é decisão da equipe, nunca automática.
  if (person.hasAee && !student.hasAEE) diffs.push({ field: "hasAEE", label: "Recebe AEE", from: yesNo(false), to: yesNo(true) });
  return diffs;
}

export function buildSyncPlan(persons: CensusPerson[], students: PlatformStudent[], options: { now: Date; decisions?: readonly ReviewDecision[]; elsewhere?: (keys: string[]) => boolean }): SyncPlan {
  const decisions = new Map((options.decisions ?? []).map((decision) => [decision.personKey, decision]));
  const items: PlanItem[] = [];
  const ignored: SyncPlan["ignored"] = [];
  for (const person of persons) {
    const decision = decisions.get(person.key);
    if (decision?.decision === "ignore") {
      ignored.push({ key: person.key, censusName: person.name, reason: decision.reason?.trim() || "Sem motivo informado" });
      continue;
    }
    const base = {
      key: person.key,
      censusName: person.name,
      warnings: personWarnings(person),
      person: { special: person.special, hasAee: person.hasAee, hasRegular: person.hasRegular, aeeClassName: person.aeeClassName, regularClassName: person.regularClassName, stageGroup: person.stageGroup, aeeServices: person.aeeServices },
      ...(decision ? { decision: decision.decision } : {}),
    };
    const linked = decision?.decision === "link" ? students.find((student) => student.id === decision.studentId) : undefined;
    const match = linked ? { found: linked, by: "manual" as MatchBy, sameName: [] } : decision?.decision === "create" ? { sameName: [] } : findMatch(person, students);
    if (match.found) {
      const diffs = diffsFor(person, match.found);
      items.push({ ...base, action: diffs.length ? "update" : "unchanged", studentId: match.found.id, studentName: match.found.name, matchedBy: match.by, diffs });
      continue;
    }
    const create: NewStudent = {
      name: titleCase(person.name),
      birthDate: person.birthDate,
      inepId: person.inepId || null,
      cpf: person.cpf.length === 11 ? person.cpf : null,
      hasAEE: person.hasAee,
      className: person.regularClassName || "A informar",
      stage: person.birthDate ? stageFromAge(person.birthDate, options.now) : "anos_iniciais",
    };
    if (decision?.decision === "create") {
      items.push({ ...base, action: "create", diffs: [], create });
      continue;
    }
    const elsewhere = options.elsewhere?.(identityKeys(person)) ?? false;
    if (match.sameName.length > 1 || elsewhere || !person.birthDate) {
      const warnings = [...base.warnings];
      if (match.sameName.length > 1) warnings.push("Mais de um estudante da escola tem este nome: escolha com quem vincular.");
      if (elsewhere) warnings.push("Há um estudante com os mesmos dados em outra escola da rede: pode ser transferência. Confira com a Secretaria antes de cadastrar.");
      if (!person.birthDate) warnings.push("O arquivo não tem a data de nascimento válida: confira antes de cadastrar.");
      items.push({ ...base, warnings, action: "review", diffs: [], elsewhere, candidates: match.sameName.map((student) => ({ id: student.id, name: student.name, birthDate: student.birthDate })), create });
      continue;
    }
    items.push({ ...base, action: "create", diffs: [], create });
  }
  const matched = new Set(items.flatMap((item) => (item.studentId ? [item.studentId] : [])));
  const missing = students.filter((student) => student.hasAEE && !matched.has(student.id)).map((student) => ({ id: student.id, name: student.name }));
  const count = (action: PlanItem["action"]) => items.filter((item) => item.action === action).length;
  return {
    items,
    ignored,
    missing,
    totals: {
      persons: persons.length, create: count("create"), update: count("update"), unchanged: count("unchanged"), review: count("review"),
      ignored: ignored.length, missing: missing.length, doublePending: items.filter((item) => item.person.hasAee && !item.person.hasRegular).length,
    },
  };
}

// --- Verificação: cada estudante do AEE da escola na referência do Censo ---

export type CoverageStatus = "dupla" | "sem_aee" | "sem_comum" | "sem_marcacao" | "ausente";
export const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  dupla: "Dupla matrícula no Censo: classe comum e AEE",
  sem_aee: "No Censo, mas sem matrícula no AEE",
  sem_comum: "Matrícula no AEE sem classe comum (dupla matrícula não confirmada)",
  sem_marcacao: "No Censo, mas sem a marcação de educação especial",
  ausente: "Não consta no último arquivo da escola",
};
export const COVERAGE_HINT: Record<Exclude<CoverageStatus, "dupla">, string> = {
  sem_aee: "Registre a matrícula na turma de AEE no Educacenso.",
  sem_comum: "Sem classe comum presencial nos arquivos da rede. Se o aluno estuda em escola estadual ou de outro município, a dupla matrícula pode contar, mas a plataforma não vê esse arquivo: confirme a escola da classe comum.",
  sem_marcacao: "Confira no registro da pessoa a marcação de público da educação especial.",
  ausente: "Confira nome, nascimento, CPF ou ID INEP no cadastro, ou importe um arquivo mais recente.",
};
// Problemas do vínculo que a verificação aponta junto da situação. Os bloqueantes
// fazem o Educacenso recusar o arquivo ou não importar a pessoa: o AEE não chega ao Fundeb.
export type CoverageIssue = "sem_tipo_aee" | "vinculos_demais" | "comum_nao_presencial" | "horario_coincidente" | "aee_duplicado";
export const ISSUE_LABEL: Record<CoverageIssue, string> = {
  sem_tipo_aee: "Vínculo no AEE sem tipo de atendimento: o Educacenso recusa o arquivo da escola",
  vinculos_demais: "Mais de 4 vínculos em AEE ou atividade complementar: o Educacenso não importa a pessoa",
  comum_nao_presencial: "Classe comum semipresencial ou a distância: não vale para a dupla matrícula",
  horario_coincidente: "Horário do AEE coincide com o da classe comum: confira no Educacenso",
  aee_duplicado: "Mais de um vínculo no AEE: o Fundeb conta um só",
};
export const BLOCKING_ISSUES: ReadonlySet<CoverageIssue> = new Set(["sem_tipo_aee", "vinculos_demais"]);

export function issuesOf(person: SnapshotPerson): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  if (person.aee && (person.aeeNoService ?? 0) > 0) issues.push("sem_tipo_aee");
  if ((person.activityLinks ?? 0) > 4) issues.push("vinculos_demais");
  if (person.aee && !person.regular && person.regularRemote) issues.push("comum_nao_presencial");
  if (person.overlap) issues.push("horario_coincidente");
  if ((person.aeeLinks ?? 0) > 1) issues.push("aee_duplicado");
  return issues;
}

export type CoverageRow = { id: string; name: string; status: CoverageStatus; matchedBy?: MatchBy; issues: CoverageIssue[]; regularAt?: string };
export type Coverage = { rows: CoverageRow[]; confirmed: number; pending: number; percent: number | null };

// `regularOnly`: estudantes do cadastro que, na importação, estavam no arquivo fora do
// público da educação especial (a referência não guarda as demais pessoas do arquivo).
// `regularElsewhere`: escola pública da rede em cujo arquivo a pessoa tem classe comum
// presencial (a dupla matrícula vale entre escolas e redes).
export function verifyCoverage(
  students: readonly PlatformStudent[],
  persons: readonly SnapshotPerson[],
  regularOnly: ReadonlySet<string> = new Set(),
  regularElsewhere: (keys: string[]) => string | null = () => null,
): Coverage {
  const rows: CoverageRow[] = students.filter((student) => student.hasAEE).map((student) => {
    const { found, by } = findMatch(student, persons);
    if (!found) return { id: student.id, name: student.name, status: regularOnly.has(student.id) ? "sem_marcacao" : "ausente", issues: [] };
    const issues = issuesOf(found);
    if (!found.aee) return { id: student.id, name: student.name, status: "sem_aee", matchedBy: by, issues };
    if (found.regular) return { id: student.id, name: student.name, status: "dupla", matchedBy: by, issues };
    const elsewhere = regularElsewhere([...identityKeys(found), ...identityKeys(student)]);
    return elsewhere
      ? { id: student.id, name: student.name, status: "dupla", matchedBy: by, issues, regularAt: elsewhere }
      : { id: student.id, name: student.name, status: "sem_comum", matchedBy: by, issues };
  });
  const confirmed = rows.filter((row) => row.status === "dupla" && !row.issues.some((issue) => BLOCKING_ISSUES.has(issue))).length;
  return { rows, confirmed, pending: rows.length - confirmed, percent: rows.length ? Math.round((confirmed / rows.length) * 100) : null };
}

// Na importação: estudantes do cadastro que aparecem no arquivo, mas fora do público da educação especial.
export function regularOnlyIds(students: readonly PlatformStudent[], allPersons: readonly CensusPerson[]): string[] {
  const outside = allPersons.filter((person) => person.enrolled && !person.special && !person.hasAee);
  return students.filter((student) => findMatch(student, outside).found).map((student) => student.id);
}

// --- Contagens do arquivo e comparação com o FNDE ---

// duplaByStage: AEE com classe comum por etapa agregada (301 infantil, 302 fundamental...).
export type CensusCounts = { especial: number; aee: number; dupla: number; aeeSemComum: number; especialSemAee: number; duplaByStage: Record<string, number> };
export function censusCounts(persons: readonly SnapshotPerson[]): CensusCounts {
  const dupla = persons.filter((person) => person.aee && person.regular);
  const duplaByStage: Record<string, number> = {};
  for (const person of dupla) duplaByStage[person.stage || "?"] = (duplaByStage[person.stage || "?"] ?? 0) + 1;
  return {
    especial: persons.filter((person) => person.special).length,
    aee: persons.filter((person) => person.aee).length,
    dupla: dupla.length,
    aeeSemComum: persons.filter((person) => person.aee && !person.regular).length,
    especialSemAee: persons.filter((person) => person.special && !person.aee).length,
    duplaByStage,
  };
}
export function sumCounts(list: readonly CensusCounts[]): CensusCounts {
  const total: CensusCounts = { especial: 0, aee: 0, dupla: 0, aeeSemComum: 0, especialSemAee: 0, duplaByStage: {} };
  for (const item of list) {
    total.especial += item.especial; total.aee += item.aee; total.dupla += item.dupla; total.aeeSemComum += item.aeeSemComum; total.especialSemAee += item.especialSemAee;
    for (const [stage, count] of Object.entries(item.duplaByStage ?? {})) total.duplaByStage[stage] = (total.duplaByStage[stage] ?? 0) + count;
  }
  return total;
}

// --- Fundeb: a escola e a estimativa do AEE considerado na rede ---

export type SchoolInfo = { dependency: Dependency; privateCategory: string; municipalPartnership: boolean };
const PUBLIC: ReadonlySet<Dependency> = new Set(["municipal", "estadual"]);

// O que a dependência da escola (registro 00) muda no Fundeb: o AEE conta para a
// rede que o oferece, e a classe comum precisa ser de escola pública (NT Conjunta nº 12/2025).
export function schoolFundebNote(info: SchoolInfo): { tone: "ok" | "atencao" | "fora"; text: string } {
  if (info.dependency === "municipal") return { tone: "ok", text: "Escola municipal: o AEE oferecido aqui conta para a rede municipal, e a classe comum daqui vale para a dupla matrícula." };
  if (info.dependency === "estadual") return { tone: "atencao", text: "Escola estadual: o AEE oferecido aqui conta para a rede estadual, não para a municipal. A classe comum daqui vale para a dupla matrícula." };
  if (info.dependency === "federal") return { tone: "fora", text: "Escola federal: o AEE oferecido aqui não entra no Fundeb, e a classe comum daqui não vale para a dupla matrícula." };
  if (info.dependency === "privada") {
    return ["2", "3", "4"].includes(info.privateCategory) && info.municipalPartnership
      ? { tone: "atencao", text: "Escola comunitária, confessional ou filantrópica conveniada com a Secretaria Municipal: o AEE daqui só conta se a instituição atuar exclusivamente em educação especial. A classe comum de escola privada não vale para a dupla matrícula." }
      : { tone: "fora", text: "Escola privada sem convênio com a Secretaria Municipal: o AEE e a classe comum daqui não entram no Fundeb da rede." };
  }
  return { tone: "atencao", text: "O arquivo não informa a dependência administrativa da escola (registro 00, campo 21): não dá para saber se o AEE daqui conta." };
}

export type NetworkSchool = { id?: string; name: string; info: SchoolInfo; persons: readonly SnapshotPerson[] };
export type AeeEstimate = {
  considered: number; // AEE que o FNDE deve considerar para a rede municipal
  byStage: Record<string, number>; // pela etapa da classe comum
  notVerifiable: number; // sem classe comum pública presencial nos arquivos da rede
  blocked: number; // vínculos que o Educacenso recusa ou não importa
  repeated: number; // alunos com AEE em mais de uma escola: contam uma vez
  otherNetwork: number; // AEE em escola estadual: conta para o estado
  partner: number; // AEE em instituição conveniada: depende da atuação exclusiva
};

// Estimativa pelas regras do FNDE, a partir dos arquivos aplicados: aluno do
// público da educação especial, vínculo de AEE aceito pelo Educacenso em escola
// municipal e classe comum presencial em escola pública (no mesmo arquivo ou em
// outro da rede), contado uma vez por aluno. É estimativa: a rede não vê os
// arquivos do estado nem de outros municípios. `countOnly` conta só o AEE de uma
// escola, mas procura a classe comum em toda a rede.
export function networkAeeEstimate(schools: readonly NetworkSchool[], countOnly?: string): AeeEstimate {
  const regular = new Map<string, string>();
  for (const school of schools.filter((item) => PUBLIC.has(item.info.dependency))) {
    for (const person of school.persons.filter((item) => item.regular)) for (const key of identityKeys(person)) if (!regular.has(key)) regular.set(key, person.stage);
  }
  const estimate: AeeEstimate = { considered: 0, byStage: {}, notVerifiable: 0, blocked: 0, repeated: 0, otherNetwork: 0, partner: 0 };
  const seen = new Set<string>();
  // Escolas municipais primeiro: o AEE conta para a rede que o oferece.
  const ordered = [...schools].sort((a, b) => Number(b.info.dependency === "municipal") - Number(a.info.dependency === "municipal"));
  for (const school of ordered.filter((item) => !countOnly || item.id === countOnly)) {
    for (const person of school.persons.filter((item) => item.aee)) {
      const keys = identityKeys(person);
      if (keys.some((key) => seen.has(key))) { estimate.repeated += 1; continue; }
      keys.forEach((key) => seen.add(key));
      if (school.info.dependency === "estadual") { estimate.otherNetwork += 1; continue; }
      if (school.info.dependency === "privada") { estimate.partner += 1; continue; }
      if (school.info.dependency !== "municipal") continue;
      if (!person.special || issuesOf(person).some((issue) => BLOCKING_ISSUES.has(issue))) { estimate.blocked += 1; continue; }
      const stage = person.regular ? person.stage : keys.map((key) => regular.get(key)).find((value) => value !== undefined);
      if (stage === undefined) { estimate.notVerifiable += 1; continue; }
      estimate.considered += 1;
      estimate.byStage[stage || "?"] = (estimate.byStage[stage || "?"] ?? 0) + 1;
    }
  }
  return estimate;
}

// O FNDE publica as matrículas de AEE consideradas no Fundeb; a diferença pede conferência, não prova perda.
export function fundebComparison(estimate: number, fnde: number | null): { difference: number | null; text: string } {
  if (fnde === null) return { difference: null, text: "Informe as matrículas de AEE que o FNDE considerou para comparar com a estimativa dos arquivos." };
  const difference = estimate - fnde;
  if (difference === 0) return { difference, text: "As contagens batem: a estimativa dos arquivos, pelas regras do FNDE, dá o mesmo número de matrículas de AEE que o FNDE considerou." };
  if (difference > 0) return { difference, text: `Pelas regras do FNDE, os arquivos indicam ${difference} ${difference === 1 ? "matrícula" : "matrículas"} de AEE a mais do que o FNDE considerou. Confira a situação de cada uma no Educacenso: a diferença sozinha não comprova perda.` };
  return { difference, text: `O FNDE considerou ${-difference} ${difference === -1 ? "matrícula" : "matrículas"} de AEE a mais do que a estimativa dos arquivos. Falta o arquivo de alguma escola, a referência está desatualizada ou a classe comum está em outra rede.` };
}

// --- Janela do Censo e monitor (horário de Brasília, sem horário de verão desde 2019) ---

export type MonitorConfig = { enabled: boolean; periodStart: string; periodEnd: string; times: string[] };
export type MonitorStatus = "ativo" | "aguardando" | "fora" | "desligado";
// Matrícula inicial: data de referência na última quarta-feira de maio, coleta e retificação até o fim de agosto.
export const DEFAULT_MONITOR: MonitorConfig = { enabled: true, periodStart: "2027-05-26", periodEnd: "2027-08-31", times: ["08:00", "16:00"] };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_WINDOW_DAYS = 400;
export const brDayOf = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const validDay = (value: string) => DAY_PATTERN.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const nextDay = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const brDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
export const brMoment = (date: Date) => `${brDate(brDayOf(date))} às ${date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`;

export function cleanMonitorConfig(raw: { enabled: boolean; periodStart: string; periodEnd: string; times: string[] }): MonitorConfig | { error: string } {
  const times = [...new Set(raw.times.map((time) => time.trim()).filter(Boolean))].sort();
  if (!validDay(raw.periodStart) || !validDay(raw.periodEnd)) return { error: "Informe as datas de início e fim da janela." };
  if (raw.periodStart > raw.periodEnd) return { error: "O fim da janela vem antes do início." };
  if ((Date.parse(raw.periodEnd) - Date.parse(raw.periodStart)) / 86_400_000 > MAX_WINDOW_DAYS) return { error: "A janela tem mais de 400 dias: confira as datas." };
  if (!times.length || times.length > 4 || !times.every((time) => TIME_PATTERN.test(time))) return { error: "Informe de 1 a 4 horários, como 08:00." };
  return { enabled: raw.enabled, periodStart: raw.periodStart, periodEnd: raw.periodEnd, times };
}

// Próximo horário da janela depois de `now`; null fora da janela ou com o monitor desligado.
export function nextRun(config: MonitorConfig, now: Date): Date | null {
  if (!config.enabled || !validDay(config.periodStart) || !validDay(config.periodEnd)) return null;
  const times = [...new Set(config.times.filter((time) => TIME_PATTERN.test(time)))].sort();
  if (!times.length) return null;
  const today = brDayOf(now);
  let day = today > config.periodStart ? today : config.periodStart;
  for (let step = 0; step <= MAX_WINDOW_DAYS && day <= config.periodEnd; step += 1, day = nextDay(day)) {
    for (const time of times) {
      const candidate = new Date(`${day}T${time}:00-03:00`);
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }
  return null;
}

export const inWindow = (config: MonitorConfig, now: Date) => brDayOf(now) >= config.periodStart && brDayOf(now) <= config.periodEnd;

export function monitorState(config: MonitorConfig, now: Date, lastRunAt: Date | null): { status: MonitorStatus; title: string; text: string; nextRunAt: Date | null } {
  if (!config.enabled) return { status: "desligado", title: "Monitor desligado", text: "Nenhuma verificação automática. Ligue o monitor para conferir o Censo nos horários da janela.", nextRunAt: null };
  const next = nextRun(config, now);
  if (!next) {
    const since = lastRunAt ? `Última verificação em ${brMoment(lastRunAt)}.` : "Nenhuma verificação nesta janela.";
    return { status: "fora", title: "Fora da janela do Censo", text: `${since} A janela terminou em ${brDate(config.periodEnd)}: configure a do próximo Censo.`, nextRunAt: null };
  }
  if (brDayOf(now) < config.periodStart) return { status: "aguardando", title: "Aguardando a janela do Censo", text: `A janela começa em ${brDate(config.periodStart)}. Primeira verificação: ${brMoment(next)}.`, nextRunAt: next };
  return { status: "ativo", title: "Monitor ativo", text: `Próxima verificação: ${brMoment(next)}. Janela de ${brDate(config.periodStart)} a ${brDate(config.periodEnd)}.`, nextRunAt: next };
}
