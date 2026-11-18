import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/roles";
import { PageHeader } from "@/components/ui";
import { StudentRegistrationChat } from "@/components/student-registration-chat";
import { createStudentAction } from "@/actions/students";

export default async function NewStudentPage() {
  const prisma = await db();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "pedagogical")) redirect("/");

  const own = user.schoolId ? { schoolId: user.schoolId } : {};
  const [schools, classes] = await Promise.all([
    prisma.school.findMany({ where: user.schoolId ? { id: user.schoolId } : {}, orderBy: { name: "asc" } }),
    prisma.schoolClass.findMany({ where: own, orderBy: { name: "asc" } }),
  ]);

  const schoolOptions = schools.map((school) => ({
    value: school.id,
    label: school.name,
    classes: classes
      .filter((schoolClass) => schoolClass.schoolId === school.id)
      .map((schoolClass) => ({
        name: schoolClass.name,
        gradeYear: schoolClass.gradeYear,
        shift: schoolClass.shift,
      })),
  }));

  return (
    <>
      <PageHeader
        title="Cadastrar estudante"
        lede="Uma conversa guiada. Você revisa tudo antes de criar o prontuário."
      />
      <StudentRegistrationChat schools={schoolOptions} action={createStudentAction} />
    </>
  );
}
