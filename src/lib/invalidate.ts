import "server-only";
import { revalidatePath } from "next/cache";

export function invalidateStudent(studentId: string): void {
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  revalidatePath(`/familia/${studentId}`);
  revalidatePath("/terapeuta");
}
