import type { Tenant } from "@/lib/prisma";
import { StatusPage } from "@/components/status-page";

export function TenantStatus({ tenant, domain }: { tenant: Tenant; domain: string }) {
  const municipality = tenant.kind === "municipio" ? tenant.municipality : null;
  const page = tenant.kind === "neutro"
    ? {
      eyebrow: "IncluiEdu",
      title: "Entre pelo endereço do seu município",
      text: `Cada município tem o próprio endereço na plataforma, como nome-do-municipio.${domain}. Se você não sabe qual é o seu, peça à Secretaria de Educação.`,
    }
    : !municipality
      ? {
        eyebrow: "Endereço não encontrado",
        title: "Nenhum município usa este endereço",
        text: "Confira se o endereço foi digitado certo. Se precisar, peça o endereço do seu município à Secretaria de Educação.",
      }
      : municipality.status === "suspenso"
        ? {
          eyebrow: municipality.name,
          title: "O acesso está suspenso",
          text: `O ambiente de ${municipality.name} na plataforma está suspenso no momento. Os registros continuam guardados. Para saber mais, fale com a Secretaria de Educação.`,
        }
        : {
          eyebrow: municipality.name,
          title: "O ambiente está sendo preparado",
          text: `O endereço de ${municipality.name} fica pronto em alguns minutos. Depois disso, é só entrar com o e-mail e a senha recebidos da Secretaria de Educação.`,
        };
  return (
    <main className="app-frame items-center justify-center px-4 py-10 sm:px-10 sm:py-16">
      <StatusPage character={municipality?.status === "suspenso" ? "care" : "resources"} eyebrow={page.eyebrow} title={page.title} actions={null}>
        <p>{page.text}</p>
      </StatusPage>
    </main>
  );
}
