import { db } from "@/lib/prisma";
import { canWorkWithStudent } from "@/lib/policy";
import { can } from "@/lib/roles";
import { serveStudentFile } from "@/lib/student-files";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return serveStudentFile(async (user) => {
    const prisma = await db();
    const report = await prisma.healthReport.findUnique({
      where: { id },
      select: { studentId: true, fileName: true, mimeType: true, data: true, student: { select: { schoolId: true } } },
    });
    if (!report || !can(user.role, "seeClinical") || !canWorkWithStudent(user, { id: report.studentId, schoolId: report.student.schoolId })) return null;
    return { studentId: report.studentId, data: report.data, mimeType: report.mimeType, fileName: report.fileName, viewedAs: "Arquivo do laudo" };
  });
}
