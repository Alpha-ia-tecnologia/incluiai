import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-14">
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">Página não encontrada</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
        O endereço pode ter mudado ou o registro não existe mais. Volte ao início para continuar o acompanhamento.
      </p>
      <Link href="/" className="task-action mt-6 w-fit">Voltar ao início</Link>
    </main>
  );
}
