import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { unreadNotices } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <Shell user={user} notices={await unreadNotices(user.id)}>{children}</Shell>;
}
