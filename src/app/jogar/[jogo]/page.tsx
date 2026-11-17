import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStudent } from "@/lib/policy";
import { can } from "@/lib/roles";
import { recordView } from "@/lib/audit";
import { parseJson } from "@/lib/format";
import {
  GAMES, ROUTINES, THEMES, emotionRounds, isAssociationMode, isGameKey, isLevel, isRoutineKey, isThemeKey, memoryDeck, quantityRounds,
  routineSteps, shuffle, suggestedLevel, themeFromInterests, wordRounds,
} from "@/lib/games/games-core";
import { GamePlayer, type GameData } from "@/components/games/game-player";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jogo · IncluiEdu" };

type Query = { estudante?: string; nivel?: string; tema?: string; rotina?: string; modo?: string; partida?: string };

export default async function PlayPage({ params, searchParams }: { params: Promise<{ jogo: string }>; searchParams: Promise<Query> }) {
  const prisma = await db();
  const [{ jogo }, query] = await Promise.all([params, searchParams]);
  if (!isGameKey(jogo)) notFound();
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
  const theme = isThemeKey(query.tema) ? query.tema : themeFromInterests(parseJson<string[]>(student?.profile?.interests ?? null, []));
  let data: GameData;
  let detail: string | null;
  if (jogo === "memoria") {
    data = { game: "memoria", deck: memoryDeck(theme, level) };
    detail = THEMES[theme].label;
  } else if (jogo === "sequencia") {
    const routine = isRoutineKey(query.rotina) ? query.rotina : "maos";
    const steps = routineSteps(routine, level);
    const indexes = steps.map((_, index) => index);
    let order = shuffle(indexes);
    while (order.every((value, index) => value === index)) order = shuffle(indexes);
    data = { game: "sequencia", routine: ROUTINES[routine].label, steps, order };
    detail = ROUTINES[routine].label;
  } else if (jogo === "associacao") {
    const mode = isAssociationMode(query.modo) ? query.modo : "palavra";
    data = { game: "associacao", mode, rounds: mode === "palavra" ? wordRounds(theme, level) : quantityRounds(theme, level) };
    detail = `${mode === "palavra" ? "Figura e palavra" : "Quantidade e número"} · ${THEMES[theme].label}`;
  } else {
    data = { game: "emocoes", rounds: emotionRounds(level) };
    detail = null;
  }

  if (student) await recordView(user, student.id, `Jogos educativos: ${GAMES[jogo].title}`);
  const replay = new URLSearchParams(Object.entries(query).filter(([key, value]) => key !== "partida" && typeof value === "string") as [string, string][]);
  replay.set("partida", crypto.randomUUID().slice(0, 8));
  return (
    <GamePlayer
      key={query.partida ?? "inicio"}
      replayHref={`/jogar/${jogo}?${replay.toString()}`}
      data={data}
      level={level}
      detail={detail}
      student={student ? { id: student.id, firstName: student.name.split(" ")[0] } : null}
    />
  );
}
