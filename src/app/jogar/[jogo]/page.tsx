import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStudent } from "@/lib/policy";
import { can } from "@/lib/roles";
import { recordView } from "@/lib/audit";
import { firstName, readList } from "@/lib/format";
import { gameById, isFullScreenId, isLevel } from "@/lib/games/registry";
import { fullScreenSession, isThemeKey, suggestedLevel, themeFromInterests } from "@/lib/games/themes";
import { GamePlayer } from "@/components/games/game-player";

export const metadata: Metadata = { title: "Jogo · IncluiEdu" };

type Query = { estudante?: string; nivel?: string; tema?: string; rotina?: string; modo?: string; partida?: string };

export default async function PlayPage({ params, searchParams }: { params: Promise<{ jogo: string }>; searchParams: Promise<Query> }) {
  const prisma = await db();
  const [{ jogo }, query] = await Promise.all([params, searchParams]);
  if (!isFullScreenId(jogo)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "editRecord")) redirect("/");
  const student = query.estudante
    ? await prisma.student.findUnique({
      where: { id: query.estudante },
      select: { id: true, name: true, schoolId: true, profile: { select: { interests: true, readingSupport: true, mathSupport: true, organization: true } } },
    })
    : null;
  if (query.estudante && (!student || !canAccessStudent(user, student))) redirect("/jogos");

  const level = isLevel(query.nivel) ? query.nivel : suggestedLevel(student?.profile ?? null);
  const theme = isThemeKey(query.tema) ? query.tema : themeFromInterests(readList(student?.profile?.interests ?? null));
  const { data, detail } = fullScreenSession(jogo, { level, theme, routine: query.rotina, mode: query.modo });

  if (student) await recordView(user, student.id, `Jogos educativos: ${gameById(jogo).title}`);
  const replay = new URLSearchParams(Object.entries(query).filter(([key, value]) => key !== "partida" && typeof value === "string") as [string, string][]);
  replay.set("partida", crypto.randomUUID().slice(0, 8));
  return (
    <GamePlayer
      key={query.partida ?? "inicio"}
      replayHref={`/jogar/${jogo}?${replay.toString()}`}
      data={data}
      level={level}
      detail={detail}
      student={student ? { id: student.id, firstName: firstName(student.name) } : null}
    />
  );
}
