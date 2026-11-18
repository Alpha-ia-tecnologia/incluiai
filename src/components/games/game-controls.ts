"use client";

import { useEffect, useRef, useState } from "react";

export type GameControls = {
  registerHint: (handler: (() => void) | null) => void;
  onHint: () => void;
  onRetry: () => void;
  onProgress: (done: number) => void;
  onFinish: () => void;
  onFeedback: (text: string, spoken?: string) => void;
  onInstruction: (text: string) => void;
};

export const FEEDBACK_PAUSE = 900;
export const GAME_SPEECH_RATE = 0.85;
const HINT_MS = 2000;

export function useHint<T>({ registerHint, onHint }: GameControls, empty: T, pick: () => T | null): [T, () => void] {
  const [hinted, setHinted] = useState<T>(empty);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    registerHint(() => {
      const value = pick();
      if (value === null) return;
      setHinted(value);
      onHint();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setHinted(empty), HINT_MS);
    });
  });
  useEffect(() => () => {
    registerHint(null);
    if (timer.current) clearTimeout(timer.current);
  }, [registerHint]);
  return [hinted, () => setHinted(empty)];
}
