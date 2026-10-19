import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { linkableStudents, schoolsFor } from "@/lib/accounts";
import { assignableRoles, isAccountManager } from "@/lib/user-admin";
import { createAccount } from "@/actions/users";
import { ROLES } from "@/lib/scale";
import { PageHeader, Card } from "@/components/ui";
import { AccountForm } from "@/components/accounts/account-form";
import { linkCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAccountManager(user.role)) redirect("/");
  const [schools, students] = await Promise.all([schoolsFor(user), linkableStudents(user)]);
  return (
    <>
      <Link href="/usuarios" className={`mb-4 inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Pessoas e acessos</Link>
      <PageHeader title="Nova conta" lede="A plataforma gera uma senha temporária para você entregar à pessoa. No primeiro acesso, ela cria a própria senha." />
      <Card className="max-w-3xl">
        <AccountForm
          mode="create"
          action={createAccount}
          roles={assignableRoles(user).map((value) => ({ value, label: ROLES[value] ?? value }))}
          schools={schools}
          fixedSchool={Boolean(user.schoolId)}
          students={students.map((student) => ({ id: student.id, name: student.name, detail: `${student.gradeYear} · ${student.className}` }))}
        />
      </Card>
    </>
  );
}
