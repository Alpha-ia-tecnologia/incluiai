// Arquivo de migração do Educacenso (Censo Escolar), puro para teste com
// node --test (src/lib/educacenso.test.mjs). O INEP não tem API pública: a
// troca oficial é o arquivo TXT com campos separados por "|", que o sistema de
// gestão da escola exporta (ISO-8859-1). Aqui se leem os registros do AEE:
//   00 escola · 20 turma · 30 pessoa física · 60 matrícula
//
// Posições conferidas nas planilhas oficiais do INEP, "Layout de Importação e
// Exportação do Educacenso" 2025 (Matrícula Inicial, versão 2) e 2026. A edição
// sai do número de campos de cada registro; "campo N" = índice N-1 do split.

export type Edition = 2025 | 2026;
export type Dependency = "federal" | "estadual" | "municipal" | "privada" | "";
// Escola (registro 00): dependência administrativa (campo 21), categoria da escola
// privada (32: 1 particular, 2 comunitária, 3 confessional, 4 filantrópica) e
// parceria ou convênio com a Secretaria Municipal (34).
export type CensusSchool = { code: string; name: string; dependency: Dependency; privateCategory: string; municipalPartnership: boolean };
type Interval = [number, number]; // minutos do dia, de [início, fim)
export type CensusClass = {
  systemCode: string;
  inepCode: string;
  name: string;
  isAee: boolean;
  isRegular: boolean; // curricular, não é classe especial e é presencial
  isRemoteRegular: boolean; // curricular e não é classe especial, mas semipresencial ou a distância
  isComplementary: boolean; // atividade complementar
  stageGroup: string;
  schedule: Interval[]; // um intervalo por dia (0 = domingo); [0, 0] sem aula
};
export type CensusPerson = {
  key: string;
  systemCode: string;
  inepId: string;
  cpf: string;
  name: string;
  birthDate: string; // AAAA-MM-DD
  special: boolean; // público da educação especial (registro 30, campo 17)
  hasAee: boolean; // matrícula em turma de AEE
  hasRegular: boolean; // matrícula presencial em classe comum (curricular que não é classe especial)
  regularRemote: boolean; // só tem classe comum semipresencial ou a distância
  enrolled: boolean; // tem matrícula de aluno (o registro 30 também traz gestores e professores)
  aeeClassName: string;
  regularClassName: string;
  stageGroup: string; // etapa agregada da classe comum (301 a 308)
  aeeServices: string[];
  aeeLinks: number; // vínculos em turmas de AEE
  aeeLinksWithoutService: number; // vínculos de AEE sem nenhum tipo de atendimento marcado
  activityLinks: number; // vínculos em AEE ou atividade complementar (o Educacenso aceita até 4)
  scheduleOverlap: boolean; // horário do AEE coincide com o da classe comum em algum dia
};
export type ParseStats = { totalLines: number; parsed: Record<string, number>; skipped: { line: number; reason: string }[] };
export type ParsedCensusFile = { edition: Edition; school: CensusSchool | null; classes: CensusClass[]; persons: CensusPerson[]; stats: ParseStats };

// Campos que não mudaram entre 2025 e 2026.
const COMMON = {
  school: { code: 2, name: 6, dependency: 21, privateCategory: 32, municipalPartnership: 34 },
  schoolClass: { systemCode: 3, inepCode: 4, name: 5, mediation: 6, scheduleStart: 7 },
  person: { systemCode: 3, inepId: 4, cpf: 5, name: 6, birthDate: 7, specialFlag: 17, specialTypesStart: 18, specialTypesCount: 11 },
  enrollment: { personSystemCode: 3, personInepId: 4, classSystemCode: 5, classInepCode: 6 },
};
// 2025: tipo de turma em marcações (14 curricular, 15 atividade complementar, 16 AEE).
// 2026: um código no campo 14 (4 atividade complementar, 5 AEE, 6 curricular,
// 9 curricular com atividade complementar). Em 2026, o campo 9 do registro 60
// (carga horária) empurrou o bloco do AEE para 10–20.
export const LAYOUT = {
  2025: { fields: { "00": 56, "20": 70, "30": 108, "60": 32 }, classCurricular: 14, classComplementary: 15, classAee: 16, specialClass: 24, stageGroup: 25, aeeServicesStart: 9 },
  2026: { fields: { "00": 53, "20": 66, "30": 110, "60": 33 }, classType: 14, specialClass: 22, stageGroup: 23, aeeServicesStart: 10 },
} as const;

