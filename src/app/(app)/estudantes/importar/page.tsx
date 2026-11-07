import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, UserCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { schoolsFor } from "@/lib/accounts";
import { isAccountManager } from "@/lib/user-admin";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import { StudentImportForm } from "@/components/student-import-form";
import { linkCls } from "@/components/form-styles";
import { Assurances, HowToRead } from "@/components/explain";

export const dynamic = "force-dynamic";

const REQUIRED = [
  ["nome", "nome completo do estudante"],
  ["nascimento", "DD/MM/AAAA"],
  ["ano", "como 2º ano ou Pré II"],
  ["turma", "como Turma A"],
  ["turno", "manhã, tarde, integral ou noite"],
  ["responsavel", "nome de quem responde pelo estudante"],
];
const OPTIONAL = [
  ["etapa", "Educação infantil, Anos iniciais, Anos finais, Ensino médio ou EJA (vazia: sai do ano)"],
  ["telefone", "do responsável"],
  ["aee", "sim ou não"],
  ["frequencia_aee", "obrigatória com AEE, como 2x por semana"],
  ["profissional_de_apoio", "sim ou não"],
];

const Columns = ({ title, items }: { title: string; items: string[][] }) => (
  <div>
    <h3 className="mb-2 text-sm font-medium text-ink">{title}</h3>
    <ul className="flex flex-wrap gap-1.5">{items.map(([name]) => <li key={name}><code className="rounded-full bg-surface-muted px-2.5 py-1 font-mono text-xs text-ink">{name}</code></li>)}</ul>
  </div>
);

// Importar estudantes de uma planilha (cadastro da rede): para a gestão e a
// coordenação da escola, e para a Secretaria, escolhendo a escola.
export default async function ImportStudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAccountManager(user.role)) redirect("/estudantes");
  const schools = await schoolsFor(user);
  return (
    <>
      <Link href="/estudantes" className={`mb-4 inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Estudantes</Link>
      <PageHeader title="Importar estudantes" />
      <div className="grid max-w-3xl gap-6">
        <Assurances
          label="Garantias da importação"
          items={[
            { icon: ShieldCheck, text: "Nada é gravado antes de conferir" },
            { icon: UserCheck, text: "Já cadastrados ficam de fora" },
          ]}
        />
        <Card>
          <SectionTitle>1. Prepare a planilha</SectionTitle>
          <p className="mb-4 text-sm text-ink-soft">Uma linha por estudante. Na primeira, o nome das colunas, em qualquer ordem.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Columns title="Colunas obrigatórias" items={REQUIRED} />
            <Columns title="Colunas opcionais" items={OPTIONAL} />
          </div>
          <HowToRead summary="O que vai em cada coluna" className="mt-3">
            <dl className="grid gap-1.5">
              {[...REQUIRED, ...OPTIONAL].map(([name, hint]) => <div key={name}><dt className="inline font-mono text-ink">{name}:</dt> <dd className="inline">{hint}</dd></div>)}
            </dl>
            <p className="mt-2">Acentos e maiúsculas no nome da coluna não importam. Fica de fora quem já tem o mesmo nome e nascimento na escola.</p>
          </HowToRead>
        </Card>
        <Card>
          <SectionTitle>2. Envie e confira</SectionTitle>
          <StudentImportForm schools={schools} fixedSchool={Boolean(user.schoolId)} />
        </Card>
      </div>
    </>
  );
}
