import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { schoolsFor } from "@/lib/accounts";
import { isAccountManager } from "@/lib/user-admin";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import { StudentImportForm } from "@/components/student-import-form";
import { linkCls } from "@/components/form-styles";

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
  ["etapa", "Educação infantil, Anos iniciais, Anos finais, Ensino médio ou EJA; sem ela, a etapa sai do ano"],
  ["telefone", "do responsável"],
  ["aee", "sim ou não"],
  ["frequencia_aee", "obrigatória com AEE, como 2x por semana"],
  ["profissional_de_apoio", "sim ou não"],
];

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
      <PageHeader title="Importar estudantes" lede="Cadastre uma turma inteira de uma vez, a partir da planilha da secretaria escolar. Nada é gravado antes de você conferir." />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <SectionTitle>1. Prepare a planilha</SectionTitle>
          <p className="mb-4 text-sm leading-relaxed text-ink-soft">Uma linha por estudante. A primeira linha tem o nome das colunas, em qualquer ordem; acentos e maiúsculas não importam.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Colunas obrigatórias</h3>
              <ul className="grid gap-1.5 text-sm text-ink-soft">{REQUIRED.map(([name, hint]) => <li key={name}><code className="font-mono text-ink">{name}</code>: {hint}</li>)}</ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Colunas opcionais</h3>
              <ul className="grid gap-1.5 text-sm text-ink-soft">{OPTIONAL.map(([name, hint]) => <li key={name}><code className="font-mono text-ink">{name}</code>: {hint}</li>)}</ul>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">Quem já está cadastrado na escola (mesmo nome e nascimento) fica de fora, e cada linha com problema aparece com o motivo.</p>
        </Card>
        <Card>
          <SectionTitle>2. Envie e confira</SectionTitle>
          <StudentImportForm schools={schools} fixedSchool={Boolean(user.schoolId)} />
        </Card>
      </div>
    </>
  );
}
