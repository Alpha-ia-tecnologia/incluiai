import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { recordView } from "@/lib/access-log";
import { PENDING_CARD_COOKIE } from "@/lib/student-card";
import { CARD_TOKEN_PATTERN } from "@/lib/student-card-core";

// Endereço do QR da carteirinha. Não mostra nada por si: sem login, guarda o
// código por 10 minutos e manda para a entrada (o Início volta para cá depois).
// Com login, leva cada perfil ao que ele já pode ver; as regras de sempre
// (motivo da Secretaria, dados clínicos só para o AEE e a coordenação) seguem
// valendo na página de destino. Quem não tem acesso não descobre de quem é.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const jar = await cookies();
  const user = await getCurrentUser();
  if (!user) {
    if (CARD_TOKEN_PATTERN.test(token)) {
      jar.set(PENDING_CARD_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
    }
    redirect("/login");
  }
  jar.delete(PENDING_CARD_COOKIE);

  const card = CARD_TOKEN_PATTERN.test(token)
    ? await prisma.studentCard.findUnique({ where: { token }, select: { studentId: true, student: { select: { schoolId: true, consent: { select: { card: true, therapistLink: true } } } } } })
    : null;
  if (!card?.student.consent?.card) redirect("/carteirinha/inativa");
  const { studentId, student } = card;

  let destination: string | null = null;
  if (user.role === "familia" && user.studentIds.includes(studentId)) destination = `/familia/${studentId}`;
  else if (user.role === "terapeuta" && user.studentIds.includes(studentId) && student.consent?.therapistLink) destination = "/terapeuta";
  else if (isStaffOrNetwork(user.role) && canAccessStudent(user, student.schoolId, studentId)) destination = `/estudantes/${studentId}`;
  if (!destination) redirect("/carteirinha/sem-acesso");

  await recordView(user, studentId, "Código QR da carteirinha");
  redirect(destination);
}
