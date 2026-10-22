import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { formatDate } from "@/lib/format";
import { setNoticePrefs } from "@/actions/notifications";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { NoticePrefsForm } from "@/components/notice-forms";

export const dynamic = "force-dynamic";

// Avisos da pessoa (item 6): abrir a página marca os novos como lidos.
export default async function NoticesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [notices, prefs] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { notifyByEmail: true, weeklyCheckIn: true } }),
  ]);
  const unread = new Set(notices.filter((notice) => !notice.readAt).map((notice) => notice.id));
  if (unread.size) await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return (
    <>
      <PageHeader title="Avisos" lede="O que mudou no acompanhamento: materiais aprovados, relatórios, revisões do plano, respostas da família e pendências do Censo Escolar." />
      <div className="grid max-w-3xl gap-6">
        {notices.length ? (
          <ul className="grid gap-2">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link href={notice.href} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper-raised px-4 py-3 text-sm hover:border-brand">
                  <span className="flex min-w-0 items-center gap-2 text-ink"><Bell size={16} aria-hidden className="shrink-0 text-brand-strong" /> {notice.title}</span>
                  <span className="flex items-center gap-2 text-xs text-ink-soft">{unread.has(notice.id) ? <Badge tone="brand">Novo</Badge> : null}{formatDate(notice.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState character="care" title="Nenhum aviso ainda" hint="Quando houver novidade no acompanhamento, ela aparece aqui." />
        )}
        <Card>
          <SectionTitle>Como receber os avisos</SectionTitle>
          <NoticePrefsForm action={setNoticePrefs} notifyByEmail={prefs.notifyByEmail} weeklyCheckIn={prefs.weeklyCheckIn} emailOn={emailConfigured()} family={user.role === "familia"} />
        </Card>
      </div>
    </>
  );
}
