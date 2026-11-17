export type GameControls = {
  registerHint: (handler: (() => void) | null) => void;
  onHint: () => void;
  onRetry: () => void;
  onProgress: (done: number) => void;
  onFinish: () => void;
  onFeedback: (text: string, spoken?: string) => void;
  onInstruction: (text: string) => void;
};
