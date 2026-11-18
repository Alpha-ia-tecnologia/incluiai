import { redirect } from "next/navigation";
import { TenantStatus } from "@/components/tenant-status";
import { currentTenant } from "@/lib/prisma";
import { platformDomain } from "@/lib/env-config";
import { isAvailable } from "@/lib/tenant";

export default async function UnavailablePage() {
  const tenant = await currentTenant();
  if (isAvailable(tenant)) redirect("/");
  return <TenantStatus tenant={tenant} domain={platformDomain() ?? ""} />;
}
