export const inputBoxCls = "min-h-11 min-w-0 rounded-xl border border-line bg-paper px-3.5 py-2 text-sm text-ink";
export const inputCls = `${inputBoxCls} w-full`;
export const textareaCls = `${inputCls} min-h-24 leading-relaxed`;
export const labelCls = "mb-2 block text-sm font-medium text-ink";
export const hintCls = "mb-2 text-sm leading-relaxed text-ink-soft";
export const choiceCls = "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink has-checked:border-brand has-checked:bg-brand-soft";
export const linkCls = "font-medium text-brand-strong underline underline-offset-4";

const buttonBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60";
export const BUTTON_CLS = {
  primary: `${buttonBase} bg-action px-5 py-2.5 text-on-action hover:bg-action-hover`,
  secondary: `${buttonBase} bg-action-soft px-5 py-2.5 text-action-ink inset-ring inset-ring-action-soft-line hover:bg-action-soft-hover`,
  quiet: `${buttonBase} border border-line bg-paper-raised px-4 py-2.5 text-ink hover:border-ink-soft`,
  danger: `${buttonBase} px-4 py-2.5 text-coral hover:bg-coral-soft`,
  dangerOutline: `${buttonBase} border border-coral/40 bg-paper-raised px-4 py-2.5 text-coral hover:bg-coral-soft`,
};
export type ButtonVariant = keyof typeof BUTTON_CLS;
