import Link from "next/link";
import { recordJourneyMark } from "@/lib/user-journey";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isNetworkRole } from "@/lib/auth";
import { createSchool, createClass, deleteClass } from "@/actions/admin";
import { SHIFTS } from "@/lib/scale";
import { PageHeader, Card, SectionTitle, Badge, EmptyState } from "@/components/ui";
import { ChoiceField } from "@/components/choice-field";
import { CLASS_NAME_OPTIONS, GRADE_YEAR_OPTIONS, REGION_OPTIONS } from "@/lib/form-options";
import { School as SchoolIcon, Users, UserPlus } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";

export const dynamic = "force-dynamic";

const inputCls = "min-h-10 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink";
const labelCls = "mb-1 block text-xs font-medium text-ink-soft";
const fieldStyle = { labelClassName: labelCls, inputClassName: inputCls };
const shiftOptions = Object.entries(SHIFTS).map(([value, label]) => ({ value, label }));
const btnCls = "rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-e1 transition-all hover:bg-brand-hover hover:shadow-e2 active:translate-y-px";

export default async function RegistriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isNetworkRole(user.role)) redirect("/");
  await recordJourneyMark(user.id, "cadastros");

  const [schools, perClass] = await Promise.all([
    prisma.school.findMany({
      include: { classes: { orderBy: { name: "asc" } }, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.student.groupBy({ by: ["schoolId", "className"], where: { status: "ativo" }, _count: { _all: true } }),
  ]);
  // Estudantes ativos por turma: turma com estudantes não pode ser excluída.
  const studentsInClass = new Map(perClass.map((row) => [`${row.schoolId}|${row.className}`, row._count._all]));
  // Regiões já usadas na rede entram nas opções, além das sugestões padrão.
  const regionOptions = [...new Set([...REGION_OPTIONS, ...schools.map((school) => school.region)])];

  return (
    <>
      <PageHeader
        title="Cadastros da rede"
        lede="Escolas, turmas e estudantes da rede. As turmas cadastradas aparecem no cadastro de estudantes e no planejamento para a turma toda."
        actions={
          <Link href="/estudantes/novo" className={`${btnCls} inline-flex items-center gap-1.5`}>
            <UserPlus size={15} aria-hidden /> Cadastrar estudante
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle><span className="flex items-center gap-1.5"><SchoolIcon size={13} aria-hidden /> Nova escola</span></SectionTitle>
          <form action={createSchool} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor="school-name" className={labelCls}>Nome *</label>
              <input id="school-name" name="name" required placeholder="Ex.: EMEF Anísio Teixeira" className={inputCls} />
            </div>
            <ChoiceField name="region" label="Região / território *" options={regionOptions} required otherPlaceholder="Ex.: Distrito Industrial" {...fieldStyle} />
            <div className="flex items-end">
              <button type="submit" className={btnCls}>Salvar</button>
            </div>
          </form>
        </Card>

        <Card>
          <SectionTitle><span className="flex items-center gap-1.5"><Users size={13} aria-hidden /> Nova turma</span></SectionTitle>
          <form action={createClass} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="class-school" className={labelCls}>Escola *</label>
              <select id="class-school" name="schoolId" required className={inputCls}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <ChoiceField name="name" label="Nome da turma *" options={CLASS_NAME_OPTIONS} required otherPlaceholder="Ex.: Turma Girassol" {...fieldStyle} />
            <ChoiceField name="gradeYear" label="Ano / série" options={GRADE_YEAR_OPTIONS} placeholder="Escolha (opcional)" otherPlaceholder="Ex.: Multisseriada" {...fieldStyle} />
            <ChoiceField name="shift" label="Turno *" options={shiftOptions} defaultValue="manha" required otherPlaceholder="Ex.: Noite" {...fieldStyle} />
            <div className="flex items-end">
              <button type="submit" className={btnCls}>Salvar</button>
            </div>
          </form>
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle>Escolas e turmas da rede</SectionTitle>
        {schools.length === 0 ? (
          <EmptyState title="Nenhuma escola cadastrada" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {schools.map((s) => (
              <Card key={s.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-medium text-ink">{s.name}</h3>
                  <div className="flex gap-1.5">
                    <Badge>{s.region}</Badge>
                    <Badge tone="brand">{s._count.students} estudante(s)</Badge>
                  </div>
                </div>
                {s.classes.length === 0 ? (
                  <p className="text-sm text-ink-soft">Nenhuma turma cadastrada nesta escola.</p>
                ) : (
                  <ul className="divide-y divide-line/60">
                    {s.classes.map((c) => {
                      const remove = deleteClass.bind(null, c.id);
                      const enrolled = studentsInClass.get(`${s.id}|${c.name}`) ?? 0;
                      const canManage = !user.schoolId || user.schoolId === s.id;
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm text-ink">
                          <span className="font-medium">{c.name}</span>
                          {c.gradeYear ? <span className="text-ink-soft">· {c.gradeYear}</span> : null}
                          <Badge>{SHIFTS[c.shift] ?? c.shift}</Badge>
                          <span className="ml-auto flex items-center gap-2">
                            {enrolled > 0 ? (
                              <span className="text-xs text-ink-soft">{enrolled} {enrolled === 1 ? "estudante" : "estudantes"}</span>
                            ) : canManage ? (
                              <ConfirmDelete action={remove} triggerAriaLabel={`Excluir a turma ${c.name}`} question={`Excluir “${c.name}”?`} confirmLabel="Excluir turma" />
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
