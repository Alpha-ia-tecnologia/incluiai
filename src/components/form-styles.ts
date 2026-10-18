// Kit de formulário e botões: os mesmos campos, rótulos e botões em toda a
// aplicação. Uma mudança aqui vale para todas as telas.

export const inputCls = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-paper px-3.5 py-2 text-sm text-ink placeholder:text-ink-soft/70";
export const textareaCls = `${inputCls} min-h-24 leading-relaxed`;
export const labelCls = "mb-2 block text-sm font-medium text-ink";
export const hintCls = "mb-2 text-xs leading-relaxed text-ink-soft";
// Opção em cartão (rádio ou caixa de seleção dentro do rótulo).
export const choiceCls = "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink has-checked:border-brand has-checked:bg-brand-soft";
export const linkCls = "font-medium text-brand-strong underline underline-offset-4";

// Botões: uma família em pílula, com quatro pesos. Principal = a ação da tela;
// secundário = outra ação útil; discreto = cancelar, filtrar, navegar; perigo = excluir.
const buttonBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60";
export const primaryButtonCls = `${buttonBase} bg-brand px-5 py-2.5 text-white hover:bg-brand-strong`;
export const secondaryButtonCls = `${buttonBase} bg-brand-soft px-5 py-2.5 text-brand-strong hover:bg-lilac`;
export const quietButtonCls = `${buttonBase} border border-line bg-paper-raised px-4 py-2.5 text-ink hover:border-ink-soft`;
export const dangerButtonCls = `${buttonBase} px-4 py-2.5 text-coral hover:bg-coral-soft`;

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export const BUTTON_CLS: Record<ButtonVariant, string> = {
  primary: primaryButtonCls,
  secondary: secondaryButtonCls,
  quiet: quietButtonCls,
  danger: dangerButtonCls,
};
