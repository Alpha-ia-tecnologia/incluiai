import { prisma } from "../prisma";
import { canAccessStudent, type SessionUser } from "../auth";
import { PATTERNS, escape, isYearRange, nameTokens, naturalizePlaceholders } from "../agents/anonymize";

// Privacidade do assistente (LGPD). O modelo nunca recebe nomes: cada
// estudante vira um pseudônimo estável dentro da conversa ([ESTUDANTE 1],
// [ESTUDANTE 2]...), cada escola vira [ESCOLA 1]..., e familiares,
// profissionais, contatos e documentos viram os marcadores de sempre. Na
// tela, os pseudônimos voltam a ser os nomes reais, só para quem já tem
// acesso a esses estudantes. O mapa fica guardado na conversa e só cresce,
// para o histórico enviado ao modelo continuar coerente.

export type PseudonymMap = { students: Record<string, number>; schools: Record<string, number> };

export type Pseudonymizer = {
  map: PseudonymMap;
  changed: boolean;
  studentLabel: (studentId: string) => string;
  schoolLabel: (schoolId: string) => string;
  // Nomes e contatos → pseudônimos e marcadores (tudo o que vai ao modelo).
  apply: (text: string) => string;
  // Pseudônimos → nomes (tudo o que vai à tela).
  restore: (text: string) => string;
};

export function parsePseudonyms(value: string | null | undefined): PseudonymMap {
  try {
    const parsed = value ? (JSON.parse(value) as Partial<PseudonymMap>) : {};
    return { students: parsed.students ?? {}, schools: parsed.schools ?? {} };
  } catch {
    return { students: {}, schools: {} };
  }
}

type Rule = { regex: RegExp; replacement: string };