const DEPENDENCIES: Record<string, Dependency> = { "1": "federal", "2": "estadual", "3": "municipal", "4": "privada" };

export const STAGE_GROUPS: Record<string, string> = {
  "301": "Educação infantil",
  "302": "Ensino fundamental",
  "303": "Multietapa e correção de fluxo",
  "304": "Ensino médio",
  "305": "Ensino médio normal/magistério",
  "306": "Educação de jovens e adultos",
  "308": "Curso técnico ou FIC",
};

// Registro 60: tipos de atendimento do AEE, na ordem do leiaute.
export const AEE_SERVICE_LABELS = [
  "Desenvolvimento de funções cognitivas",
  "Desenvolvimento de vida autônoma",
  "Enriquecimento curricular",
  "Ensino da informática acessível",
  "Ensino de Libras",
  "Ensino da Língua Portuguesa como segunda língua",
  "Ensino do cálculo no Soroban",
  "Ensino do Sistema Braille",
  "Orientação e mobilidade",
  "Comunicação alternativa e aumentativa (CAA)",
  "Recursos ópticos e não ópticos",
];

const field = (fields: string[], position: number) => (fields[position - 1] ?? "").trim();
const flag = (fields: string[], position: number) => field(fields, position) === "1";

export const normalizeName = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function toIsoDate(brazilian: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brazilian.trim());
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day) ? `${year}-${month}-${day}` : "";
}

// Nome do Censo (maiúsculas) para o cadastro: "MARIA DA SILVA" vira "Maria da Silva".
const PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);
export function titleCase(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim().split(" ").map((word, index) => (index > 0 && PARTICLES.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))).join(" ");
}

// Horário de um dia da turma ("hh:mm-hh:mm"), em minutos; [0, 0] sem aula ou inválido.
export function parseInterval(value: string): Interval {
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return [0, 0];
  const [start, end] = [Number(match[1]) * 60 + Number(match[2]), Number(match[3]) * 60 + Number(match[4])];
  return start < end && end <= 24 * 60 ? [start, end] : [0, 0];
}

// Duas turmas coincidem quando, em algum dia, os horários se cruzam.
export const schedulesOverlap = (a: Interval[], b: Interval[]) => a.some(([start, end], day) => end > start && (b[day]?.[1] ?? 0) > start && (b[day]?.[0] ?? 0) < end && b[day][1] > b[day][0]);

function parseClass(fields: string[], edition: Edition): CensusClass | null {
  const layout = COMMON.schoolClass;
  const systemCode = field(fields, layout.systemCode);
  const inepCode = field(fields, layout.inepCode);
  const name = field(fields, layout.name);
  if (!systemCode && !inepCode) return null;
  let isAee: boolean;
  let isCurricular: boolean;
  let isComplementary: boolean;
  if (edition === 2026) {
    const type = field(fields, LAYOUT[2026].classType);
    isAee = type === "5";
    isCurricular = type === "6" || type === "9";
    isComplementary = type === "4";
  } else {
    isAee = flag(fields, LAYOUT[2025].classAee);
    isCurricular = flag(fields, LAYOUT[2025].classCurricular);
    isComplementary = flag(fields, LAYOUT[2025].classComplementary);
  }
  // Sem o tipo de turma preenchido, o nome decide: sala de recursos é AEE; o resto, classe comum.
  if (!isAee && !isCurricular && !isComplementary) {
    isAee = /\bAEE\b|SALA DE RECURSOS/i.test(name);
    isCurricular = !isAee && !/ATIVIDADE COMPLEMENTAR/i.test(name);
  }
  const edLayout = LAYOUT[edition];
  // Mediação vazia: o arquivo é antigo ou incompleto; conta como presencial.
  const presential = ["", "1"].includes(field(fields, layout.mediation));
  // Classe especial não é classe comum: não confirma a dupla matrícula.
  const common = isCurricular && !flag(fields, edLayout.specialClass);
  return {
    systemCode, inepCode, name: name || "Turma sem nome", isAee,
    isRegular: common && presential, isRemoteRegular: common && !presential, isComplementary,
    stageGroup: isCurricular ? field(fields, edLayout.stageGroup) : "",
    schedule: Array.from({ length: 7 }, (_, day) => parseInterval(field(fields, layout.scheduleStart + day))),
  };
}

