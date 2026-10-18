import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { PageHero, Card } from "@/components/ui";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FamilyPortalIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "familia" && user.studentId) redirect(`/familia/${user.studentId}`);
  if (!isStaffOrNetwork(user.role) || user.role === "secretaria") redirect("/");
  const students = await prisma.student.findMany({
    where: { status: "ativo" },
    include: { school: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHero
        character="care"
        title="Portal da família"
        lede="Um ambiente simples, sem linguagem excessivamente técnica, para acompanhar avanços, registrar conquistas e saber quem acessou os dados do estudante."
      />
      <p className="mb-4 text-xs text-ink-soft">
        Demonstração: em produção, cada responsável acessa apenas o próprio estudante.
      </p>
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
