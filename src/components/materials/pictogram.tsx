import {
  Armchair, Backpack, BookOpen, CalendarDays, Droplet, GraduationCap, HandHeart, Headphones, HeartHandshake, Hourglass, House,
  MessagesSquare, Music, Palette, PencilLine, Puzzle, Sandwich, School, Smile, Star, Tablet, Toilet, Trash2, Users, Wind,
  type LucideIcon,
} from "lucide-react";
import type { PictogramKey } from "@/lib/pictograms";

// Pictograma de reserva do cartão sem imagem desenhada (a escolha da chave fica
// em src/lib/pictograms.ts). É decorativo: quem chama põe a descrição do cartão
// em texto para o leitor de tela.

const ICONS: Record<PictogramKey, LucideIcon> = {
  calendario: CalendarDays,
  professora: GraduationCap,
  fone: Headphones,
  prancha: MessagesSquare,
  lanche: Sandwich,
  agua: Droplet,
  banheiro: Toilet,
  maos: HandHeart,
  pausa: Wind,
  brincar: Puzzle,
  ler: BookOpen,
  escrever: PencilLine,
  desenhar: Palette,
  casa: House,
  escola: School,
  amigos: Users,
  musica: Music,
  tela: Tablet,
  feliz: Smile,
  sentimentos: HeartHandshake,
  esperar: Hourglass,
  mochila: Backpack,
  sentar: Armchair,
  lixo: Trash2,
  estrela: Star,
};

// print-color-adjust: o fundo azul-claro sai também no papel (o navegador corta fundos por padrão).
export function Pictogram({ pictogram, className = "w-full" }: { pictogram: PictogramKey; className?: string }) {
  const Icon = ICONS[pictogram];
  return (
    <span data-pictogram={pictogram} className={`flex aspect-square items-center justify-center rounded-2xl bg-brand-soft text-brand-strong [-webkit-print-color-adjust:exact] [print-color-adjust:exact] ${className}`}>
      <Icon aria-hidden className="size-1/2" strokeWidth={1.5} />
    </span>
  );
}
