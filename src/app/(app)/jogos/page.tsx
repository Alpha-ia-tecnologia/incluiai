import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canEditStudentRecord, getCurrentUser, isSchoolStaff } from "@/lib/auth";
import { parseJson } from "@/lib/format";
import { suggestedLevel, themeFromInterests } from "@/lib/games/games-core";
import { GamesHub, type HubStudent } from "@/components/games/games-hub";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jogos educativos · IncluiEdu" };

// Jogos educativos do AEE, todos numa só página: os de fotografias abrem aqui
// mesmo e os de tema e rotina, em tela cheia (/jogar/<jogo>). Com um estudante
// escolhido, o nível vem do "Como aprende" e o professor pode registrar a aula
// no fim de qualquer jogo.
export default async function GamesPage({ searchParams }: { searchParams: Promise<{ estudante?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canEditStudentRecord(user.role)) redirect("/");
  const { estudante } = await searchParams;
  const scoped = isSchoolStaff(user.role) && user.schoolId;
  const students: HubStudent[] = (await prisma.student.findMany({
    where: { status: "ativo", ...(scoped ? { schoolId: user.schoolId! } : {}) },
    select: { id: true, name: true, gradeYear: true, className: true, schoolId: true, profile: { select: { interests: true, readingSupport: true, mathSupport: true, organization: true } } },
    orderBy: { name: "asc" },
  }))
    .filter((student) => canAccessStudent(user, student.schoolId, student.id))
    .map((student) => ({
      id: student.id,
      name: student.name,
      firstName: student.name.split(" ")[0],
      detail: `${student.gradeYear} · ${student.className}`,
      level: suggestedLevel(student.profile),
      theme: themeFromInterests(parseJson<string[]>(student.profile?.interests ?? null, [])),
    }));

  return <GamesHub students={students} initialStudentId={estudante ?? null} />;
}
