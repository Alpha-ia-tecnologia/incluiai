"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Info,
  Pencil,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";
import { Character } from "@/components/character";
import { primaryButtonCls } from "@/components/form-styles";
import {
  BARRIERS,
  CHANNELS,
  SENSORY_AREAS,
  SENSORY_LABELS,
  SENSORY_VALUES,
  SUPPORT_LEVELS,
} from "@/lib/scale";
import {
  CALMING_OPTIONS,
  EARLY_SIGN_OPTIONS,
  INTEREST_OPTIONS,
  STRENGTH_OPTIONS,
  TRIGGER_OPTIONS,
  splitItems,
} from "@/lib/form-options";

type Answer = string | string[];
export type ProfileAnswers = Record<string, Answer>;
type Option = {
  value: string;
  label: string;
  description?: string;
  code?: string;
};
type Step = {
  field: string;
  section: string;
  label: string;
  question: string;
  helper?: string;
  kind: "choice" | "support" | "multi" | "text" | "yesno";
  options?: Option[];
  placeholder?: string;
  required?: boolean;
  // "Outro": permite digitar uma resposta fora das opções.
  allowOther?: boolean;
  otherType?: "text" | "number";
  // Perguntas abertas com itens prontos para marcar (resposta em texto).
  suggestions?: string[];
};

// Prepara os rascunhos ao voltar ou editar uma resposta já dada: itens
// conhecidos viram seleção; o restante vai para o campo "Outro".
function draftsFor(step: Step, value: Answer | undefined): { text: string; multi: string[] } {
  if (Array.isArray(value)) return { text: "", multi: value };
  if (!value) return { text: "", multi: [] };
  if (step.suggestions) {
    const items = splitItems(value, ",");
    const known = items.filter((item) => step.suggestions!.includes(item));
    return { text: items.filter((item) => !known.includes(item)).join(", "), multi: known };
  }
  if (step.allowOther && !step.options?.some((option) => option.value === value)) {
    return { text: value, multi: [] };
  }
  return { text: step.kind === "text" ? value : "", multi: [] };
}

const SECTION_META: Record<string, { description: string }> = {
  Comunicação: {
    description: "Como o estudante se expressa e compreende as interações.",
  },
  Aprendizagem: {
    description: "Apoios necessários para acessar atividades e sustentar a atenção.",
  },
  Interação: {
    description: "Participação com colegas, adultos e em propostas coletivas.",
  },
  Autonomia: {
    description: "Apoio nas atividades cotidianas dentro da escola.",
  },
  Sensorial: {
    description: "Como diferentes estímulos costumam ser percebidos.",
  },
  Motricidade: {
    description: "Apoio para movimentos finos, globais e mobilidade.",
  },
  "Regulação e ritmo": {
    description: "Sinais, estratégias de regulação e ritmo mais favorável.",
  },
  Potencialidades: {
    description: "Interesses, talentos e barreiras observadas no contexto escolar.",
  },
};

const SUPPORT_OPTIONS: Option[] = SUPPORT_LEVELS.map((item) => ({
  value: String(item.level),
  code: item.code,
  label: item.label,
  description: item.description,
}));
const CHANNEL_OPTIONS: Option[] = Object.entries(CHANNELS).map(
  ([value, label]) => ({ value, label }),
);
const SENSORY_OPTIONS: Option[] = Object.entries(SENSORY_VALUES).map(
  ([value, label]) => ({
    value,
    label,
    description:
      value === "hiper"
        ? "Percebe o estímulo com muita intensidade"
        : value === "hipo"
          ? "Pode buscar ou perceber pouco o estímulo"
          : "Resposta esperada para o contexto",
  }),
);
const MINUTE_OPTIONS = (values: number[]): Option[] =>
  values.map((value) => ({ value: String(value), label: `${value} min` }));

