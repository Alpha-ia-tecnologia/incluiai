import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWorkWithStudent } from "@/lib/policy";
import { can } from "@/lib/roles";
import { recordView } from "@/lib/audit";
import { unavailableResponse } from "@/lib/tenant";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  const prisma = await db();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const report = await prisma.healthReport.findUnique({
    where: { id },
    select: { studentId: true, fileName: true, mimeType: true, data: true, student: { select: { schoolId: true } } },
  });
  if (!report || !can(user.role, "seeClinical") || !canWorkWithStudent(user, { id: report.studentId, schoolId: report.student.schoolId })) {
    return new Response("Laudo não encontrado.", { status: 404 });
  }

  await recordView(user, report.studentId, "Arquivo do laudo");
  return new Response(new Uint8Array(report.data), {
    headers: {
      "Content-Type": report.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
