import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { PageHero, Card } from "@/components/ui";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

// Família com mais de um filho vinculado escolhe aqui; a equipe confere como a
// família vê o portal, só com os estudantes que já acompanha (a própria escola).
export default async function FamilyPortalIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const family = user.role === "familia";
  if (family && user.studentIds.length === 1) redirect(`/familia/${user.studentIds[0]}`);
  if (family ? !user.studentIds.length : !isStaffOrNetwork(user.role) || user.role === "secretaria") redirect("/");
  const candidates = await prisma.student.findMany({
    where: family ? { id: { in: user.studentIds } } : { status: "ativo", ...(user.schoolId ? { schoolId: user.schoolId } : {}) },
    include: { school: true },
    orderBy: { name: "asc" },
  });
  const students = candidates.filter((student) => canAccessStudent(user, student.schoolId, student.id));

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
        <p className="mb-4 text-xs text-ink-soft">
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
                <p className="text-xs text-ink-soft">{s.gradeYear} · {s.school.name}</p>
              </div>
              <ArrowRight size={16} className="text-ink-soft" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
