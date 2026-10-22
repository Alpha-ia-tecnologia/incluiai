import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canEditStudentRecord, getCurrentUser } from "@/lib/auth";
import { loadPlanningFor } from "@/lib/dua/shared";
import { taskContent } from "@/lib/adapted-tasks";
import { adaptedDocx } from "@/lib/adapted-docx";
import { printSettings } from "@/lib/task-adaptation";
import { parseJson } from "@/lib/format";

// Word da atividade adaptada (estudante ou nível do DUA), só para a equipe com acesso.
export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const user = await getCurrentUser();
  if (!user || !canEditStudentRecord(user.role)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const task = await prisma.adaptedTask.findUnique({ where: { id: taskId }, include: { student: { select: { schoolId: true } } } });
  if (!task) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
  if (task.studentId && (!task.student || !canAccessStudent(user, task.student.schoolId, task.studentId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (task.planningId) {
    try { await loadPlanningFor(user, task.planningId, "read"); } catch { return NextResponse.json({ error: "Sem acesso." }, { status: 403 }); }
  }
  const options = parseJson<string[]>(task.options, []);
  const dua = Boolean(task.planningId);
  const buffer = await adaptedDocx(taskContent(task.content, task.title), { ...printSettings(options), highlight: dua || options.includes("destacar_comando"), icons: dua || options.includes("apoio_visual") });
  const name = task.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "atividade";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
