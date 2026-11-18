import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStudent } from "@/lib/policy";
import { can } from "@/lib/roles";
import { BNCC, bnccSkill } from "@/lib/bncc";
import { scopeFor, searchSkills, suggestSkills, type BnccScope } from "@/lib/bncc-core";
import { bnccOption, readBnccQuery } from "@/lib/bncc-query";
import { unavailableResponse } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  const prisma = await db();
  const user = await getCurrentUser();
  if (!user || !can(user.role, "pedagogical")) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const query = readBnccQuery(request.nextUrl.searchParams);
  if (query.codes) return NextResponse.json(query.codes.slice(0, 20).map(bnccSkill).filter((skill) => skill !== null).map(bnccOption));

  let scope: BnccScope | null = null;
  if (query.studentId) {
    const student = await prisma.student.findUnique({ where: { id: query.studentId }, select: { id: true, schoolId: true, stage: true, gradeYear: true, birthDate: true } });
    if (!student || !canAccessStudent(user, student)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    scope = scopeFor(student);
  }
  if (query.suggest) return NextResponse.json(suggestSkills(BNCC, query.suggest.slice(0, 600), scope, query.dimension ?? null).map(bnccOption));
  const text = (query.text ?? "").slice(0, 120);
  return NextResponse.json(text.trim().length >= 2 ? searchSkills(BNCC, text, scope).map(bnccOption) : []);
}
