import { LoadingScreen } from "@/components/skeleton";

// A conversa com o assistente abre com o herói azul-claro.
export default function Loading() {
  return <LoadingScreen kind="hero" label="Carregando o assistente" />;
}
