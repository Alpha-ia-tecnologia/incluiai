import { LoadingScreen } from "@/components/skeleton";

// O calendário abre com o herói azul-claro.
export default function Loading() {
  return <LoadingScreen kind="hero" label="Carregando o calendário" />;
}
