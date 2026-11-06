import { prisma } from "@/lib/prisma";
import { canAccessStudent, canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";

// Entrega o arquivo de um laudo só à equipe pedagógica com acesso ao
// estudante. Cada abertura fica no histórico de acessos que a família vê.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });

  const report = await prisma.healthReport.findUnique({
    where: { id },
    select: { studentId: true, fileName: true, mimeType: true, data: true, student: { select: { schoolId: true } } },
  });
  if (!report || !isStaffOrNetwork(user.role) || !canSeePedagogicalDetail(user.role) || !canAccessStudent(user, report.student.schoolId, report.studentId)) {
    return new Response("Laudo não encontrado", { status: 404 });
  }

  await prisma.accessLog.create({ data: { studentId: report.studentId, actor: user.name, role: user.role, action: "visualizou", detail: "Arquivo do laudo" } });
  return new Response(new Uint8Array(report.data), {
    headers: {
      "Content-Type": report.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