// Um mesmo termo que aponta para duas pessoas (dois estudantes chamados Ana,
// ou uma estudante e uma professora Beatriz) vira [PESSOA]: melhor um papel
// desconhecido do que o papel errado. O nome completo continua exato.
function nameRules(entries: [string, string, boolean][]): Rule[] {
  const byTerm = new Map<string, [string, string, boolean]>();
  for (const entry of entries) {
    if (entry[0].length < 3) continue;
    const key = entry[0].toLowerCase();
    const existing = byTerm.get(key);
    if (!existing) byTerm.set(key, entry);
    else if (existing[1] !== entry[1]) byTerm.set(key, [existing[0], "[PESSOA]", existing[2]]);
  }
  return [...byTerm.values()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([term, replacement, caseSensitive]) => ({
      replacement,
      regex: new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${caseSensitive ? `${escape(term)}|${escape(term.toUpperCase())}` : escape(term)})(?![\\p{L}\\p{N}])`,
        caseSensitive ? "gu" : "giu",
      ),
    }));
}

export function createPseudonymizer(input: {
  map: PseudonymMap;
  students: { id: string; name: string }[];
  schools: { id: string; name: string }[];
  family: string[];
  professionals: string[];
}): Pseudonymizer {
  const map: PseudonymMap = { students: { ...input.map.students }, schools: { ...input.map.schools } };
  let changed = false;
  const assign = (table: Record<string, number>, id: string) => {
    if (!table[id]) {
      table[id] = Math.max(0, ...Object.values(table)) + 1;
      changed = true;
    }
    return table[id];
  };
  for (const student of input.students) assign(map.students, student.id);
  for (const school of input.schools) assign(map.schools, school.id);
  const studentLabel = (id: string) => `[ESTUDANTE ${map.students[id] ?? "?"}]`;
  const schoolLabel = (id: string) => `[ESCOLA ${map.schools[id] ?? "?"}]`;

  // Nome completo em qualquer grafia e cada parte do nome (inicial maiúscula
  // ou tudo em maiúsculas). Um primeiro nome compartilhado por dois
  // estudantes fica com o primeiro da lista: limite conhecido.
  const entries: [string, string, boolean][] = [];
  for (const student of input.students) {
    const tokens = nameTokens(student.name);
    // Nome completo e cada começo dele ("Ana Clara" de "Ana Clara Souza"), em qualquer grafia; partes soltas só com inicial maiúscula.
    for (let length = tokens.length; length >= 2; length--) entries.push([tokens.slice(0, length).join(" "), studentLabel(student.id), false]);
    for (const token of tokens) entries.push([token, studentLabel(student.id), true]);
  }
  const addPerson = (name: string, replacement: string) => {
    const tokens = nameTokens(name);
    if (tokens.length >= 2) entries.push([tokens.join(" "), replacement, false]);
    if (tokens[0]) entries.push([tokens[0], replacement, true]);
  };
  for (const name of input.family) addPerson(name, "[FAMILIAR]");
  for (const name of input.professionals) addPerson(name, "[PROFISSIONAL]");
  for (const school of input.schools) entries.push([school.name.trim(), schoolLabel(school.id), false]);
  const rules = nameRules(entries);

  const apply = (text: string) => {
    let result = text;
    for (const pattern of PATTERNS) {
      result = result.replace(pattern.regex, (match) =>
        pattern.replacement === "[TELEFONE]" && (match.replace(/\D/g, "").length < 8 || isYearRange(match)) ? match : pattern.replacement,
      );
    }
    for (const rule of rules) result = result.replace(rule.regex, rule.replacement);
    return result;
  };

  // Na tela: primeiro nome, ou nome completo quando outro estudante
  // acessível tem o mesmo primeiro nome.
  const firstNames = new Map<string, number>();
  for (const student of input.students) {
    const first = nameTokens(student.name)[0] ?? student.name;
    firstNames.set(first, (firstNames.get(first) ?? 0) + 1);
  }
  const shown = new Map<number, string>();
  for (const student of input.students) {
    const first = nameTokens(student.name)[0] ?? student.name;
    shown.set(map.students[student.id], (firstNames.get(first) ?? 0) > 1 ? student.name : first);
  }
  const schoolNames = new Map(input.schools.map((school) => [map.schools[school.id], school.name]));
  const restore = (text: string) => {
    const named = text
      .replace(/\[?\bESTUDANTE\s+(\d+)\b\]?/gi, (match, n: string) => shown.get(Number(n)) ?? match)
      .replace(/\[?\bESCOLA\s+(\d+)\b\]?/gi, (match, n: string) => schoolNames.get(Number(n)) ?? match);
    return naturalizePlaceholders(named.replace(/\[PESSOA\]/g, "uma pessoa"));
  };

  return { map, changed, studentLabel, schoolLabel, apply, restore };
}

// Monta o pseudonimizador com o que a pessoa pode ver: os estudantes do seu
// escopo (escola, ou o estudante vinculado), as escolas e os nomes cadastrados.
export async function loadPseudonymizer(user: SessionUser, map: PseudonymMap): Promise<Pseudonymizer & { studentIds: string[] }> {
  const [candidates, schools, users] = await Promise.all([
    prisma.student.findMany({
      where: user.role === "familia" || user.role === "terapeuta"
        ? { id: user.studentId ?? "" }
        : { ...(user.schoolId && user.role !== "secretaria" ? { schoolId: user.schoolId } : {}) },
      select: { id: true, name: true, schoolId: true, guardianName: true, familyNotes: { select: { author: true } }, intersectorReports: { select: { authorName: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.school.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({ select: { name: true, role: true } }),
  ]);
  const students = candidates.filter((student) => canAccessStudent(user, student.schoolId, student.id));
  const pseudonymizer = createPseudonymizer({
    map,
    students: students.map((student) => ({ id: student.id, name: student.name })),
    schools,
    family: [
      ...students.map((student) => student.guardianName),
      ...students.flatMap((student) => student.familyNotes.map((note) => note.author)),
      ...users.filter((item) => item.role === "familia").map((item) => item.name),
    ],
    professionals: [
      ...users.filter((item) => item.role !== "familia").map((item) => item.name),
      ...students.flatMap((student) => student.intersectorReports.map((report) => report.authorName)),
    ],
  });
  return { ...pseudonymizer, studentIds: students.map((student) => student.id) };
}
