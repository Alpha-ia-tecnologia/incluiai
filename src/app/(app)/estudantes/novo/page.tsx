import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { StudentRegistrationChat } from "@/components/student-registration-chat";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffOrNetwork(user.role)) redirect("/");

  const [schools, classes] = await Promise.all([
    prisma.school.findMany({ orderBy: { name: "asc" } }),
    prisma.schoolClass.findMany({ orderBy: { name: "asc" } }),
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
        lede="Conte um pouco sobre o estudante em uma conversa guiada. Ao final, revise as informações antes de criar o prontuário."
      />
      <StudentRegistrationChat schools={schoolOptions} />
    </>
  );
}
