"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Pencil,
  RotateCcw,
  Save,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { createStudent } from "@/actions/students";
import { Character } from "@/components/character";
import { primaryButtonCls } from "@/components/form-styles";
import {
  ACCESSIBILITY_NOTE_OPTIONS,
  AEE_FREQUENCY_OPTIONS,
  CLASS_NAME_OPTIONS,
  GRADES_BY_STAGE,
  GRADE_YEAR_OPTIONS,
  splitItems,
} from "@/lib/form-options";

type Option = { value: string; label: string };
type SchoolOption = Option & {
  classes: { name: string; gradeYear: string | null; shift: string }[];
};
type Answers = Record<string, string>;
type Step = {
  field: string;
  question: string;
  hint?: string;
  kind: "text" | "date" | "tel" | "textarea" | "options" | "school" | "multi";
  placeholder?: string;
  required?: boolean;
  options?: Option[];
  // Opções que dependem de respostas anteriores (ex.: anos da etapa escolhida).
  optionsFor?: (answers: Answers, schools: SchoolOption[]) => Option[];
  // "Outro": permite digitar uma resposta fora da lista.
  allowOther?: boolean;
  optionalLabel?: string;
  visible?: (answers: Answers) => boolean;
};

const toOptions = (items: string[]): Option[] => items.map((item) => ({ value: item, label: item }));

function stepOptions(step: Step, answers: Answers, schools: SchoolOption[]) {
  return step.optionsFor?.(answers, schools) ?? step.options ?? [];
}

const fieldClass =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink shadow-sm placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const stages: Option[] = [
  { value: "educacao_infantil", label: "Educação Infantil" },
  { value: "anos_iniciais", label: "Anos Iniciais" },
  { value: "anos_finais", label: "Anos Finais" },
  { value: "ensino_medio", label: "Ensino Médio" },
  { value: "eja", label: "EJA" },
];
const shifts: Option[] = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "integral", label: "Integral" },
];
const yesNo: Option[] = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

function buildSteps(schools: SchoolOption[]): Step[] {
  return [
    {
      field: "name",
      question: "Para começar, qual é o nome completo do estudante?",
      hint: "Use o nome registrado nos documentos escolares.",
      kind: "text",
      placeholder: "Nome completo",
      required: true,
    },
    {
      field: "birthDate",
      question: "Qual é a data de nascimento?",
      kind: "date",
      required: true,
    },
    {
      field: "schoolId",
      question: "Em qual escola o estudante está matriculado?",
      kind: "school",
      options: schools,
      required: true,
    },
    {
      field: "stage",
      question: "Qual é a etapa de ensino?",
      kind: "options",
      options: stages,
      required: true,
    },
    {
      field: "gradeYear",
      question: "Em qual ano ou série está?",
      kind: "options",
      optionsFor: (answers) => toOptions(GRADES_BY_STAGE[answers.stage] ?? GRADE_YEAR_OPTIONS),
      allowOther: true,
      placeholder: "Ex.: Multisseriada",
      required: true,
    },
    {
      field: "className",
      question: "Qual é a turma?",
      hint: "Escolha uma turma da escola ou informe outra em Outro.",
      kind: "options",
      optionsFor: (answers, schoolList) => {
        const registered = schoolList.find((school) => school.value === answers.schoolId)?.classes ?? [];
        return toOptions(registered.length ? registered.map((item) => item.name) : CLASS_NAME_OPTIONS);
      },
      allowOther: true,
      placeholder: "Ex.: Turma Girassol",
      required: true,
    },
    {
      field: "shift",
      question: "Em qual turno estuda?",
      kind: "options",
      options: shifts,
      allowOther: true,
      placeholder: "Ex.: Noite",
      required: true,
    },
    {
      field: "guardianName",
      question: "Quem é o responsável pelo estudante?",
      kind: "text",
      placeholder: "Nome completo do responsável",
      required: true,
    },
    {
      field: "guardianPhone",
      question: "Qual é o telefone do responsável?",
      kind: "tel",
      placeholder: "(00) 00000-0000",
      optionalLabel: "Prefiro informar depois",
    },
    {
      field: "hasAEE",
      question: "O estudante está matriculado no AEE?",
      hint: "Atendimento Educacional Especializado.",
      kind: "options",
      options: yesNo,
      required: true,
    },
    {
      field: "aeeFrequency",
      question: "Com qual frequência participa do AEE?",
      kind: "options",
      options: toOptions(AEE_FREQUENCY_OPTIONS),
      allowOther: true,
      placeholder: "Ex.: 2 vezes por semana, à tarde",
      required: true,
      visible: (answers) => answers.hasAEE === "sim",
    },
    {
      field: "supportProfessional",
      question: "O estudante conta com profissional de apoio?",
      kind: "options",
      options: yesNo,
      required: true,
    },
    {
      field: "accessibilityNotes",
      question: "Há alguma informação de acessibilidade importante?",
      hint: "Marque o que se aplica. Registre apenas informações relevantes para a participação e aprendizagem.",
      kind: "multi",
      options: toOptions(ACCESSIBILITY_NOTE_OPTIONS),
      allowOther: true,
      placeholder: "Ex.: precisa sentar perto da porta",
      optionalLabel: "Não há informação a acrescentar",
    },
  ];
}

