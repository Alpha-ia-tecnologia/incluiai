import Image from "next/image";
import { Sprout } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { CardView } from "@/lib/student-card";

// Carteirinha no tamanho de um cartão (85,6 × 54 mm), igual na tela e no papel.
// Frente e verso ficam lado a lado: impressas, recorta-se pela borda e dobra-se
// na linha do meio. Sem diagnóstico: só identificação, o que a família escolheu
// mostrar e o QR, que pede login para abrir qualquer coisa.
function Front({ view }: { view: CardView }) {
  return (
    <div className="id-card relative flex flex-col overflow-hidden rounded-xl border border-line bg-paper-raised text-ink">
      <div className="flex items-center justify-between gap-2 bg-brand px-3 py-1.5 text-white">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-tight"><Sprout size={14} aria-hidden /> IncluiEdu</span>
        <span className="text-xs">Carteirinha do estudante</span>
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-3 px-3 pb-3 pt-2">
        {view.photoUrl ? (
          <Image src={view.photoUrl} alt={`Foto de ${view.name}`} width={84} height={106} unoptimized className="h-[28mm] w-[22mm] shrink-0 rounded-lg border border-line object-cover" />
        ) : (
          <span aria-hidden className="flex h-[28mm] w-[22mm] shrink-0 items-center justify-center rounded-lg font-display text-3xl font-bold text-white" style={{ backgroundColor: `hsl(${view.avatarHue} 45% 42%)` }}>{view.initials}</span>
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 text-base font-bold leading-tight">{view.name}</p>
          <p className="mt-1 text-xs leading-snug">{view.classLine}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-soft">{view.school}</p>
        </div>
      </div>
      <div aria-hidden className="id-card-stripe absolute inset-x-0 bottom-0 h-1.5" />
    </div>
  );
}

function Back({ view }: { view: CardView }) {
  const { help, emergency } = view;
  return (
    <div className="id-card flex gap-3 overflow-hidden rounded-xl border border-line bg-paper-raised p-3 text-ink">
      <div className="flex min-w-0 flex-1 flex-col">
        {help ? (
          <>
            <p className="text-xs font-semibold text-brand-strong">Como me ajudar</p>
            <dl className="mt-0.5 space-y-0.5 text-xs leading-snug">
              {help.communication ? <div className="line-clamp-2"><dt className="inline font-semibold">Me comunico: </dt><dd className="inline">{help.communication}</dd></div> : null}
              {help.calming.length ? <div className="line-clamp-2"><dt className="inline font-semibold">Me acalma: </dt><dd className="inline">{help.calming.join(", ")}</dd></div> : null}
              {help.avoid.length ? <div className="line-clamp-2"><dt className="inline font-semibold">Me incomoda: </dt><dd className="inline">{help.avoid.join(", ")}</dd></div> : null}
            </dl>
          </>
        ) : <p className="text-xs leading-snug text-ink-soft">A equipe da escola lê o código e entra na plataforma para ver o acompanhamento.</p>}
        {emergency ? (
          <p className="mt-auto line-clamp-2 pt-1 text-xs leading-snug">
            <span className="font-semibold">Em emergência:</span> {emergency.name}{emergency.relation ? ` (${emergency.relation})` : ""} · <span className="whitespace-nowrap tabular-nums">{emergency.phone}</span>
          </p>
        ) : null}
        <p className={`${emergency ? "" : "mt-auto "}pt-0.5 text-xs text-ink-soft`}>Emitida em {formatDate(view.issuedAt)}</p>
      </div>
      <div className="flex w-[23mm] shrink-0 flex-col items-center">
        {/* SVG gerado no servidor pela biblioteca qrcode, a partir do endereço da plataforma. */}
        <div aria-hidden data-qr-path={view.qrPath} className="size-[23mm] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: view.qrSvg }} />
        <p className="mt-1 text-center text-xs leading-tight text-ink-soft">Leia e entre na plataforma</p>
      </div>
    </div>
  );
}

export function StudentCardView({ view }: { view: CardView }) {
  return (
    <figure aria-label={`Carteirinha de ${view.name}`} className="id-card-frame min-w-0">
      <div className="id-card-sheet flex flex-wrap gap-4">
        <Front view={view} />
        <Back view={view} />
      </div>
      <figcaption className="sr-only">
        {view.help ? "O verso mostra como ajudar o estudante. " : ""}{view.emergency ? `Contato de emergência: ${view.emergency.name}, ${view.emergency.phone}. ` : ""}O código QR leva à plataforma e pede login.
      </figcaption>
    </figure>
  );
}
