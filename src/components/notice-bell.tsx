"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

// O layout não renderiza de novo a cada navegação: abrir Avisos zera o número
// aqui mesmo, até chegar um aviso mais novo (outro `latest`).
export function NoticeBell({ unread, latest }: { unread: number; latest: string | null }) {
  const pathname = usePathname();
  const [seen, setSeen] = useState<string | null>(null);
  if (pathname === "/avisos" && latest && seen !== latest) setSeen(latest);
  const count = latest && seen === latest ? 0 : unread;
  return (
    <Link href="/avisos" aria-label={count ? `Avisos: ${count} ${count === 1 ? "novo" : "novos"}` : "Avisos"} className="relative flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-brand-soft hover:text-brand-strong">
      <Bell size={20} aria-hidden />
      {count ? <span aria-hidden className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-coral px-1 text-xs font-medium tabular-nums text-white">{count > 9 ? "9+" : count}</span> : null}
    </Link>
  );
}
