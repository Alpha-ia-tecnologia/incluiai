import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { BNCC, bnccSkill } from "@/lib/bncc";
import { scopeFor, searchSkills, suggestSkills, type BnccScope, type BnccSkill } from "@/lib/bncc-core";

// Busca na BNCC para o campo de habilidade (objetivo do plano e planejamento com DUA):
//   ?q=EF01LP ou ?q=palavras  → busca
//   ?sugerir=<texto do objetivo>&dimensao=leitura → sugestão pelo texto
//   ?codigos=EF01LP01,EF02MA03 → detalhes dos códigos já escolhidos
//   &estudante=<id> → recorte pelo ano do estudante (com acesso conferido)
// Só a equipe; nada sai da plataforma (sem IA).
const view = ({ code, component, years, description }: BnccSkill) => ({ code, component, years, description });

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaffOrNetwork(user.role)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const params = request.nextUrl.searchParams;
  const codes = params.get("codigos");
  if (codes) return NextResponse.json(codes.split(",").slice(0, 20).map(bnccSkill).filter((skill) => skill !== null).map(view));

  let scope: BnccScope | null = null;
  const studentId = params.get("estudante");
  if (studentId) {
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, stage: true, gradeYear: true, birthDate: true } });
    if (!student || !canAccessStudent(user, student.schoolId, student.id)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    scope = scopeFor(student);
  }
  const suggest = params.get("sugerir");
  if (suggest) return NextResponse.json(suggestSkills(BNCC, suggest.slice(0, 600), scope, params.get("dimensao")).map(view));
  const query = (params.get("q") ?? "").slice(0, 120);
  return NextResponse.json(query.trim().length >= 2 ? searchSkills(BNCC, query, scope).map(view) : []);
}
