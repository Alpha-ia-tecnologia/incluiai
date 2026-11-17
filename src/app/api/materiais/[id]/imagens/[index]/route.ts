import { db } from "@/lib/prisma";
import { isFamilyMaterial } from "@/lib/policy";
import { serveStudentFile, teamOrSharedWithFamily } from "@/lib/student-files";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  return serveStudentFile(async (user) => {
    const prisma = await db();
    const cardIndex = Number(index);
    if (!Number.isInteger(cardIndex) || cardIndex < 0) return null;
    const image = await prisma.materialImage.findUnique({
      where: { materialId_cardIndex: { materialId: id, cardIndex } },
      include: { material: { select: { studentId: true, status: true, student: { select: { schoolId: true } } } } },
    });
    if (!image || !teamOrSharedWithFamily(user, { id: image.material.studentId, schoolId: image.material.student.schoolId }, isFamilyMaterial(image.material))) return null;
    return { studentId: image.material.studentId, data: image.data, mimeType: image.mimeType };
  });
}
