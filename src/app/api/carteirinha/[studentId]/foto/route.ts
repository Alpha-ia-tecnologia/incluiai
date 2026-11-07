import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewCard } from "@/lib/student-card";

// Foto da carteirinha: só para a família e a equipe que faz a carteirinha, e só
// enquanto a família autoriza. Para os demais, "não encontrada".
export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true, consent: { select: { card: true } }, card: { select: { photo: true, photoMime: true } } },
  });
  if (!student?.consent?.card || !student.card?.photo || !student.card.photoMime || !canViewCard(user, student.schoolId, studentId)) {
    return new Response("Foto não encontrada.", { status: 404 });
  }
  return new Response(new Uint8Array(student.card.photo), {
    headers: { "Content-Type": student.card.photoMime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
