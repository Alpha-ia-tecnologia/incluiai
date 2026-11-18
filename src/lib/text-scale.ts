export const TEXT_SCALE_KEY = "incluiedu-texto";

export const TEXT_SCALES = [
  { value: "1", label: "Texto no tamanho padrão", fontSize: "" },
  { value: "2", label: "Texto grande", fontSize: "112.5%" },
  { value: "3", label: "Texto maior", fontSize: "125%" },
] as const;
export type TextScale = (typeof TEXT_SCALES)[number]["value"];
export const isTextScale = (value: unknown): value is TextScale => TEXT_SCALES.some((scale) => scale.value === value);

const ENLARGED = Object.fromEntries(TEXT_SCALES.filter((scale) => scale.fontSize).map((scale) => [scale.value, scale.fontSize]));

export function applyTextScale(root: { dataset: DOMStringMap; style: { fontSize: string } }, value: TextScale) {
  const fontSize = ENLARGED[value] ?? "";
  if (fontSize) root.dataset.textScale = value;
  else delete root.dataset.textScale;
  root.style.fontSize = fontSize;
}

export const TEXT_SCALE_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(TEXT_SCALE_KEY)}),z=${JSON.stringify(ENLARGED)};if(Object.prototype.hasOwnProperty.call(z,s)){var d=document.documentElement;d.dataset.textScale=s;d.style.fontSize=z[s]}}catch(e){}`;
