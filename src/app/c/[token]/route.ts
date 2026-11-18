import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStudent, isTherapistOf, studentPathFor } from "@/lib/policy";
import { recordView } from "@/lib/audit";
import { PENDING_CARD_COOKIE } from "@/lib/student-card";
import { CARD_TOKEN_PATTERN } from "@/lib/student-card-core";
import { unavailableResponse } from "@/lib/tenant";
import { secureCookies } from "@/lib/env-config";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  const prisma = await db();
  const { token } = await params;
  const jar = await cookies();
  const user = await getCurrentUser();
  if (!user) {
    if (CARD_TOKEN_PATTERN.test(token)) {
      jar.set(PENDING_CARD_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookies(), maxAge: 600, path: "/" });
    }
    redirect("/login");
  }
  jar.delete(PENDING_CARD_COOKIE);

  const card = CARD_TOKEN_PATTERN.test(token)
    ? await prisma.studentCard.findUnique({ where: { token }, select: { studentId: true, student: { select: { schoolId: true, consent: { select: { card: true, therapistLink: true } } } } } })
    : null;
  if (!card?.student.consent?.card) redirect("/carteirinha/inativa");
  const { studentId, student } = card;

  const reachable = canAccessStudent(user, { id: studentId, schoolId: student.schoolId }) && (!isTherapistOf(user, studentId) || student.consent?.therapistLink);
  if (!reachable) redirect("/carteirinha/sem-acesso");

  await recordView(user, studentId, "Código QR da carteirinha");
  redirect(studentPathFor(user, studentId));
}
