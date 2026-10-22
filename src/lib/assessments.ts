import "server-only";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { recordChange } from "./access-log";
import { INSTRUMENT_VERSION, cleanAnswers, observed, type Answers } from "./assessment";

// Sondagem: gravar a aplicação e ler a linha de base e a última. Regras puras em assessment.ts.

export const answersOf = (stored: string): Answers => cleanAnswers(JSON.parse(stored) as Record<string, unknown>);

export async function saveAssessment(user: SessionUser, studentId: string, raw: Record<string, unknown>, notes: string): Promise<string | { error: string }> {
  const answers = cleanAnswers(raw);
  if (observed(answers).length < 5) return { error: "Observe pelo menos 5 itens antes de salvar (os outros podem ficar como não observados)." };
  const previous = await prisma.assessment.count({ where: { studentId } });
  const kind = previous ? "reavaliacao" : "linha_de_base";
  const assessment = await prisma.assessment.create({
    data: { studentId, instrumentVersion: INSTRUMENT_VERSION, kind, answers: JSON.stringify(answers), notes: notes.trim().slice(0, 2000) || null, appliedById: user.id, appliedByName: user.name },
  });
  await prisma.timelineEvent.create({ data: { studentId, type: "avaliacao", title: kind === "linha_de_base" ? "Sondagem: linha de base" : "Sondagem: reavaliação", description: `${observed(answers).length} itens observados, por ${user.name}.` } });
  await recordChange(user, studentId, "registrou", kind === "linha_de_base" ? "Sondagem (linha de base)" : "Sondagem (reavaliação)");
  return assessment.id;
}

// Linha de base (a primeira) e a mais recente.
export async function baselineAndLatest(studentId: string) {
  const [baseline, latest] = await Promise.all([
    prisma.assessment.findFirst({ where: { studentId }, orderBy: { appliedAt: "asc" } }),
    prisma.assessment.findFirst({ where: { studentId }, orderBy: { appliedAt: "desc" } }),
  ]);
  return { baseline, latest };
}