function buildSteps(firstName: string): Step[] {
  return [
    {
      field: "expressiveChannel",
      section: "Comunicação",
      label: "Canal expressivo",
      question: `Como ${firstName} costuma se expressar?`,
      helper: "Escolha o canal usado na maior parte das situações escolares.",
      kind: "choice",
      options: CHANNEL_OPTIONS,
      allowOther: true,
      required: true,
    },
    {
      field: "receptiveChannel",
      section: "Comunicação",
      label: "Canal receptivo",
      question: `Como ${firstName} compreende melhor as orientações?`,
      kind: "choice",
      options: CHANNEL_OPTIONS,
      allowOther: true,
      required: true,
    },
    {
      field: "commandSteps",
      section: "Comunicação",
      label: "Comandos compreendidos",
      question: "Comandos de quantas etapas costuma compreender?",
      helper: "Exemplo de 2 etapas: pegue o caderno e abra na página indicada.",
      kind: "choice",
      options: [
        { value: "1", label: "1 etapa" },
        { value: "2", label: "2 etapas" },
        { value: "3", label: "3 etapas" },
      ],
      required: true,
    },
    {
      field: "readingSupport",
      section: "Aprendizagem",
      label: "Leitura",
      question: "Quanto apoio precisa em atividades de leitura?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "writingSupport",
      section: "Aprendizagem",
      label: "Escrita",
      question: "Quanto apoio precisa em atividades de escrita?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "mathSupport",
      section: "Aprendizagem",
      label: "Matemática",
      question: "Quanto apoio precisa em atividades de matemática?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "attentionMinutes",
      section: "Aprendizagem",
      label: "Atenção sustentada",
      question: "Por quanto tempo costuma sustentar a atenção em uma atividade?",
      helper: "Considere uma atividade adequada, com os apoios habituais.",
      kind: "choice",
      options: MINUTE_OPTIONS([3, 5, 8, 10, 15, 20, 30, 45]),
      allowOther: true,
      otherType: "number",
      required: true,
    },
    {
      field: "peerInteraction",
      section: "Interação",
      label: "Interação com colegas",
      question: "Quanto apoio precisa para interagir com os colegas?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "adultInteraction",
      section: "Interação",
      label: "Interação com adultos",
      question: "Quanto apoio precisa para interagir com adultos?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "groupWork",
      section: "Interação",
      label: "Trabalho em grupo",
      question: "Quanto apoio precisa para participar de trabalhos em grupo?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "feeding",
      section: "Autonomia",
      label: "Alimentação",
      question: "Quanto apoio precisa durante a alimentação?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "hygiene",
      section: "Autonomia",
      label: "Higiene",
      question: "Quanto apoio precisa nos cuidados de higiene?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "mobility",
      section: "Autonomia",
      label: "Deslocamento",
      question: "Quanto apoio precisa para se deslocar pela escola?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "organization",
      section: "Autonomia",
      label: "Organização",
      question: "Quanto apoio precisa para organizar materiais e acompanhar transições?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    ...SENSORY_AREAS.map(
      (area): Step => ({
        field: `sens_${area}`,
        section: "Sensorial",
        label: `Sensibilidade ${SENSORY_LABELS[area].toLowerCase()}`,
        question: `Como é a resposta ${SENSORY_LABELS[area].toLowerCase()} de ${firstName}?`,
        helper: "Considere situações observadas em diferentes momentos da rotina.",
        kind: "choice",
        options: SENSORY_OPTIONS,
        required: true,
      }),
    ),
    {
      field: "fineMotor",
      section: "Motricidade",
      label: "Motricidade fina",
      question: "Quanto apoio precisa em movimentos como escrever, recortar ou encaixar?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "grossMotor",
      section: "Motricidade",
      label: "Motricidade global",
      question: "Quanto apoio precisa em movimentos amplos e atividades corporais?",
      kind: "support",
      options: SUPPORT_OPTIONS,
      required: true,
    },
    {
      field: "usesWheelchairOrOrthosis",
      section: "Motricidade",
      label: "Cadeira de rodas ou órtese",
      question: "Usa cadeira de rodas ou órtese?",
      kind: "yesno",
      required: true,
    },
    {
      field: "triggers",
      section: "Regulação e ritmo",
      label: "Situações de desregulação",
      question: "Quais situações costumam gerar desconforto ou desregulação?",
      helper: "Marque as que se aplicam ou escreva em Outro. Se ainda não observou, pode pular.",
      kind: "text",
      suggestions: TRIGGER_OPTIONS,
      placeholder: "Ex.: cheiro de tinta",
    },
    {
      field: "earlySigns",
      section: "Regulação e ritmo",
      label: "Sinais precoces",
      question: "Quais sinais aparecem antes de um desconforto maior?",
      kind: "text",
      suggestions: EARLY_SIGN_OPTIONS,
      placeholder: "Ex.: esfrega os olhos",
    },
    {
      field: "calmingStrategies",
      section: "Regulação e ritmo",
      label: "Estratégias que ajudam",
      question: "O que costuma ajudar na regulação?",
      kind: "text",
      suggestions: CALMING_OPTIONS,
      placeholder: "Ex.: balanço no parquinho",
    },
    {
      field: "bestShift",
      section: "Regulação e ritmo",
      label: "Melhor turno",
      question: "Em qual turno demonstra melhor disponibilidade para aprender?",
      kind: "choice",
      options: [
        { value: "manha", label: "Manhã" },
        { value: "tarde", label: "Tarde" },
      ],
      required: true,
    },
    {
      field: "taskToleranceMinutes",
      section: "Regulação e ritmo",
      label: "Tolerância à tarefa",
      question: "Por quanto tempo costuma permanecer em uma mesma tarefa?",
      kind: "choice",
      options: MINUTE_OPTIONS([5, 8, 10, 15, 20, 30, 45, 60]),
      allowOther: true,
      otherType: "number",
      required: true,
    },
    {
      field: "interests",
      section: "Potencialidades",
      label: "Interesses âncora",
      question: "Quais são os principais temas ou atividades que despertam interesse?",
      helper: "Escolha de 3 a 5 interesses. Eles ajudam a personalizar as atividades.",
      kind: "text",
      suggestions: INTEREST_OPTIONS,
      required: true,
      placeholder: "Ex.: vulcões",
    },
    {
      field: "barriers",
      section: "Potencialidades",
      label: "Barreiras ativas",
      question: "Quais barreiras estão presentes no contexto escolar?",
      helper: "Você pode marcar mais de uma ou confirmar sem selecionar nenhuma.",
      kind: "multi",
      options: Object.entries(BARRIERS).map(([value, label]) => ({
        value,
        label,
      })),
      allowOther: true,
    },
    {
      field: "strengths",
      section: "Potencialidades",
      label: "Potencialidades",
      question: "Para concluir: quais talentos, potencialidades e estratégias funcionam bem?",
      kind: "text",
      suggestions: STRENGTH_OPTIONS,
      placeholder: "Ex.: monta quebra-cabeças de 50 peças",
    },
  ];
}

