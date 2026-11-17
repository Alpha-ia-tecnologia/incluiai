import { db } from "@/lib/prisma";
import { isFamilyActivity } from "@/lib/policy";
import { serveStudentFile, teamOrSharedWithFamily } from "@/lib/student-files";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return serveStudentFile(async (user) => {
    const prisma = await db();
    const image = await prisma.activityImage.findUnique({
      where: { activityId: id },
      include: { activity: { select: { studentId: true, context: true, status: true, student: { select: { schoolId: true } } } } },
    });
    if (!image || !teamOrSharedWithFamily(user, { id: image.activity.studentId, schoolId: image.activity.student.schoolId }, isFamilyActivity(image.activity))) return null;
    return { studentId: image.activity.studentId, data: image.data, mimeType: image.mimeType };
  });
}
