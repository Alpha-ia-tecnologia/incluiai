// Contrato entre o palco (game-player) e cada jogo.
export type GameControls = {
  // O jogo registra a sua dica; o botão "Dica" do palco a chama. Quem mostra a dica chama onHint.
  registerHint: (handler: (() => void) | null) => void;
  onHint: () => void;
  onRetry: () => void;
  onProgress: (done: number) => void;
  onFinish: () => void;
  // Mensagem curta para a faixa de retorno (lida pelo leitor de tela) e, se o som estiver ligado, falada.
  onFeedback: (text: string, spoken?: string) => void;
  // A instrução do momento, que o botão "Ouvir" fala.
  onInstruction: (text: string) => void;
};
