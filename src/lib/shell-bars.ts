// Regras da moldura no celular e no tablet: a barra de cima que some ao rolar
// para baixo e o "modo formulário" (barra de salvar no lugar da navegação).

export type TopBar = { hidden: boolean; anchor: number };

export const TOP_BAR_START: TopBar = { hidden: false, anchor: 0 };

// anchor: o ponto em que a rolagem mudou de sentido. A barra só troca de estado
// depois de `travel` px no novo sentido, para não piscar com o dedo parado.
export function nextTopBar(state: TopBar, scrollY: number, { revealAt = 64, travel = 12 } = {}): TopBar {
  if (scrollY <= revealAt) return state.hidden || state.anchor !== scrollY ? { hidden: false, anchor: scrollY } : state;
  if (state.hidden) {
    if (scrollY > state.anchor) return { hidden: true, anchor: scrollY };
    return state.anchor - scrollY >= travel ? { hidden: false, anchor: scrollY } : state;
  }
  if (scrollY < state.anchor) return { hidden: false, anchor: scrollY };
  return scrollY - state.anchor >= travel ? { hidden: true, anchor: scrollY } : state;
}

// Quanto do fim da página o teclado na tela cobre (o visualViewport encolhe e o
// layout fica do mesmo tamanho no iOS e, desde o Chrome 108, no Android).
export function keyboardInset({ layoutHeight, visualHeight, visualTop }: { layoutHeight: number; visualHeight: number; visualTop: number }): number {
  const inset = Math.round(layoutHeight - visualHeight - visualTop);
  return inset > 0 ? inset : 0;
}

const NOT_FIELDS = new Set(["hidden", "submit", "button", "reset", "image"]);

// Campo em que a pessoa está preenchendo (não conta botão).
export function isFormField(tagName: string, type = ""): boolean {
  const tag = tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  return tag === "INPUT" && !NOT_FIELDS.has(type.toLowerCase());
}

// A barra de salvar está presa quando a borda de baixo dela fica no ponto de
// parada (o `bottom` calculado), e não onde ela estaria no fim do formulário.
export const isStuckAtBottom = (rectBottom: number, viewportHeight: number, bottomOffset: number) =>
  Math.abs(viewportHeight - bottomOffset - rectBottom) < 1.5;