function formatDate(value: string) {
  if (!value) return "Não informado";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function valueLabel(step: Step, value: string, schools: SchoolOption[]) {
  if (!value) return "Não informado";
  if (step.field === "birthDate") return formatDate(value);
  if (step.field === "schoolId") {
    return schools.find((school) => school.value === value)?.label ?? value;
  }
  return step.options?.find((option) => option.value === value)?.label ?? value;
}

function firstName(answers: Answers) {
  return answers.name?.trim().split(/\s+/)[0] || "o estudante";
}

export function StudentRegistrationChat({ schools }: { schools: SchoolOption[] }) {
  const allSteps = useMemo(() => buildSteps(schools), [schools]);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [multi, setMulti] = useState<string[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const visibleSteps = allSteps.filter((step) => !step.visible || step.visible(answers));
  const done = stepIndex >= visibleSteps.length && !editingField;
  const current =
    allSteps.find((step) => step.field === editingField) ??
    visibleSteps[Math.min(stepIndex, visibleSteps.length - 1)];
  const currentPosition = done
    ? visibleSteps.length
    : Math.max(0, visibleSteps.findIndex((step) => step.field === current?.field));
  const progress = done
    ? 100
    : Math.round((currentPosition / Math.max(visibleSteps.length, 1)) * 100);

  const selectedSchool = schools.find((school) => school.value === answers.schoolId);
  const registeredClasses = selectedSchool?.classes ?? [];

  function focusInputSoon() {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function applyAnswer(step: Step, value: string) {
    const cleanValue = value.trim();
    if (step.required && !cleanValue) {
      setError("Esta informação é necessária para continuar.");
      return;
    }

    setError("");
    const nextAnswers = { ...answers, [step.field]: cleanValue };
    if (step.field === "schoolId" && answers.schoolId !== cleanValue) {
      delete nextAnswers.className;
      delete nextAnswers.gradeYear;
      delete nextAnswers.shift;
    }
    if (step.field === "hasAEE" && cleanValue === "nao") {
      delete nextAnswers.aeeFrequency;
    }
    // Turma cadastrada: já sugere o turno dela na próxima pergunta.
    const schoolClass = registeredClasses.find((item) => item.name === cleanValue);
    if (step.field === "className" && schoolClass?.shift && !nextAnswers.shift) {
      nextAnswers.shift = schoolClass.shift;
    }
    setAnswers(nextAnswers);
    setDraft("");
    setOtherOpen(false);
    setMulti([]);

    if (editingField) {
      setEditingField(null);
      const nextVisibleSteps = allSteps.filter(
        (candidate) => !candidate.visible || candidate.visible(nextAnswers),
      );
      const firstMissing = nextVisibleSteps.findIndex(
        (candidate) =>
          candidate.required &&
          (!Object.prototype.hasOwnProperty.call(nextAnswers, candidate.field) ||
            !nextAnswers[candidate.field]),
      );
      setStepIndex(firstMissing >= 0 ? firstMissing : nextVisibleSteps.length);
      return;
    }
    setStepIndex((index) => index + 1);
    focusInputSoon();
  }

  function goBack() {
    if (editingField) {
      setEditingField(null);
      setDraft("");
      setOtherOpen(false);
      setMulti([]);
      setError("");
      return;
    }
    const previousIndex = Math.max(0, stepIndex - 1);
    setStepIndex(previousIndex);
    loadDrafts(visibleSteps[previousIndex]);
    setError("");
    focusInputSoon();
  }

  function edit(step: Step) {
    setEditingField(step.field);
    loadDrafts(step);
    setError("");
    focusInputSoon();
  }

  // Ao voltar ou editar: itens conhecidos ficam marcados e o restante vai
  // para o campo "Outro".
  function loadDrafts(step: Step | undefined) {
    const value = step ? answers[step.field] ?? "" : "";
    const options = step ? stepOptions(step, answers, schools) : [];
    if (step?.kind === "multi") {
      const items = splitItems(value);
      const known = items.filter((item) => options.some((option) => option.value === item));
      setMulti(known);
      setDraft(items.filter((item) => !known.includes(item)).join("; "));
      setOtherOpen(false);
      return;
    }
    const custom = Boolean(step?.allowOther && value && !options.some((option) => option.value === value));
    setMulti([]);
    setOtherOpen(custom);
    setDraft(step?.kind === "options" ? (custom ? value : "") : value);
  }

  function clearDraft() {
    setAnswers({});
    setDraft("");
    setOtherOpen(false);
    setMulti([]);
    setEditingField(null);
    setStepIndex(0);
    setShowDeleteConfirm(false);
    setError("");
    focusInputSoon();
  }

  function saveStudent() {
    const formData = new FormData();
    for (const step of visibleSteps) {
      const value = answers[step.field] ?? "";
      if (step.field === "hasAEE" || step.field === "supportProfessional") {
        if (value === "sim") formData.append(step.field, "on");
      } else {
        formData.append(step.field, value);
      }
    }

    startTransition(async () => {
      try {
        setError("");
        await createStudent(formData);
      } catch {
        setError("Não foi possível salvar agora. Confira os dados e tente novamente.");
      }
    });
  }

  function renderAnswerInput(step: Step) {
    const options = stepOptions(step, answers, schools);
    const otherInput = (submitLabel: string) => (
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${step.field}-outro`} className="mb-1.5 block text-xs font-medium text-ink-soft">
            {step.kind === "multi" ? "Outro: escreva o que não está na lista" : "Qual?"}
          </label>
          <input
            id={`${step.field}-outro`}
            ref={inputRef as RefObject<HTMLInputElement>}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={step.placeholder}
            autoComplete="off"
            className={fieldClass}
          />
        </div>
        <button
          type="submit"
          aria-label={submitLabel}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-e1 transition hover:bg-brand-strong"
        >
          <Send size={17} aria-hidden />
        </button>
      </div>
    );

    if (step.kind === "multi") {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyAnswer(step, [...multi, ...splitItems(draft)].join("; "));
          }}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {options.map((option) => {
              const active = multi.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMulti(active ? multi.filter((item) => item !== option.value) : [...multi, option.value])}
                  className={`inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                    active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-paper-raised text-ink hover:border-brand/50"
                  }`}
                >
                  {active ? <Check size={14} className="mr-1.5 shrink-0" aria-hidden /> : null}
                  {option.label}
                </button>
              );
            })}
          </div>
          {otherInput("Confirmar resposta")}
          {step.optionalLabel ? (
            <button
              type="button"
              onClick={() => applyAnswer(step, "")}
              className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-ink-soft underline-offset-4 hover:text-brand-strong hover:underline"
            >
              {step.optionalLabel}
            </button>
          ) : null}
        </form>
      );
    }

    if (step.kind === "options" || step.kind === "school") {
      const value = answers[step.field];
      const customSelected = Boolean(step.allowOther && value && !options.some((option) => option.value === value));
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const selected = answers[step.field] === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => applyAnswer(step, option.value)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                  selected
                    ? "border-brand bg-brand-soft text-brand-strong shadow-sm"
                    : "border-line bg-paper-raised text-ink hover:border-brand/50 hover:bg-brand-soft/30"
                }`}
              >
                {selected ? <Check size={15} className="mr-2 inline" aria-hidden /> : null}
                {option.label}
              </button>
            );
          })}
          {step.allowOther ? (
            <button
              type="button"
              aria-expanded={otherOpen}
              aria-controls={`${step.field}-outro-form`}
              onClick={() => {
                setOtherOpen((open) => !open);
                focusInputSoon();
              }}
              className={`rounded-xl border border-dashed px-4 py-3 text-left text-sm font-medium transition-all ${
                otherOpen || customSelected
                  ? "border-brand bg-brand-soft text-brand-strong shadow-sm"
                  : "border-line bg-paper-raised text-ink hover:border-brand/50 hover:bg-brand-soft/30"
              }`}
            >
              {customSelected && !otherOpen ? <Check size={15} className="mr-2 inline" aria-hidden /> : null}
              {customSelected && !otherOpen ? `Outro: ${value}` : "Outro (digitar)"}
            </button>
          ) : null}
          {step.allowOther && otherOpen ? (
            <form
              id={`${step.field}-outro-form`}
              className="sm:col-span-2"
              onSubmit={(event) => {
                event.preventDefault();
                applyAnswer(step, draft);
              }}
            >
              {otherInput("Enviar resposta")}
            </form>
          ) : null}
        </div>
      );
    }

    const commonProps = {
      value: draft,
      placeholder: step.placeholder,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(event.target.value),
    };

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          applyAnswer(step, draft);
        }}
      >
        <div className="flex items-end gap-2">
          {step.kind === "textarea" ? (
            <textarea
              {...commonProps}
              ref={inputRef as RefObject<HTMLTextAreaElement>}
              aria-labelledby={`pergunta-${step.field}`}
              rows={4}
              autoFocus
              className={`${fieldClass} resize-none`}
            />
          ) : (
            <input
              {...commonProps}
              ref={inputRef as RefObject<HTMLInputElement>}
              aria-labelledby={`pergunta-${step.field}`}
              type={step.kind}
              autoFocus
              max={step.kind === "date" ? new Date().toISOString().slice(0, 10) : undefined}
              autoComplete={step.kind === "tel" ? "tel" : "off"}
              className={fieldClass}
            />
          )}
          <button
            type="submit"
            aria-label="Enviar resposta"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-e1 transition hover:bg-brand-strong"
          >
            <Send size={17} aria-hidden />
          </button>
        </div>
        {step.optionalLabel ? (
          <button
            type="button"
            onClick={() => applyAnswer(step, "")}
            className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-ink-soft underline-offset-4 hover:text-brand-strong hover:underline"
          >
            {step.optionalLabel}
          </button>
        ) : null}
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-e2">
        <div className="border-b border-line bg-gradient-to-r from-brand-soft/80 to-paper-raised px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <Character variant="ideas" className="w-12" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold text-ink">
                  Assistente de cadastro
                </h2>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong">
                  Conversa guiada
                </span>
              </div>
              <p className="text-xs text-ink-soft">
                Uma pergunta por vez. Você revisa tudo antes de salvar.
              </p>
            </div>
            {/* O andamento também em texto, inclusive no celular: a barra abaixo só repete. */}
            <span className="shrink-0 text-xs tabular-nums text-ink-soft">
              {done ? "Resumo" : `${currentPosition + 1} de ${visibleSteps.length}`}
            </span>
          </div>
          <div aria-hidden className="mt-4 h-1.5 overflow-hidden rounded-full bg-line/60">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {!done && current ? (
          <div className="min-h-[28rem] px-5 py-7 sm:px-8">
            <div className="mx-auto max-w-2xl" aria-live="polite">
              {editingField ? (
                <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-xs font-medium text-amber">
                  <Pencil size={12} aria-hidden /> Editando uma informação
                </p>
              ) : null}

              <div className="flex items-start gap-3">
                <Character variant="ideas" className="w-10" />
                <div className="min-w-0">
                  <p id={`pergunta-${current.field}`} className="max-w-xl rounded-2xl rounded-tl-sm bg-paper px-4 py-3 text-sm leading-relaxed text-ink shadow-sm">
                    {current.question}
                  </p>
                  {current.hint ? (
                    <p className="mt-2 px-1 text-xs leading-relaxed text-ink-soft">
                      {current.hint}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 pl-0 sm:pl-13">{renderAnswerInput(current)}</div>

              {error ? (
                <p className="mt-4 rounded-xl bg-coral-soft px-4 py-3 text-sm text-coral" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="px-5 py-7 sm:px-8">
            <div className="mb-6 flex items-start gap-3 rounded-2xl bg-green-soft px-4 py-4">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-green text-white">
                <Check size={18} aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-green">
                  Cadastro pronto para revisão
                </h3>
                <p className="mt-0.5 text-sm leading-relaxed text-green">
                  Confira o resumo de {firstName(answers)}. Nada foi salvo ainda.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SummarySection
                icon={<UserRound size={16} aria-hidden />}
                title="Dados do estudante"
                steps={visibleSteps.filter((step) =>
                  ["name", "birthDate", "schoolId", "stage", "gradeYear", "className", "shift"].includes(step.field),
                )}
                answers={answers}
                schools={schools}
                onEdit={edit}
              />
              <SummarySection
                icon={<CalendarDays size={16} aria-hidden />}
                title="Responsável e apoios"
                steps={visibleSteps.filter((step) =>
                  ["guardianName", "guardianPhone", "hasAEE", "aeeFrequency", "supportProfessional", "accessibilityNotes"].includes(step.field),
                )}
                answers={answers}
                schools={schools}
                onEdit={edit}
              />
            </div>

            {error ? (
              <p className="mt-5 rounded-xl bg-coral-soft px-4 py-3 text-sm text-coral" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
              {showDeleteConfirm ? (
                <div className="flex flex-1 flex-wrap items-center gap-2 rounded-xl bg-coral-soft px-3 py-2">
                  <span className="mr-auto text-xs font-medium text-coral">
                    Excluir todas as respostas?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-ink-soft hover:bg-paper-raised"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={clearDraft}
                    className="inline-flex min-h-11 items-center rounded-full bg-coral px-4 text-sm font-medium text-white"
                  >
                    Sim, excluir
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-coral/30 px-4 py-2.5 text-sm font-medium text-coral hover:bg-coral-soft"
                >
                  <Trash2 size={16} aria-hidden /> Excluir informações
                </button>
              )}

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={saveStudent}
                  disabled={pending}
                  className={primaryButtonCls}
                >
                  <Save size={16} aria-hidden />
                  {pending ? "Salvando..." : "Salvar no prontuário"}
                </button>
              ) : null}
            </div>
          </div>
        )}

        {!done ? (
          <div className="flex items-center justify-between border-t border-line bg-paper/50 px-5 py-3 sm:px-7">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0 && !editingField}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-brand-strong disabled:invisible"
            >
              <ChevronLeft size={14} aria-hidden />
              {editingField ? "Cancelar edição" : "Voltar"}
            </button>
            {Object.keys(answers).length > 0 ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex min-h-11 items-center gap-1.5 text-xs text-ink-soft hover:text-coral"
              >
                <RotateCcw size={13} aria-hidden /> Recomeçar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-ink-soft">
        As informações são usadas para o acompanhamento pedagógico e ficam protegidas pelo controle de acesso da plataforma.
      </p>

      {!done && showDeleteConfirm ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
          <span className="text-sm font-medium text-coral">Excluir todas as respostas e recomeçar?</span>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-ink-soft hover:bg-paper-raised"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={clearDraft}
            className="inline-flex min-h-11 items-center rounded-full bg-coral px-4 text-sm font-medium text-white"
          >
            Excluir rascunho
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SummarySection({
  icon,
  title,
  steps,
  answers,
  schools,
  onEdit,
}: {
  icon: ReactNode;
  title: string;
  steps: Step[];
  answers: Answers;
  schools: SchoolOption[];
  onEdit: (step: Step) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-paper/40 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-brand-strong">{icon}</span> {title}
      </h3>
      <dl className="divide-y divide-line/70">
        {steps.map((step) => (
          <div key={step.field} className="group flex items-start gap-3 py-3 first:pt-1 last:pb-1">
            <div className="min-w-0 flex-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                {summaryLabel(step.field)}
              </dt>
              <dd className="mt-0.5 break-words text-sm leading-relaxed text-ink">
                {valueLabel(step, answers[step.field] ?? "", schools)}
              </dd>
            </div>
            <button
              type="button"
              onClick={() => onEdit(step)}
              aria-label={`Editar ${summaryLabel(step.field)}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-brand-soft hover:text-brand-strong"
            >
              <Pencil size={14} aria-hidden />
            </button>
          </div>
        ))}
      </dl>
    </section>
  );
}

function summaryLabel(field: string) {
  const labels: Record<string, string> = {
    name: "Nome completo",
    birthDate: "Data de nascimento",
    schoolId: "Escola",
    stage: "Etapa",
    gradeYear: "Ano / série",
    className: "Turma",
    shift: "Turno",
    guardianName: "Responsável",
    guardianPhone: "Telefone",
    hasAEE: "Atendimento AEE",
    aeeFrequency: "Frequência do AEE",
    supportProfessional: "Profissional de apoio",
    accessibilityNotes: "Informações de acessibilidade",
  };
  return labels[field] ?? field;
}
