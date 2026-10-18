import { recordJourneyMark } from "@/lib/user-journey";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isNetworkRole } from "@/lib/auth";
import { createSchool, createClass, deleteClass } from "@/actions/admin";
import { SHIFTS } from "@/lib/scale";
import { PageHeader, Card, SectionTitle, Badge, EmptyState, ButtonLink } from "@/components/ui";
import { ChoiceField } from "@/components/choice-field";
import { CLASS_NAME_OPTIONS, GRADE_YEAR_OPTIONS, REGION_OPTIONS } from "@/lib/form-options";
import { MapPin, School as SchoolIcon, Users, UserPlus, Trash2 } from "lucide-react";
import { inputCls, labelCls, primaryButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const fieldStyle = { labelClassName: labelCls, inputClassName: inputCls };
const shiftOptions = Object.entries(SHIFTS).map(([value, label]) => ({ value, label }));
// Os dois formulários terminam iguais: Salvar embaixo, no fim da linha. Com os
// cartões lado a lado, o botão fica na mesma altura nos dois. A grade dos campos
// segue a largura do cartão (container), que é estreito com os dois lado a lado.
const formCls = "@container flex flex-1 flex-col gap-5";
const fieldsCls = "grid items-start gap-4 @md:grid-cols-2";
const footerCls = "mt-auto flex justify-end border-t border-line pt-4";

export default async function RegistriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isNetworkRole(user.role)) redirect("/");
  await recordJourneyMark(user.id, "cadastros");

  const schools = await prisma.school.findMany({
    include: { classes: { orderBy: { name: "asc" } }, _count: { select: { students: true } } },
    orderBy: { name: "asc" },
  });
  // Regiões já usadas na rede entram nas opções, além das sugestões padrão.
  const regionOptions = [...new Set([...REGION_OPTIONS, ...schools.map((school) => school.region)])];

  return (
    <>
      <PageHeader
        title="Cadastros da rede"
        lede="Escolas, turmas e estudantes — a base do prontuário municipal. Turmas cadastradas alimentam o cadastro de alunos e o planejamento em lote."
        actions={
          <ButtonLink href="/estudantes/novo">
            <UserPlus size={16} aria-hidden /> Cadastrar aluno
          </ButtonLink>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex min-w-0 flex-col">
          <SectionTitle><span className="flex items-center gap-2"><SchoolIcon size={16} aria-hidden /> Nova escola</span></SectionTitle>
          <form action={createSchool} className={formCls}>
            <div className={fieldsCls}>
              <div className="min-w-0">
                <label htmlFor="school-name" className={labelCls}>Nome *</label>
                <input id="school-name" name="name" required placeholder="Ex.: EMEF Anísio Teixeira" className={inputCls} />
              </div>
              <ChoiceField name="region" label="Região / território *" options={regionOptions} required otherPlaceholder="Ex.: Distrito Industrial" {...fieldStyle} />
            </div>
            <div className={footerCls}>
              <button type="submit" className={primaryButtonCls}>Salvar escola</button>
            </div>
          </form>
        </Card>

        <Card className="flex min-w-0 flex-col">
          <SectionTitle><span className="flex items-center gap-2"><Users size={16} aria-hidden /> Nova turma</span></SectionTitle>
          <form action={createClass} className={formCls}>
            <div className={fieldsCls}>
              <div className="min-w-0">
                <label htmlFor="class-school" className={labelCls}>Escola *</label>
                <select id="class-school" name="schoolId" required className={inputCls}>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <ChoiceField name="name" label="Nome da turma *" options={CLASS_NAME_OPTIONS} required otherPlaceholder="Ex.: Turma Girassol" {...fieldStyle} />
              <ChoiceField name="gradeYear" label="Ano / série" options={GRADE_YEAR_OPTIONS} placeholder="Escolha (opcional)" otherPlaceholder="Ex.: Multisseriada" {...fieldStyle} />
              <ChoiceField name="shift" label="Turno *" options={shiftOptions} defaultValue="manha" required otherPlaceholder="Ex.: Noite" {...fieldStyle} />
            </div>
            <div className={footerCls}>
              <button type="submit" className={primaryButtonCls}>Salvar turma</button>
            </div>
          </form>
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle>Escolas e turmas da rede</SectionTitle>
        {schools.length === 0 ? (
          <EmptyState character="resources" title="Nenhuma escola cadastrada" hint="Cadastre a primeira escola acima. Depois, inclua as turmas que recebem os estudantes." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {schools.map((s) => (
              <Card key={s.id} className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-ink">{s.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft"><MapPin size={14} className="shrink-0" aria-hidden /> {s.region}</p>
                  </div>
                  <Badge tone="brand"><span className="tabular-nums">{s._count.students}</span> {s._count.students === 1 ? "estudante" : "estudantes"}</Badge>
                </div>
                {s.classes.length === 0 ? (
                  <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">Nenhuma turma cadastrada nesta escola.</p>
                ) : (
                  // Tabela leve; se não couber numa tela estreita, rola dentro do cartão.
                  <div className="mt-4 min-w-0 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <caption className="sr-only">Turmas da escola {s.name}</caption>
                      <thead>
                        <tr className="border-b border-line text-xs text-ink-soft">
                          <th scope="col" className="py-2 pr-3 font-medium">Turma</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Ano</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Turno</th>
                          <th scope="col" className="py-2 text-right font-medium">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/70">
                        {s.classes.map((c) => {
                          const remove = deleteClass.bind(null, c.id);
                          return (
                            <tr key={c.id} className="text-ink">
                              <th scope="row" className="py-1 pr-3 font-medium">{c.name}</th>
                              <td className="py-1 pr-3">
                                {c.gradeYear ?? <><span aria-hidden className="text-ink-soft">—</span><span className="sr-only">Não informado</span></>}
                              </td>
                              <td className="py-1 pr-3">{SHIFTS[c.shift] ?? c.shift}</td>
                              <td className="py-1 text-right">
                                <form action={remove}>
                                  <button type="submit" aria-label={`Excluir a turma ${c.name} da escola ${s.name}`} title="Excluir turma" className="inline-flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-coral-soft hover:text-coral">
                                    <Trash2 size={16} aria-hidden />
                                  </button>
                                </form>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
