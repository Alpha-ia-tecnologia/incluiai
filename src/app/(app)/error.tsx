"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { primaryButtonCls, quietButtonCls } from "@/components/form-styles";

// Falha inesperada ao montar uma tela: o menu continua à mão e a pessoa pode
// tentar de novo sem perder o lugar.
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      character="care"
      eyebrow="Algo não saiu como esperado"
      title="Não foi possível abrir esta tela agora"
      actions={<>
        <button type="button" onClick={() => unstable_retry()} className={primaryButtonCls}><RotateCcw size={16} aria-hidden /> Tentar de novo</button>
        <Link href="/" className={quietButtonCls}><ArrowLeft size={16} aria-hidden /> Voltar para o início</Link>
      </>}
    >
      <p>Pode ter sido uma falha passageira de conexão. O que já estava salvo continua salvo.{error.digest ? ` Se o problema continuar, informe à equipe técnica o código ${error.digest}.` : ""}</p>
    </StatusPage>
  );
}
