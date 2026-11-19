import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { landingFor, studentScopeWhere } from "@/lib/policy";
import { can } from "@/lib/roles";
import { PageHero, Card } from "@/components/ui";
import { ArrowRight } from "lucide-react";

export default async function FamilyPortalIndex() {
  const prisma = await db();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const family = can(user.role, "familyPortal");
  if (family && landingFor(user) !== "/familia") redirect(landingFor(user));
  if (!family && (!can(user.role, "pedagogical") || !can(user.role, "seeNames"))) redirect("/");
  const students = await prisma.student.findMany({
    where: { ...(family ? {} : { status: "ativo" }), ...studentScopeWhere(user) },
    include: { school: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHero
        character="care"
        title="Portal da família"
        lede={family
          ? "Escolha quem você quer acompanhar: avanços, atividades para casa e quem acessou os dados de cada um."
          : "Um ambiente simples, sem linguagem excessivamente técnica, para acompanhar avanços, registrar conquistas e saber quem acessou os dados do estudante."}
      />
      {family ? null : (
        <p className="mb-4 text-sm text-ink-soft">
          Veja como a família enxerga o portal. Cada responsável acessa só os estudantes vinculados à conta dele.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {students.map((s) => (
          <Link key={s.id} href={`/familia/${s.id}`} className="group">
            <Card className="flex items-center gap-3 transition-shadow group-hover:shadow-md">
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-full font-display text-xl font-semibold text-white"
                style={{ backgroundColor: `oklch(55% 0.11 ${s.avatarHue})` }}
              >
                {s.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{s.name}</p>
                <p className="text-sm text-ink-soft">{s.gradeYear} · {s.school.name}</p>
              </div>
              <ArrowRight size={16} className="text-ink-soft" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
