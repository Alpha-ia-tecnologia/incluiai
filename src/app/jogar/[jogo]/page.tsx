import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canEditStudentRecord, getCurrentUser } from "@/lib/auth";
import { recordView } from "@/lib/access-log";
import { parseJson } from "@/lib/format";
import {
  GAMES, ROUTINES, THEMES, emotionRounds, isAssociationMode, isGameKey, isLevel, isRoutineKey, isThemeKey, memoryDeck, quantityRounds,
  routineSteps, shuffle, suggestedLevel, themeFromInterests, wordRounds,
} from "@/lib/games/games-core";
import { GamePlayer, type GameData } from "@/components/games/game-player";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jogo · IncluiEdu" };

type Query = { estudante?: string; nivel?: string; tema?: string; rotina?: string; modo?: string; partida?: string };

// Modo de jogo em tela cheia, fora do menu da plataforma: só o jogo e os
// controles do professor. As cartas e rodadas são sorteadas aqui, no servidor;
// "Jogar de novo" pede um sorteio novo. O estudante é opcional: sem ele, o
// jogo funciona igual, só não há registro da aula no fim.
export default async function PlayPage({ params, searchParams }: { params: Promise<{ jogo: string }>; searchParams: Promise<Query> }) {
  const [{ jogo }, query] = await Promise.all([params, searchParams]);
  if (!isGameKey(jogo)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canEditStudentRecord(user.role)) redirect("/");
  const student = query.estudante
    ? await prisma.student.findUnique({
      where: { id: query.estudante },
      select: { id: true, name: true, schoolId: true, profile: { select: { interests: true, readingSupport: true, mathSupport: true, organization: true } } },
    })
    : null;
  if (query.estudante && (!student || !canAccessStudent(user, student.schoolId, student.id))) redirect("/jogos");

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
    // Nunca começa já na ordem certa.
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
  // A partida vem do endereço: a atualização que o registro da aula provoca não
  // reinicia o jogo; "Jogar de novo" abre o mesmo jogo com uma partida nova.
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
