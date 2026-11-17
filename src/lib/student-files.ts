import "server-only";
import { getCurrentUser, type SessionUser } from "./auth";
import { recordView } from "./audit";
import { canAccessStudent, isFamilyOf } from "./policy";
import { can } from "./roles";
import { unavailableResponse } from "./tenant";

export type StudentFile = { studentId: string; data: Uint8Array; mimeType: string; fileName?: string; viewedAs?: string };

export const teamOrSharedWithFamily = (user: SessionUser, student: { id: string; schoolId: string }, shared: boolean): boolean =>
  (can(user.role, "pedagogical") && canAccessStudent(user, student)) || (shared && isFamilyOf(user, student.id));

export async function serveStudentFile(find: (user: SessionUser) => Promise<StudentFile | null>): Promise<Response> {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const file = await find(user);
  if (!file) return new Response("Arquivo não encontrado.", { status: 404 });
  if (file.viewedAs) await recordView(user, file.studentId, file.viewedAs);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      ...(file.fileName ? { "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}` } : {}),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