function parsePerson(fields: string[]): CensusPerson | null {
  const layout = COMMON.person;
  const name = field(fields, layout.name);
  if (name.length < 3) return null;
  const types = Array.from({ length: layout.specialTypesCount }, (_, index) => flag(fields, layout.specialTypesStart + index));
  return {
    key: "",
    systemCode: field(fields, layout.systemCode),
    inepId: digitsOnly(field(fields, layout.inepId)),
    cpf: digitsOnly(field(fields, layout.cpf)),
    name,
    birthDate: toIsoDate(field(fields, layout.birthDate)),
    special: flag(fields, layout.specialFlag) || types.some(Boolean),
    hasAee: false,
    hasRegular: false,
    regularRemote: false,
    enrolled: false,
    aeeClassName: "",
    regularClassName: "",
    stageGroup: "",
    aeeServices: [],
    aeeLinks: 0,
    aeeLinksWithoutService: 0,
    activityLinks: 0,
    scheduleOverlap: false,
  };
}

type State = {
  edition: Edition;
  stats: ParseStats;
  persons: Map<string, CensusPerson>;
  classes: Map<string, CensusClass>;
  ordered: CensusPerson[];
  orderedClasses: CensusClass[];
  school: CensusSchool | null;
  // Horários de cada pessoa, para conferir no fim se AEE e classe comum coincidem.
  schedules: Map<CensusPerson, { aee: Interval[][]; regular: Interval[][] }>;
};

const skip = (state: State, line: number, reason: string) => {
  if (state.stats.skipped.length < 20) state.stats.skipped.push({ line, reason });
};

function attachEnrollment(state: State, fields: string[]): string | null {
  const layout = COMMON.enrollment;
  const person = state.persons.get(`inep:${digitsOnly(field(fields, layout.personInepId))}`) ?? state.persons.get(`sys:${field(fields, layout.personSystemCode)}`);
  if (!person) return "Matrícula (registro 60) de uma pessoa que não está no arquivo.";
  const schoolClass = state.classes.get(`inep:${field(fields, layout.classInepCode)}`) ?? state.classes.get(`sys:${field(fields, layout.classSystemCode)}`);
  if (!schoolClass) return "Matrícula (registro 60) de uma turma que não está no arquivo.";
  person.enrolled = true;
  const schedules = state.schedules.get(person) ?? { aee: [], regular: [] };
  state.schedules.set(person, schedules);
  if (schoolClass.isAee || schoolClass.isComplementary) person.activityLinks += 1;
  if (schoolClass.isAee) {
    person.hasAee = true;
    person.aeeLinks += 1;
    person.aeeClassName ||= schoolClass.name;
    const start = LAYOUT[state.edition].aeeServicesStart;
    const services = AEE_SERVICE_LABELS.filter((_, index) => flag(fields, start + index));
    if (!services.length) person.aeeLinksWithoutService += 1;
    person.aeeServices = [...new Set([...person.aeeServices, ...services])];
    schedules.aee.push(schoolClass.schedule);
  }
  if (schoolClass.isRegular) {
    person.hasRegular = true;
    person.regularClassName ||= schoolClass.name;
    person.stageGroup ||= schoolClass.stageGroup;
    schedules.regular.push(schoolClass.schedule);
  } else if (schoolClass.isRemoteRegular) {
    person.regularRemote = true;
    person.regularClassName ||= schoolClass.name;
    person.stageGroup ||= schoolClass.stageGroup;
  }
  return null;
}

