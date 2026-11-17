import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { studentScopeWhere } from "@/lib/policy";
import { can } from "@/lib/roles";
import { parseJson } from "@/lib/format";
import { suggestedLevel, themeFromInterests } from "@/lib/games/games-core";
import { GamesHub, type HubStudent } from "@/components/games/games-hub";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jogos educativos · IncluiEdu" };

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ estudante?: string }> }) {
  const prisma = await db();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "editRecord")) redirect("/");
  const { estudante } = await searchParams;
  const students: HubStudent[] = (await prisma.student.findMany({
    where: { status: "ativo", ...studentScopeWhere(user) },
    select: { id: true, name: true, gradeYear: true, className: true, profile: { select: { interests: true, readingSupport: true, mathSupport: true, organization: true } } },
    orderBy: { name: "asc" },
  }))
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
