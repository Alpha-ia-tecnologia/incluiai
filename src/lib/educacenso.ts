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
export type CensusSchool = { code: string; name: string };
export type CensusClass = { systemCode: string; inepCode: string; name: string; isAee: boolean; isRegular: boolean; stageGroup: string };
export type CensusPerson = {
  key: string;
  systemCode: string;
  inepId: string;
  cpf: string;
  name: string;
  birthDate: string; // AAAA-MM-DD
  special: boolean; // público da educação especial (registro 30, campo 17)
  hasAee: boolean; // matrícula em turma de AEE
  hasRegular: boolean; // matrícula em classe comum (turma curricular que não é classe especial)
  enrolled: boolean; // tem matrícula de aluno (o registro 30 também traz gestores e professores)
  aeeClassName: string;
  regularClassName: string;
  stageGroup: string; // etapa agregada da classe comum (301 a 308)
  aeeServices: string[];
};
export type ParseStats = { totalLines: number; parsed: Record<string, number>; skipped: { line: number; reason: string }[] };
export type ParsedCensusFile = { edition: Edition; school: CensusSchool | null; classes: CensusClass[]; persons: CensusPerson[]; stats: ParseStats };

// Campos que não mudaram entre 2025 e 2026.
const COMMON = {
  school: { code: 2, name: 6 },
  schoolClass: { systemCode: 3, inepCode: 4, name: 5 },
  person: { systemCode: 3, inepId: 4, cpf: 5, name: 6, birthDate: 7, specialFlag: 17, specialTypesStart: 18, specialTypesCount: 11 },
  enrollment: { personSystemCode: 3, personInepId: 4, classSystemCode: 5, classInepCode: 6 },
};
// 2025: tipo de turma em marcações (14 curricular, 16 AEE). 2026: um código no campo 14
// (4 atividade complementar, 5 AEE, 6 curricular, 9 curricular com atividade complementar).
// Em 2026, o campo 9 do registro 60 (carga horária) empurrou o bloco do AEE para 10–20.
export const LAYOUT = {
  2025: { fields: { "00": 56, "20": 70, "30": 108, "60": 32 }, classCurricular: 14, classAee: 16, specialClass: 24, stageGroup: 25, aeeServicesStart: 9 },
  2026: { fields: { "00": 53, "20": 66, "30": 110, "60": 33 }, classType: 14, specialClass: 22, stageGroup: 23, aeeServicesStart: 10 },
} as const;

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

export const normalizeName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
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

function parseClass(fields: string[], edition: Edition): CensusClass | null {
  const systemCode = field(fields, COMMON.schoolClass.systemCode);
  const inepCode = field(fields, COMMON.schoolClass.inepCode);
  const name = field(fields, COMMON.schoolClass.name);
  if (!systemCode && !inepCode) return null;
  let isAee: boolean;
  let isCurricular: boolean;
  if (edition === 2026) {
    const type = field(fields, LAYOUT[2026].classType);
    isAee = type === "5";
    isCurricular = type === "6" || type === "9";
  } else {
    isAee = flag(fields, LAYOUT[2025].classAee);
    isCurricular = flag(fields, LAYOUT[2025].classCurricular);
  }
  // Sem o tipo de turma preenchido, o nome decide: sala de recursos é AEE; o resto, classe comum.
  if (!isAee && !isCurricular) {
    isAee = /\bAEE\b|SALA DE RECURSOS/i.test(name);
    isCurricular = !isAee && !/ATIVIDADE COMPLEMENTAR/i.test(name);
  }
  const layout = LAYOUT[edition];
  // Classe especial não é classe comum: não confirma a dupla matrícula.
  const isRegular = isCurricular && !flag(fields, layout.specialClass);
  return { systemCode, inepCode, name: name || "Turma sem nome", isAee, isRegular, stageGroup: isCurricular ? field(fields, layout.stageGroup) : "" };
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
    enrolled: false,
    aeeClassName: "",
    regularClassName: "",
    stageGroup: "",
    aeeServices: [],
  };
}

type State = { edition: Edition; stats: ParseStats; persons: Map<string, CensusPerson>; classes: Map<string, CensusClass>; ordered: CensusPerson[]; orderedClasses: CensusClass[]; school: CensusSchool | null };

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
  if (schoolClass.isAee) {
    person.hasAee = true;
    person.aeeClassName ||= schoolClass.name;
    const start = LAYOUT[state.edition].aeeServicesStart;
    const services = AEE_SERVICE_LABELS.filter((_, index) => flag(fields, start + index));
    person.aeeServices = [...new Set([...person.aeeServices, ...services])];
  }
  if (schoolClass.isRegular) {
    person.hasRegular = true;
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
    const code = digitsOnly(field(fields, COMMON.school.code));
    if (!code) skip(state, index + 1, "Registro 00 sem o código INEP da escola.");
    else state.school ??= { code, name: field(fields, COMMON.school.name) || "Escola sem nome no arquivo" };
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
  const state: State = { edition, stats: { totalLines: 0, parsed: {}, skipped: [] }, persons: new Map(), classes: new Map(), ordered: [], orderedClasses: [], school: null };
  lines.forEach((raw, index) => readLine(state, raw, index));
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
