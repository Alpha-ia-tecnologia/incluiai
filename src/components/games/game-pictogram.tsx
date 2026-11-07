import Image from "next/image";
import { GAME_PHOTOS } from "@/lib/games/game-photos";

// Mantém o contrato dos jogos existentes; as figuras agora são fotografias.
// Os botões e cartões de cada jogo fornecem os nomes acessíveis.
export function GamePictogram({ name, size = 160, className = "" }: { name: string; size?: number; className?: string }) {
  const src = GAME_PHOTOS[name];
  if (!src) return <span aria-hidden data-game-photo-missing={name} className={className}>Imagem indisponível</span>;
  return <Image data-game-photo={name} src={src} alt="" aria-hidden width={size} height={size} sizes={`${size}px`} className={className} style={{ display: "block", width: size, height: "auto", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />;
}
