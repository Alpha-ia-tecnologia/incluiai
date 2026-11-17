import { db } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser } from "@/lib/auth";
import { unavailableResponse } from "@/lib/tenant";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  const prisma = await db();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });

  const image = await prisma.activityImage.findUnique({
    where: { activityId: id },
    include: { activity: { select: { studentId: true, context: true, status: true, student: { select: { schoolId: true } } } } },
  });
  if (!image || !canAccessStudent(user, image.activity.student.schoolId, image.activity.studentId)) {
    return new Response("Imagem não encontrada", { status: 404 });
  }
  const homeActivity = image.activity.context === "casa" && ["aceita", "aplicada"].includes(image.activity.status);
  if (user.role === "terapeuta" || (user.role === "familia" && !homeActivity)) {
    return new Response("Imagem não encontrada", { status: 404 });
  }
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mimeType, "Cache-Control": "private, max-age=86400" },
  });
}
