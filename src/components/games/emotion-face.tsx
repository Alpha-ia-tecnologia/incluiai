import type { Emotion } from "@/lib/games/games-core";
import { GamePictogram } from "./game-pictogram";

export function EmotionFace({ emotion, size = 112, className = "" }: { emotion: Emotion; size?: number; className?: string }) {
  return <GamePictogram name={`emocao-${emotion}`} size={size} className={className} />;
}
