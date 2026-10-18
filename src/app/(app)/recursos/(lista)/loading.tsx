import { LoadingScreen } from "@/components/skeleton";

// Só o catálogo abre com o herói lilás: o grupo (lista) deixa a página de cada
// recurso com o carregamento padrão.
export default function Loading() {
  return <LoadingScreen kind="hero" label="Carregando os recursos" />;
}
