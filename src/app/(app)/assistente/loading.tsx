import { LoadingScreen } from "@/components/skeleton";

// A conversa com o assistente abre com o herói lilás.
export default function Loading() {
  return <LoadingScreen kind="hero" label="Carregando o assistente" />;
}
