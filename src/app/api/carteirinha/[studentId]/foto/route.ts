import { db } from "@/lib/prisma";
import { canViewCard } from "@/lib/student-card";
import { serveStudentFile } from "@/lib/student-files";

export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return serveStudentFile(async (user) => {
    const prisma = await db();
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true, consent: { select: { card: true } }, card: { select: { photo: true, photoMime: true } } },
    });
    if (!student?.consent?.card || !student.card?.photo || !student.card.photoMime || !canViewCard(user, student)) return null;
    return { studentId, data: student.card.photo, mimeType: student.card.photoMime };
  });
}
