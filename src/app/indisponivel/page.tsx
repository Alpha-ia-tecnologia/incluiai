import { redirect } from "next/navigation";
import { TenantStatus } from "@/components/tenant-status";
import { currentTenant, platformDomain } from "@/lib/prisma";
import { isAvailable } from "@/lib/tenant";

export default async function UnavailablePage() {
  const tenant = await currentTenant();
  if (isAvailable(tenant)) redirect("/");
  return <TenantStatus tenant={tenant} domain={platformDomain() ?? ""} />;
}
