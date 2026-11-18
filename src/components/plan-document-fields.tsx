import { MultiChoiceField } from "@/components/choice-field";
import { inputCls, labelCls } from "@/components/form-styles";
import { PLAN_FIELDS, type PlanDocuments, type PlanField } from "@/lib/plan-documents";

const legendCls = "px-1 text-sm font-semibold text-ink";

function FieldOf({ field, idPrefix, defaults }: { field: PlanField; idPrefix: string; defaults: Partial<PlanDocuments> }) {
  const value = defaults[field.key] ?? "";
  if (field.kind === "teacher") {
    const id = `${idPrefix}-${field.key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    return (
      <div className="min-w-0">
        <label htmlFor={id} className={labelCls}>{field.label}</label>
        <input id={id} name={field.key} maxLength={120} defaultValue={value} autoComplete="off" className={inputCls} />
      </div>
    );
  }
  return <MultiChoiceField name={field.key} label={field.label} hint={"hint" in field ? field.hint : undefined} options={field.options} defaultValue={value} />;
}

export function PlanDocumentFields({ idPrefix, defaults = {} }: { idPrefix: string; defaults?: Partial<PlanDocuments> }) {
  const group = (test: (field: PlanField) => boolean) => PLAN_FIELDS.filter(test).map((field) => <FieldOf key={field.key} field={field} idPrefix={idPrefix} defaults={defaults} />);
  const census = (field: PlanField) => "census" in field && field.census;
  return (
    <div className="grid min-w-0 gap-5">
      <fieldset className="grid min-w-0 gap-5 rounded-2xl border border-brand/30 bg-brand-soft/30 p-4">
        <legend className={legendCls}>Declarado no Censo Escolar <span className="font-normal text-ink-soft">· PEI, art. 11, I e II</span></legend>
        {group(census)}
      </fieldset>
      <fieldset className="grid min-w-0 gap-5 rounded-2xl border border-line p-4">
        <legend className={legendCls}>PAEE <span className="font-normal text-ink-soft">· Portaria, art. 10</span></legend>
        {group((field) => field.part === "paee" && !census(field))}
      </fieldset>
      <fieldset className="grid min-w-0 gap-5 rounded-2xl border border-line p-4">
        <legend className={legendCls}>PEI <span className="font-normal text-ink-soft">· Portaria, art. 11</span></legend>
        {group((field) => field.part === "pei" && !census(field))}
      </fieldset>
      {group((field) => field.part === "equipe")}
    </div>
  );
}
