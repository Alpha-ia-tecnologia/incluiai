import { prisma } from "@/lib/prisma";
import { canAccessStudent, canEditStudentRecord, canSeeClinicalDetail, getCurrentUser } from "@/lib/auth";
import { recordView } from "@/lib/access-log";

// Arquivo de um laudo, só para o AEE e a coordenação com acesso ao estudante
// (dado clínico). Para os demais a resposta é "não encontrado", sem dizer se o
// laudo existe. A abertura vai para o histórico de acessos que a família vê.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const report = await prisma.healthReport.findUnique({
    where: { id },
    select: { studentId: true, fileName: true, mimeType: true, data: true, student: { select: { schoolId: true } } },
  });
  if (!report || !canEditStudentRecord(user.role) || !canSeeClinicalDetail(user.role) || !canAccessStudent(user, report.student.schoolId, report.studentId)) {
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
