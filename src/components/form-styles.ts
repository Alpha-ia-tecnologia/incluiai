export const inputBoxCls = "min-h-11 min-w-0 rounded-xl border border-line bg-paper px-3.5 py-2 text-sm text-ink placeholder:text-ink-soft/70";
export const inputCls = `${inputBoxCls} w-full`;
export const textareaCls = `${inputCls} min-h-24 leading-relaxed`;
export const labelCls = "mb-2 block text-sm font-medium text-ink";
export const hintCls = "mb-2 text-xs leading-relaxed text-ink-soft";
export const choiceCls = "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink has-checked:border-brand has-checked:bg-brand-soft";
export const linkCls = "font-medium text-brand-strong underline underline-offset-4";

const buttonBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60";
export const BUTTON_CLS = {
  primary: `${buttonBase} bg-brand px-5 py-2.5 text-white hover:bg-brand-strong`,
  secondary: `${buttonBase} bg-brand-soft px-5 py-2.5 text-brand-strong hover:bg-lilac`,
  quiet: `${buttonBase} border border-line bg-paper-raised px-4 py-2.5 text-ink hover:border-ink-soft`,
  danger: `${buttonBase} px-4 py-2.5 text-coral hover:bg-coral-soft`,
  dangerOutline: `${buttonBase} border border-coral/40 bg-paper-raised px-4 py-2.5 text-coral hover:bg-coral-soft`,
  primaryOnNavy: `${buttonBase} bg-accent-sky px-5 py-2.5 text-ink-strong hover:bg-on-navy`,
  secondaryOnNavy: `${buttonBase} border border-navy-line bg-navy-hover px-5 py-2.5 text-on-navy hover:bg-navy-line`,
};
export type ButtonVariant = keyof typeof BUTTON_CLS;
