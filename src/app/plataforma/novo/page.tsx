import Link from "next/link";
import { ArrowLeft, Database, Globe, KeyRound } from "lucide-react";
import { requirePlatformUser } from "@/lib/auth";
import { platformDomain } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { Steps } from "@/components/explain";
import { linkCls } from "@/components/form-styles";
import { MunicipalityForm } from "@/components/plataforma/municipality-form";

export const dynamic = "force-dynamic";

export default async function NewMunicipalityPage() {
  await requirePlatformUser();
  return (
    <>
      <Link href="/plataforma" className={`mb-4 inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Municípios</Link>
      <PageHeader title="Novo município" lede="O município ganha o próprio endereço, um banco de dados só dele e a marca escolhida aqui." />
      <Steps
        label="O que acontece ao cadastrar"
        className="mb-6"
        items={[
          { icon: Database, label: "O banco do município é criado" },
          { icon: KeyRound, label: "A Secretaria recebe a senha temporária" },
          { icon: Globe, label: "O endereço passa a funcionar" },
        ]}
      />
      <Card className="max-w-3xl">
        <MunicipalityForm domain={platformDomain() ?? ""} />
      </Card>
    </>
  );
}