function readLine(state: State, raw: string, index: number) {
  const line = raw.trim();
  if (!line) return;
  state.stats.totalLines += 1;
  const fields = line.split("|");
  const type = field(fields, 1);
  state.stats.parsed[type] = (state.stats.parsed[type] ?? 0) + 1;
  if (type === "00") {
    const layout = COMMON.school;
    const code = digitsOnly(field(fields, layout.code));
    if (!code) skip(state, index + 1, "Registro 00 sem o código INEP da escola.");
    else state.school ??= {
      code, name: field(fields, layout.name) || "Escola sem nome no arquivo",
      dependency: DEPENDENCIES[field(fields, layout.dependency)] ?? "",
      privateCategory: field(fields, layout.privateCategory),
      municipalPartnership: flag(fields, layout.municipalPartnership),
    };
  } else if (type === "20") {
    const schoolClass = parseClass(fields, state.edition);
    if (!schoolClass) return skip(state, index + 1, "Registro 20 sem código de turma.");
    if (schoolClass.systemCode) state.classes.set(`sys:${schoolClass.systemCode}`, schoolClass);
    if (schoolClass.inepCode) state.classes.set(`inep:${schoolClass.inepCode}`, schoolClass);
    state.orderedClasses.push(schoolClass);
  } else if (type === "30") {
    const person = parsePerson(fields);
    if (!person) return skip(state, index + 1, "Registro 30 sem nome válido.");
    if ((person.systemCode && state.persons.has(`sys:${person.systemCode}`)) || (person.inepId && state.persons.has(`inep:${person.inepId}`))) return skip(state, index + 1, `Registro 30 repetido para ${person.name}.`);
    if (person.systemCode) state.persons.set(`sys:${person.systemCode}`, person);
    if (person.inepId) state.persons.set(`inep:${person.inepId}`, person);
    state.ordered.push(person);
  } else if (type === "60") {
    const problem = attachEnrollment(state, fields);
    if (problem) skip(state, index + 1, problem);
  }
  // Registros 10 (infraestrutura), 40 (gestor), 50 (profissional) e 99 não interessam aqui.
}

// A edição sai do número de campos dos registros 00, 20 e 60 (um "|" no fim da
// linha conta um campo a mais). Sem contagem conhecida, decide o tipo de turma.
export function detectEdition(lines: string[][]): Edition {
  const votes = { 2025: 0, 2026: 0 };
  for (const fields of lines) {
    const type = field(fields, 1) as "00" | "20" | "60";
    for (const edition of [2025, 2026] as const) {
      const expected = (LAYOUT[edition].fields as Record<string, number>)[type];
      if (expected && (fields.length === expected || (fields.length === expected + 1 && fields.at(-1) === ""))) votes[edition] += 1;
    }
  }
  if (votes[2025] !== votes[2026]) return votes[2026] > votes[2025] ? 2026 : 2025;
  const classTypes = lines.filter((fields) => field(fields, 1) === "20").map((fields) => field(fields, 14));
  return classTypes.some((value) => ["4", "5", "6", "9"].includes(value)) ? 2026 : 2025;
}

export function parseEducacensoFile(content: string): ParsedCensusFile {
  // O arquivo começa no "00": um BOM (ou o "ÿ" que ele vira em ISO-8859-1) sai antes.
  const lines = content.replace(/^\D+/, "").split(/\r?\n/);
  const edition = detectEdition(lines.map((line) => line.trim()).filter(Boolean).map((line) => line.split("|")));
  const state: State = { edition, stats: { totalLines: 0, parsed: {}, skipped: [] }, persons: new Map(), classes: new Map(), ordered: [], orderedClasses: [], school: null, schedules: new Map() };
  lines.forEach((raw, index) => readLine(state, raw, index));
  for (const [person, { aee, regular }] of state.schedules) {
    person.scheduleOverlap = aee.some((aeeSchedule) => regular.some((regularSchedule) => schedulesOverlap(aeeSchedule, regularSchedule)));
  }
  const used = new Set<string>();
  for (const person of state.ordered) {
    const base = person.inepId || person.cpf || `${normalizeName(person.name)}|${person.birthDate}`;
    let key = base;
    for (let suffix = 2; used.has(key); suffix += 1) key = `${base}#${suffix}`;
    used.add(key);
    person.key = key;
  }
  return { edition, school: state.school, classes: state.orderedClasses, persons: state.ordered, stats: state.stats };
}

// Quem interessa ao AEE: aluno do público da educação especial ou com matrícula no AEE.
export const specialEdPersons = (parsed: ParsedCensusFile) => parsed.persons.filter((person) => person.enrolled && (person.special || person.hasAee));

// Chaves de identidade para conciliar com o cadastro: ID INEP, CPF, nome com nascimento.
export function identityKeys(person: { inepId?: string | null; cpf?: string | null; name: string; birthDate?: string | null }): string[] {
  const keys: string[] = [];
  if (person.inepId) keys.push(`inep:${digitsOnly(person.inepId)}`);
  if (person.cpf && digitsOnly(person.cpf).length === 11) keys.push(`cpf:${digitsOnly(person.cpf)}`);
  if (person.birthDate) keys.push(`nb:${normalizeName(person.name)}|${person.birthDate}`);
  return keys;
}
