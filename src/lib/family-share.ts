import "server-only";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { weekStart } from "./dates";
import { cleanCheckIn } from "./family-contact";
import { planShare, sameCheckIn, type ShareInput } from "./family-portal";
import { readList } from "./format";
import { saveCheckIn } from "./notifications";
import { saveFamilyNote } from "./records";
import { UserError } from "./user-error";

/** "Contar para a escola": guarda a resposta da semana, quando mudou, e a conquista de casa, quando há. */
export async function shareWithSchool(user: SessionUser, studentId: string, input: ShareInput): Promise<void> {
  const plan = planShare(input);
  if ("error" in plan) throw new UserError(plan.error);
  let saved = false;
  if (plan.checkIn) {
    const prisma = await db();
    const previous = await prisma.familyCheckIn.findUnique({ where: { studentId_weekStart: { studentId, weekStart: weekStart() } }, select: { answers: true, note: true } });
    const clean = cleanCheckIn(plan.checkIn.answers, plan.checkIn.note);
    if (!(previous && !("error" in clean) && sameCheckIn(clean, { answers: readList(previous.answers), note: previous.note }))) {
      await saveCheckIn(user, studentId, plan.checkIn.answers, plan.checkIn.note);
      saved = true;
    }
  }
  if (plan.achievement) {
    await saveFamilyNote(user, studentId, plan.achievement.note, plan.achievement.author);
    saved = true;
  }
  if (!saved) throw new UserError("A resposta desta semana continua a mesma. Mude a resposta ou conte uma conquista.");
}
