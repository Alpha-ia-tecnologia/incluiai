import { MultiChoiceField } from "@/components/choice-field";
import { inputCls, labelCls } from "@/components/form-styles";
import { ACCESSIBILITY_RESOURCE_OPTIONS, AEE_STRATEGY_OPTIONS, COMMON_ROOM_STRATEGY_OPTIONS } from "@/lib/form-options";
import {
  AEE_SERVICE_OPTIONS, ASSESSMENT_ACCESSIBILITY_OPTIONS, ASSISTIVE_TECH_OPTIONS, FAMILY_FEEDBACK_OPTIONS, MONITORING_OPTIONS,
  NETWORK_DEMAND_OPTIONS, PLAN_PARTICIPANT_OPTIONS, SUPPORT_STAFF_OPTIONS, type PlanDocuments,
} from "@/lib/plan-documents";

// Os campos do PAEE e do PEI (Portaria MEC nº 421/2026, arts. 10 e 11), com quem
// elabora cada um, como orienta o INEP. Mesmos campos ao criar, ao ativar a
// proposta e ao completar um plano. `idPrefix` evita ids repetidos na página.
// Atendimentos do AEE e recursos na avaliação usam os nomes do Educacenso.
const multi = { legendClassName: labelCls, inputClassName: inputCls };
const legendCls = "px-1 text-sm font-semibold text-ink";

export function PlanDocumentFields({ idPrefix, defaults = {} }: { idPrefix: string; defaults?: Partial<PlanDocuments> }) {
  const value = (key: keyof PlanDocuments) => defaults[key] ?? "";
  return (
    <div className="grid min-w-0 gap-5">
      {/* O que a escola declara no Censo Escolar vem primeiro: os tipos de AEE
          (registro 60) e os recursos na avaliação (registro 30). Fazem parte do PEI. */}
      <fieldset className="grid min-w-0 gap-5 rounded-2xl border border-brand/30 bg-brand-soft/30 p-4">
        <legend className={legendCls}>Declarado no Censo Escolar <span className="font-normal text-ink-soft">· PEI, art. 11, I e II</span></legend>
        <MultiChoiceField name="aeeServices" label="Atendimentos do AEE" hint="Os tipos do Censo Escolar." options={AEE_SERVICE_OPTIONS} defaultValue={value("aeeServices")} {...multi} />
        <MultiChoiceField name="assessmentAccessibility" label="Recursos na avaliação" hint="Os recursos do Censo (sala de aula e Saeb) vêm primeiro." options={ASSESSMENT_ACCESSIBILITY_OPTIONS} defaultValue={value("assessmentAccessibility")} {...multi} />
      </fieldset>
      <fieldset className="grid min-w-0 gap-5 rounded-2xl border border-line p-4">
        <legend className={legendCls}>PAEE <span className="font-normal text-ink-soft">· Portaria, art. 10</span></legend>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-aee-teacher`} className={labelCls}>Professor(a) do AEE</label>
          <input id={`${idPrefix}-aee-teacher`} name="aeeTeacher" maxLength={120} defaultValue={value("aeeTeacher")} autoComplete="off" className={inputCls} />
        </div>
        <MultiChoiceField name="accessibilityResources" label="Materiais e recursos" options={ACCESSIBILITY_RESOURCE_OPTIONS} defaultValue={value("accessibilityResources")} {...multi} />
        <MultiChoiceField name="assistiveTech" label="Tecnologia assistiva e CAA" options={ASSISTIVE_TECH_OPTIONS} defaultValue={value("assistiveTech")} {...multi} />
        <MultiChoiceField name="supportStaff" label="Profissional de apoio e intérpretes" options={SUPPORT_STAFF_OPTIONS} defaultValue={value("supportStaff")} {...multi} />
        <MultiChoiceField name="networkDemands" label="Formação e rede de proteção" options={NETWORK_DEMAND_OPTIONS} defaultValue={value("networkDemands")} {...multi} />
      </fieldset>
      <fieldset className="grid min-w-0 gap-5 rounded-2xl border border-line p-4">
        <legend className={legendCls}>PEI <span className="font-normal text-ink-soft">· Portaria, art. 11</span></legend>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-regular-teacher`} className={labelCls}>Professor(a) da classe comum</label>
          <input id={`${idPrefix}-regular-teacher`} name="regularTeacher" maxLength={120} defaultValue={value("regularTeacher")} autoComplete="off" className={inputCls} />
        </div>
        <MultiChoiceField name="aeeStrategies" label="Atividades no AEE" options={AEE_STRATEGY_OPTIONS} defaultValue={value("aeeStrategies")} {...multi} />
        <MultiChoiceField name="commonRoomStrategies" label="Na classe comum" options={COMMON_ROOM_STRATEGY_OPTIONS} defaultValue={value("commonRoomStrategies")} {...multi} />
        <MultiChoiceField name="monitoring" label="Como acompanhar o plano" options={MONITORING_OPTIONS} defaultValue={value("monitoring")} {...multi} />
        <MultiChoiceField name="familyFeedback" label="Devolutiva à família" options={FAMILY_FEEDBACK_OPTIONS} defaultValue={value("familyFeedback")} {...multi} />
      </fieldset>
      <MultiChoiceField name="participants" label="Também participaram" options={PLAN_PARTICIPANT_OPTIONS} defaultValue={value("participants")} {...multi} />
    </div>
  );
}