function answerLabel(step: Step, value: Answer | undefined) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "Nenhuma barreira selecionada";
    return value
      .map((item) => step.options?.find((option) => option.value === item)?.label ?? item)
      .join(", ");
  }
  if (!value) return "Ainda não observado";
  if (step.kind === "yesno") return value === "sim" ? "Sim" : "Não";
  const option = step.options?.find((item) => item.value === value);
  if (!option && step.otherType === "number") return `${value} min`;
  return option ? `${option.code ? `${option.code} · ` : ""}${option.label}` : value;
}

export function ProfileChat({
  action,
  firstName,
  initialAnswers = {},
  hasSavedProfile = false,
}: {
  action: (formData: FormData) => Promise<void>;
  firstName: string;
  initialAnswers?: ProfileAnswers;
  hasSavedProfile?: boolean;
}) {
  const steps = useMemo(() => buildSteps(firstName), [firstName]);
  const sections = useMemo(
    () => [...new Set(steps.map((step) => step.section))],
    [steps],
  );
  const firstMissingIndex = steps.findIndex(
    (step) => step.required && !initialAnswers[step.field],
  );
  const [answers, setAnswers] = useState<ProfileAnswers>(initialAnswers);
  const [currentIndex, setCurrentIndex] = useState(
    hasSavedProfile ? steps.length : firstMissingIndex >= 0 ? firstMissingIndex : 0,
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  const done = currentIndex >= steps.length && !editingField;
  const current =
    steps.find((step) => step.field === editingField) ??
    steps[Math.min(currentIndex, steps.length - 1)];
  const currentField = current?.field;
  const answeredCount = steps.filter((step) =>
    Object.prototype.hasOwnProperty.call(answers, step.field),
  ).length;
  const currentSectionIndex = current
    ? Math.max(0, sections.indexOf(current.section))
    : sections.length - 1;
  const progress = done ? 100 : Math.round((answeredCount / steps.length) * 100);
  const recentAnswered = steps
    .slice(0, currentIndex)
    .filter((step) => Object.prototype.hasOwnProperty.call(answers, step.field))
    .slice(-2);

  useEffect(() => {
    if (done || !currentField) return;

    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      conversationRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentField, done]);

  function moveToNext(step: Step, value: Answer) {
    if (step.required && typeof value === "string" && !value.trim()) {
      setError("Esta resposta é necessária para continuar.");
      return;
    }

    const nextAnswers = { ...answers, [step.field]: value };
    setAnswers(nextAnswers);
    setError("");

    if (editingField) {
      setTextDraft("");
      setMultiDraft([]);
      setEditingField(null);
      setCurrentIndex(steps.length);
      return;
    }
    // A próxima pergunta já mostra a resposta existente (ex.: sugestão do estudo de caso).
    const nextStep = steps[currentIndex + 1];
    const drafts = nextStep ? draftsFor(nextStep, nextAnswers[nextStep.field]) : { text: "", multi: [] };
    setTextDraft(drafts.text);
    setMultiDraft(drafts.multi);
    setCurrentIndex((index) => index + 1);
  }

  function goBack() {
    if (editingField) {
      setEditingField(null);
      setTextDraft("");
      setMultiDraft([]);
      setError("");
      return;
    }
    const previousIndex = Math.max(0, currentIndex - 1);
    const previous = steps[previousIndex];
    setCurrentIndex(previousIndex);
    const drafts = draftsFor(previous, answers[previous.field]);
    setTextDraft(drafts.text);
    setMultiDraft(drafts.multi);
    setError("");
  }

  function edit(step: Step) {
    const drafts = draftsFor(step, answers[step.field]);
    setEditingField(step.field);
    setTextDraft(drafts.text);
    setMultiDraft(drafts.multi);
    setError("");
    window.setTimeout(() => textRef.current?.focus(), 0);
  }

  function resetConversation() {
    setAnswers(hasSavedProfile ? initialAnswers : {});
    setCurrentIndex(hasSavedProfile ? steps.length : 0);
    setEditingField(null);
    setTextDraft("");
    setMultiDraft([]);
    setShowReset(false);
    setError("");
  }

  function submitAll() {
    const missing = steps.find(
      (step) => step.required && !answers[step.field],
    );
    if (missing) {
      setCurrentIndex(steps.indexOf(missing));
      setError(`Responda “${missing.label}” antes de salvar.`);
      return;
    }

    const formData = new FormData();
    for (const step of steps) {
      const value = answers[step.field];
      if (step.field === "barriers") {
        for (const barrier of (value as string[]) ?? []) {
          formData.append("barriers", barrier);
        }
      } else if (step.kind === "yesno") {
        if (value === "sim") formData.append(step.field, "on");
      } else {
        formData.append(step.field, String(value ?? ""));
      }
    }

    startTransition(async () => {
      try {
        setError("");
        await action(formData);
      } catch {
        setError("Não foi possível salvar o perfil. Revise as respostas e tente novamente.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-e2">
        <header className="border-b border-line bg-gradient-to-r from-brand-soft/80 to-paper-raised px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <Character variant="ideas" className="w-12" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display font-semibold text-ink">Perfil guiado</h2>
                {/* Verde só quando há o que revisar; em andamento é a conversa guiada, em azul. */}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${done ? "bg-green-soft text-green" : "bg-brand-soft text-brand-strong"}`}>
                  {done ? "Pronto para revisar" : "Conversa guiada"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                Registre como {firstName} aprende e participa — sem informações de diagnóstico.
              </p>
            </div>
            {/* O andamento também em texto, inclusive no celular: a barra abaixo só repete. */}
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold tabular-nums text-ink">{progress}%</p>
              <p className="text-xs tabular-nums text-ink-soft">{answeredCount} de {steps.length}</p>
            </div>
          </div>
          <div aria-hidden className="mt-4 h-1.5 overflow-hidden rounded-full bg-line/60">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        {!done && current ? (
          <div className="grid min-h-[36rem] lg:grid-cols-[13rem_1fr]">
            {/* Lista de etapas sem marco próprio: um <aside> dentro do <main> seria um marco aninhado. */}
            <div className="hidden border-r border-line bg-paper/60 p-4 lg:block">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Etapas do perfil
              </p>
              <ol className="space-y-1">
                {sections.map((section, index) => {
                  const completed = steps
                    .filter((step) => step.section === section)
                    .every((step) =>
                      Object.prototype.hasOwnProperty.call(answers, step.field),
                    );
                  const active = section === current.section;
                  return (
                    <li
                      key={section}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs ${
                        active
                          ? "bg-brand-soft font-semibold text-brand-strong"
                          : "text-ink-soft"
                      }`}
                    >
                      <span
                        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          completed
                            ? "bg-green text-white"
                            : active
                              ? "bg-brand text-white"
                              : "bg-line/70"
                        }`}
                      >
                        {completed ? <Check size={11} aria-hidden /> : index + 1}
                      </span>
                      {section}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div
              ref={conversationRef}
              className="flex min-w-0 scroll-mt-4 flex-col"
            >
              <div className="border-b border-line/70 px-5 py-3 sm:px-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
                      Etapa <span className="tabular-nums">{currentSectionIndex + 1} de {sections.length}</span> · {current.section}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {SECTION_META[current.section]?.description}
                    </p>
                  </div>
                  {editingField ? (
                    <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber">
                      Editando
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 px-5 py-6 sm:px-8">
                <div className="mx-auto max-w-3xl">
                  {recentAnswered.length > 0 && !editingField ? (
                    <div className="mb-5 hidden space-y-2 border-b border-line/60 pb-5 sm:block">
                      {recentAnswered.map((step) => (
                        <div key={step.field} className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => edit(step)}
                            className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-soft px-3.5 py-2 text-left text-xs text-brand-strong hover:ring-1 hover:ring-brand/30"
                          >
                            <span className="block text-xs font-semibold opacity-70">
                              {step.label}
                            </span>
                            {answerLabel(step, answers[step.field])}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-start gap-3">
                    <Character variant="ideas" className="w-10" />
                    <div className="min-w-0">
                      <p id={`pergunta-${current.field}`} className="rounded-2xl rounded-tl-sm bg-paper px-4 py-3 text-sm leading-relaxed text-ink shadow-sm">
                        {current.question}
                      </p>
                      {current.helper ? (
                        <p className="mt-2 flex items-start gap-1.5 px-1 text-xs leading-relaxed text-ink-soft">
                          <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                          {current.helper}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6 sm:pl-13">
                    <AnswerControl
                      key={current.field}
                      step={current}
                      selected={answers[current.field]}
                      textDraft={textDraft}
                      multiDraft={multiDraft}
                      textRef={textRef}
                      setTextDraft={setTextDraft}
                      setMultiDraft={setMultiDraft}
                      onAnswer={(value) => moveToNext(current, value)}
                    />
                  </div>

                  {error ? (
                    <p className="mt-5 rounded-xl bg-coral-soft px-4 py-3 text-sm text-coral" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>

              <footer className="flex items-center justify-between border-t border-line bg-paper/40 px-5 py-3 sm:px-8">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={currentIndex === 0 && !editingField}
                  className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-brand-strong disabled:invisible"
                >
                  <ChevronLeft size={14} aria-hidden />
                  {editingField ? "Cancelar edição" : "Voltar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="inline-flex min-h-11 items-center gap-1.5 text-xs text-ink-soft hover:text-coral"
                >
                  <RotateCcw size={13} aria-hidden />
                  {hasSavedProfile ? "Restaurar dados salvos" : "Recomeçar"}
                </button>
              </footer>
            </div>
          </div>
        ) : (
          <Review
            steps={steps}
            sections={sections}
            answers={answers}
            pending={pending}
            error={error}
            firstName={firstName}
            onEdit={edit}
            onSave={submitAll}
            onReset={() => setShowReset(true)}
          />
        )}
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-ink-soft">
        Use observações pedagógicas de diferentes momentos. O perfil pode ser revisto sempre que houver mudanças.
      </p>

      {showReset ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
          <span className="mr-2 text-sm font-medium text-coral">
            {hasSavedProfile
              ? "Descartar as alterações e restaurar o último perfil salvo?"
              : "Excluir as respostas e começar novamente?"}
          </span>
          <button
            type="button"
            onClick={() => setShowReset(false)}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-ink-soft hover:bg-paper-raised"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={resetConversation}
            className="inline-flex min-h-11 items-center rounded-full bg-coral px-4 text-sm font-medium text-white"
          >
            Confirmar
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AnswerControl({
  step,
  selected,
  textDraft,
  multiDraft,
  textRef,
  setTextDraft,
  setMultiDraft,
  onAnswer,
}: {
  step: Step;
  selected: Answer | undefined;
  textDraft: string;
  multiDraft: string[];
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  setTextDraft: (value: string) => void;
  setMultiDraft: (value: string[]) => void;
  onAnswer: (value: Answer) => void;
}) {
  const [otherOpen, setOtherOpen] = useState(textDraft !== "");
  const chipCls = "inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-sm font-medium transition";
  const chipOn = "border-brand bg-brand-soft text-brand-strong";
  const chipOff = "border-line bg-paper-raised text-ink hover:border-brand/50";
  const toggle = (value: string) =>
    setMultiDraft(multiDraft.includes(value) ? multiDraft.filter((item) => item !== value) : [...multiDraft, value]);
  const otherField = (
    <div className="mt-4">
      <label htmlFor={`${step.field}-outro`} className="mb-1.5 block text-xs font-medium text-ink-soft">
        Outro: escreva o que não está na lista
      </label>
      <input
        id={`${step.field}-outro`}
        value={textDraft}
        onChange={(event) => setTextDraft(event.target.value)}
        placeholder={step.placeholder}
        className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink shadow-sm placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
    </div>
  );

  // Pergunta aberta com itens prontos: marca vários e/ou escreve em "Outro".
  if (step.kind === "text" && step.suggestions) {
    const confirm = () => onAnswer([...multiDraft, ...splitItems(textDraft, ",")].join(", "));
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        <div className="flex flex-wrap gap-2">
          {step.suggestions.map((item) => {
            const active = multiDraft.includes(item);
            return (
              <button key={item} type="button" aria-pressed={active} onClick={() => toggle(item)} className={`${chipCls} ${active ? chipOn : chipOff}`}>
                {active ? <Check size={14} className="mr-1.5 shrink-0" aria-hidden /> : null}
                {item}
              </button>
            );
          })}
        </div>
        {otherField}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="submit" className={primaryButtonCls}>
            Confirmar <ChevronRight size={15} aria-hidden />
          </button>
          {!step.required ? (
            <button type="button" onClick={() => onAnswer("")} className="inline-flex min-h-11 items-center text-xs font-medium text-ink-soft underline-offset-4 hover:text-brand-strong hover:underline">
              Ainda não observado — pular
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  if (step.kind === "text") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAnswer(textDraft.trim());
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textRef}
            aria-labelledby={`pergunta-${step.field}`}
            rows={3}
            autoFocus
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
            placeholder={step.placeholder}
            className="min-h-24 flex-1 resize-y rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink shadow-sm placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          <button
            type="submit"
            aria-label="Enviar resposta"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-e1 hover:bg-brand-strong"
          >
            <Send size={17} aria-hidden />
          </button>
        </div>
        {!step.required ? (
          <button
            type="button"
            onClick={() => onAnswer("")}
            className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-ink-soft underline-offset-4 hover:text-brand-strong hover:underline"
          >
            Ainda não observado — pular
          </button>
        ) : null}
      </form>
    );
  }

  if (step.kind === "multi") {
    const custom = multiDraft.filter((value) => !step.options?.some((option) => option.value === value));
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {custom.map((value) => (
            <button key={value} type="button" aria-pressed onClick={() => toggle(value)} aria-label={`Remover ${value}`} className={`${chipCls} ${chipOn}`}>
              <Check size={14} className="mr-1.5 shrink-0" aria-hidden />
              {value}
            </button>
          ))}
          {step.options?.map((option) => {
            const active = multiDraft.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setMultiDraft(
                    active
                      ? multiDraft.filter((value) => value !== option.value)
                      : [...multiDraft, option.value],
                  )
                }
                className={`${chipCls} ${
                  active
                    ? "border-brand bg-brand-soft text-brand-strong"
                    : "border-line bg-paper-raised text-ink hover:border-brand/50"
                }`}
              >
                {active ? <Check size={14} className="mr-1.5 shrink-0" aria-hidden /> : null}
                {option.label}
              </button>
            );
          })}
        </div>
        {step.allowOther ? otherField : null}
        <button
          type="button"
          onClick={() => onAnswer([...new Set([...multiDraft, ...splitItems(textDraft, ",")])])}
          className={`mt-4 ${primaryButtonCls}`}
        >
          Confirmar seleção <ChevronRight size={15} aria-hidden />
        </button>
      </div>
    );
  }

  const options =
    step.kind === "yesno"
      ? [
          { value: "sim", label: "Sim" },
          { value: "nao", label: "Não" },
        ]
      : step.options ?? [];

  return (
    <div className={`grid gap-2 ${step.kind === "support" ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
      {options.map((option) => {
        const active = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onAnswer(option.value)}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              active
                ? "border-brand bg-brand-soft text-brand-strong shadow-sm"
                : "border-line bg-paper-raised text-ink hover:border-brand/50 hover:bg-brand-soft/25"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {option.code ? (
                <span className="inline-flex min-w-10 justify-center rounded-full bg-paper px-1.5 py-0.5 tabular-nums text-xs text-brand-strong">
                  {option.code}
                </span>
              ) : null}
              {option.label}
              {active ? <Check size={14} className="ml-auto" aria-hidden /> : null}
            </span>
            {option.description ? (
              <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
      {step.allowOther ? (
        <button
          type="button"
          aria-expanded={otherOpen}
          aria-controls={`${step.field}-outro-form`}
          onClick={() => setOtherOpen((open) => !open)}
          className={`rounded-xl border border-dashed px-4 py-3 text-left text-sm font-semibold transition ${
            otherOpen || (typeof selected === "string" && selected && !options.some((option) => option.value === selected))
              ? "border-brand bg-brand-soft text-brand-strong"
              : "border-line bg-paper-raised text-ink hover:border-brand/50 hover:bg-brand-soft/25"
          }`}
        >
          Outro
          <span className="mt-1 block text-xs font-normal leading-relaxed text-ink-soft">Escrever uma resposta que não está na lista</span>
        </button>
      ) : null}
      {step.allowOther && otherOpen ? (
        <form
          id={`${step.field}-outro-form`}
          className="flex items-end gap-2 sm:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            onAnswer(textDraft.trim());
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={`${step.field}-outro`} className="mb-1.5 block text-xs font-medium text-ink-soft">
              {step.otherType === "number" ? "Quantos minutos?" : "Qual?"}
            </label>
            <input
              id={`${step.field}-outro`}
              type={step.otherType ?? "text"}
              min={step.otherType === "number" ? 1 : undefined}
              max={step.otherType === "number" ? 120 : undefined}
              autoFocus
              value={textDraft}
              onChange={(event) => setTextDraft(event.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <button type="submit" aria-label="Confirmar resposta" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-e1 hover:bg-brand-strong">
            <Send size={17} aria-hidden />
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Review({
  steps,
  sections,
  answers,
  pending,
  error,
  firstName,
  onEdit,
  onSave,
  onReset,
}: {
  steps: Step[];
  sections: string[];
  answers: ProfileAnswers;
  pending: boolean;
  error: string;
  firstName: string;
  onEdit: (step: Step) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="px-5 py-7 sm:px-8">
      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-green-soft px-4 py-4">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-green text-white">
          <ClipboardCheck size={18} aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-base font-semibold text-green">
            Perfil pronto para revisão
          </h3>
          <p className="mt-0.5 text-sm leading-relaxed text-green">
            Confira como {firstName} aprende e participa. Edite qualquer item antes de salvar.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section} className="rounded-2xl border border-line bg-paper/40 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink">{section}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                {SECTION_META[section]?.description}
              </p>
            </div>
            <dl className="divide-y divide-line/70">
              {steps
                .filter((step) => step.section === section)
                .map((step) => (
                  // dl > div > dt + dd: o botão de editar fica num dd próprio, na coluna da direita.
                  <div key={step.field} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-2.5">
                    <dt className="col-start-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      {step.label}
                    </dt>
                    <dd className="col-start-1 mt-0.5 break-words text-sm leading-relaxed text-ink">
                      {answerLabel(step, answers[step.field])}
                    </dd>
                    <dd className="col-start-2 row-span-2 row-start-1">
                      <button
                        type="button"
                        onClick={() => onEdit(step)}
                        aria-label={`Editar ${step.label}`}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-brand-soft hover:text-brand-strong"
                      >
                        <Pencil size={14} aria-hidden />
                      </button>
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </div>

      {error ? (
        <p className="mt-5 rounded-xl bg-coral-soft px-4 py-3 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink-soft hover:border-coral/40 hover:bg-coral-soft hover:text-coral"
        >
          <RotateCcw size={15} aria-hidden /> Descartar alterações
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className={primaryButtonCls}
        >
          <Save size={16} aria-hidden />
          {pending ? "Salvando..." : "Salvar perfil educacional"}
        </button>
      </div>
    </div>
  );
}
