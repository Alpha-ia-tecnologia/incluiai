import "server-only";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { createAnonymizer, naturalizePlaceholders, type Anonymizer } from "./agents/anonymize-core";
import { tidyForLibras } from "./vlibras-core";

// Antes de o texto ir para o tradutor de Libras do governo, a plataforma troca
// nomes, documentos, datas e contatos (regras do anonimizador da IA, em
// linguagem natural: "o estudante", "um familiar"). Cada pessoa usa só os nomes
// que já pode ver: assim a troca não revela se um nome está cadastrado.

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; anonymizer: Anonymizer }>();

async function namesFor(user: SessionUser | null) {
  if (!user) return null;
  const linked = user.role === "familia" || user.role === "terapeuta";
  // Família e terapeuta: os estudantes vinculados. Equipe com escola: a escola. Rede: tudo.
  const studentWhere = linked ? { id: { in: user.studentIds } } : user.schoolId ? { schoolId: user.schoolId } : {};
  const students = await prisma.student.findMany({ where: studentWhere, select: { id: true, name: true, guardianName: true, schoolId: true } });
  const schoolIds = [...new Set(students.map((student) => student.schoolId))];
  const [families, staff, schools] = await Promise.all([
    prisma.user.findMany({ where: { role: "familia", studentLinks: { some: { studentId: { in: students.map((student) => student.id) } } } }, select: { name: true } }),
    prisma.user.findMany({ where: { role: { notIn: ["familia", "terapeuta"] }, ...(linked || user.schoolId ? { OR: [{ schoolId: { in: schoolIds } }, { schoolId: null }] } : {}) }, select: { name: true } }),
    prisma.school.findMany({ select: { name: true } }),
  ]);
  return {
    student: "",
    students: students.map((student) => student.name),
    family: [...students.map((student) => student.guardianName), ...families.map((family) => family.name)],
    professionals: [...staff.map((person) => person.name), user.name],
    schools: schools.map((school) => school.name),
  };
}

async function anonymizerFor(user: SessionUser | null): Promise<Anonymizer> {
  const key = user ? `${user.id}:${user.role}:${user.schoolId ?? ""}:${user.studentIds.join(",")}` : "anonimo";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.anonymizer;
  // Sem sessão (tela de entrada): só documentos, datas e contatos.
  const anonymizer = createAnonymizer((await namesFor(user)) ?? { student: "" });
  cache.set(key, { at: Date.now(), anonymizer });
  return anonymizer;
}

export async function anonymizeForLibras(user: SessionUser | null, text: string): Promise<string> {
  const anonymizer = await anonymizerFor(user);
  // Marcadores como [DATA] viram "(informação omitida)" para o avatar não soletrar colchetes.
  return tidyForLibras(naturalizePlaceholders(anonymizer.applyNatural(text)));
}
