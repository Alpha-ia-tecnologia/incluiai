import { LoadingScreen } from "@/components/skeleton";

// O calendário abre com o herói lilás.
export default function Loading() {
  return <LoadingScreen kind="hero" label="Carregando o calendário" />;
}
