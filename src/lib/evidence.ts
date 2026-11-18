// Exigências do Decreto nº 12.686/2025 (com a redação do 12.773/2025), da Portaria
// MEC nº 421/2026 e da orientação do INEP para o Censo Escolar. Não é parecer jurídico.
import { AEE_TEACHER, REGULAR_TEACHER, censusReference } from "./federal-guidance.ts";
import { censusDifferences, missingPlanItems, type CensusDeclared, type PlanDocuments } from "./plan-documents.ts";

export type EvidenceStatus = "ok" | "conferir" | "pendente" | "info";
export type EvidenceItem = { id: string; label: string; short: string; norm: string; status: EvidenceStatus; detail: string; tab: string };
export type EvidenceGroup = { title: string; items: EvidenceItem[] };

export type EvidenceInput = {
  now: Date;
  caseStudy: { status: string; concludedAt: Date | null; content: Record<string, string> } | null;
  plan: ({ createdAt: Date; reviewedAt: Date | null; reviewDate: Date; objectives: number } & Partial<PlanDocuments>) | null;
  approvedAdaptations: number;
  diaryRecent: number;
  aee: { done: number; absences: number; cancelled: number };
  lastReportAt: Date | null;
  assessmentAt: Date | null;
  consent: { aiUse: boolean; therapistLink: boolean; decidedAt: Date | null } | null;
  census?: (CensusDeclared & { syncedAt?: string }) | null;
};

export const STATUS_LABEL: Record<EvidenceStatus, string> = { ok: "Em dia", conferir: "Conferir", pendente: "Pendente", info: "Informação" };

const DAY = 86_400_000;
const YEAR_DAYS = 365;
const REPORT_DAYS = 200;
const REASSESS_DAYS = 84;
const day = (date: Date) => date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const daysSince = (date: Date, now: Date) => (now.getTime() - date.getTime()) / DAY;
const list = (value: string | undefined) => (value ?? "").split(/[;\n]/).map((item) => item.trim()).filter(Boolean);
const filled = (value: string | null | undefined) => Boolean(value?.trim());
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function evidenceGroups(input: EvidenceInput): EvidenceGroup[] {
  const { now, caseStudy, plan } = input;
  const content = caseStudy?.content ?? {};
  const concluded = caseStudy?.status === "concluido";
  const needs = list(content.necessidades);
  const resources = list(content.recursos);
  const participants = list(content.participantes);
  const interviewed = list(content.entrevistados);
  const referrals = list(content.encaminhamentos);
  const item = (id: string, short: string, label: string, norm: string, tab: string, status: EvidenceStatus, detail: string): EvidenceItem => ({ id, short, label, norm, tab, status, detail });

  const caseItems: EvidenceItem[] = [
    item("estudo", "Estudo de caso", "Estudo de caso concluído", "Decreto nº 12.686/2025, art. 11", "estudo-de-caso",
      concluded ? "ok" : "pendente",
      concluded ? `Concluído${caseStudy?.concludedAt ? ` em ${day(caseStudy.concludedAt)}` : ""}.` : caseStudy ? "Em andamento: conclua para fundamentar o plano." : "Ainda não começou."),
    item("etapa1", "Etapa I", "Etapa I: demandas individuais e barreiras", "Decreto, art. 11, § 1º, I", "estudo-de-caso",
      filled(content.encaminhadoPor) && filled(content.motivos) ? "ok" : "pendente",
      filled(content.motivos) ? `Motivos: ${list(content.motivos).join(", ")}.` : "Registre quem encaminhou e os motivos."),
    item("impedimentos", "Impedimentos", "Impedimentos de longo prazo observados na escola", "INEP, Censo Escolar", "estudo-de-caso",
      filled(content.impedimentos) ? "ok" : concluded ? "conferir" : "pendente",
      filled(content.impedimentos) ? `Observados: ${list(content.impedimentos).join(", ")}.` : "Registre os impedimentos observados na escola, sem diagnóstico."),
    item("etapa2", "Etapa II", "Etapa II: barreiras e contexto escolar", "Decreto, art. 11, § 1º, II", "estudo-de-caso",
      filled(content.barreiras) || filled(content.participacao) || filled(content.espacos) ? "ok" : "pendente",
      filled(content.barreiras) ? `Barreiras observadas: ${list(content.barreiras).join(", ")}.` : filled(content.participacao) || filled(content.espacos) ? "Observação na escola registrada." : "Registre a observação na escola."),
    item("etapa3", "Etapa III", "Etapa III: potencialidades e demandas de apoio", "Decreto, art. 11, § 1º, III", "estudo-de-caso",
      (filled(content.potencialidades) || filled(content.aprendeMelhor)) && needs.length ? "ok" : "pendente",
      needs.length ? `Necessidades: ${needs.join(", ")}.` : "Registre as potencialidades e as necessidades identificadas."),
    item("etapa4", "Etapa IV", "Etapa IV: estratégias e recursos de acessibilidade", "Decreto, art. 11, § 1º, IV", "estudo-de-caso",
      resources.length || filled(plan?.accessibilityResources) ? "ok" : "pendente",
      resources.length ? `Recursos indicados: ${resources.join(", ")}.` : filled(plan?.accessibilityResources) ? "Recursos registrados no plano." : "Indique os recursos e serviços na síntese do estudo de caso."),
    (() => {
      const absent = [!participants.includes(AEE_TEACHER) && AEE_TEACHER, !participants.includes(REGULAR_TEACHER) && REGULAR_TEACHER].filter((entry): entry is string => Boolean(entry));
      return item("conducao", "Condução", "Conduzido pelo AEE, com a sala comum", "INEP, Censo Escolar", "estudo-de-caso",
        !caseStudy ? "pendente" : absent.length ? "conferir" : "ok",
        !caseStudy ? "Ainda não começou." : absent.length ? `Registre em Quem participou: ${absent.map(lowerFirst).join(" e ")}.` : "Professores do AEE e da sala comum participaram.");
    })(),
    item("familia", "Família", "Participação da família", "Decreto, art. 11, § 3º", "estudo-de-caso",
      interviewed.length || participants.includes("Família") ? "ok" : "pendente",
      interviewed.length ? `Entrevista com: ${interviewed.join(", ")}.` : participants.includes("Família") ? "A família participou do estudo." : "Registre a entrevista com a família."),
    (() => {
      const heard = filled(content.formaEscuta) && content.formaEscuta !== "Não foi possível";
      const status: EvidenceStatus = heard || participants.includes("O próprio estudante") ? "ok" : content.formaEscuta === "Não foi possível" ? "conferir" : "pendente";
      const detail = heard ? `Escuta por: ${content.formaEscuta}.` : status === "ok" ? "O estudante participou do estudo." : status === "conferir" ? "A escuta não foi possível: tente outra forma, como desenho, prancha ou observação das escolhas." : "Registre a escuta do estudante.";
      return item("estudante", "Estudante", "Participação do estudante", "Decreto, art. 11, § 3º", "estudo-de-caso", status, detail);
    })(),
    item("laudo", "Sem laudo", "Sem exigência de laudo", "Decreto, art. 11, § 7º; Portaria nº 421/2026, art. 7º, § 4º; INEP", "estudo-de-caso", "info",
      "Nenhuma etapa pede diagnóstico ou laudo, nem a declaração no Censo. Se a família informar, só o AEE e a coordenação veem."),
  ];

  const last = plan ? (plan.reviewedAt ?? plan.createdAt) : null;
  const tea = [...needs, ...resources].filter((entry) => /tecnologia assistiva|comunicação alternativa|prancha/i.test(entry));
  const staff = resources.filter((entry) => /profissional de apoio|intérprete|guia-intérprete/i.test(entry));
  const authorship = plan ? missingPlanItems(plan).authorship : [];
  const fromPlanOrCase = (value: string | null | undefined, fromCase: string[], missing: string): { status: EvidenceStatus; detail: string } =>
    filled(value) ? { status: "ok", detail: `No plano: ${list(value ?? "").join(", ")}.` } : fromCase.length ? { status: "ok", detail: `Indicado no estudo de caso: ${fromCase.join(", ")}.` } : { status: "conferir", detail: missing };
  const ta = fromPlanOrCase(plan?.assistiveTech, tea, "Registre no PAEE a avaliação de tecnologia assistiva e CAA, mesmo que não haja necessidade.");
  const supportStaff = fromPlanOrCase(plan?.supportStaff, staff, "Registre no PAEE a avaliação do profissional de apoio e dos intérpretes, mesmo que não haja necessidade.");
  const network = fromPlanOrCase(plan?.networkDemands, referrals, "Registre no PAEE as demandas de formação e da rede de proteção, ou Nenhuma demanda.");
  const curricular = filled(plan?.commonRoomStrategies) || filled(plan?.accessibilityResources) || input.approvedAdaptations > 0;
  const evaluative = filled(plan?.assessmentAccessibility) || input.approvedAdaptations > 0;
  const aeeActivities = filled(plan?.aeeServices) || filled(plan?.aeeStrategies);
  const planItems: EvidenceItem[] = [
    item("plano", "Plano", "Plano a partir do estudo de caso", "Decreto, art. 12; Portaria, art. 7º, IV e § 2º", "ppi",
      plan ? "ok" : "pendente",
      plan ? `Plano de ensino desde ${day(plan.createdAt)}: um só documento para o PAEE e o PEI.` : concluded ? "Monte o plano de ensino a partir do estudo de caso." : "Depende do estudo de caso concluído."),
    item("autoria", "Autoria", "Quem elaborou o PAEE e o PEI", "INEP, Censo Escolar; Portaria, arts. 10 e 11", "ppi",
      !plan ? "pendente" : authorship.length ? "conferir" : "ok",
      !plan ? "Sem plano." : authorship.length ? `Registre no plano: ${authorship.join(", ")}.` : `PAEE: ${plan.aeeTeacher}. PEI: ${plan.regularTeacher}. Com: ${list(plan.participants ?? "").join(", ")}.`),
    item("revisao", "Revisão anual", "Revisão anual do plano", "Portaria, art. 7º, § 3º", "ppi",
      !plan || !last ? "pendente" : daysSince(last, now) > YEAR_DAYS ? "pendente" : plan.reviewDate < now ? "conferir" : "ok",
      !plan || !last ? "Sem plano." : daysSince(last, now) > YEAR_DAYS ? `A última revisão foi em ${day(last)}, há mais de um ano.` : plan.reviewDate < now ? `Revisado em ${day(last)}; a revisão marcada para ${day(plan.reviewDate)} passou.` : `${plan.reviewedAt ? "Revisado" : "Feito"} em ${day(last)}; próxima revisão em ${day(plan.reviewDate)}.`),
    item("paee_recursos", "Recursos", "PAEE: materiais e recursos contra as barreiras", "Portaria, art. 10, I", "ppi",
      resources.length || filled(plan?.accessibilityResources) ? "ok" : "pendente",
      filled(plan?.accessibilityResources) ? "Recursos de acessibilidade registrados no plano." : resources.length ? "Recursos indicados no estudo de caso." : "Registre os recursos de acessibilidade no plano."),
    item("paee_ta", "TA e CAA", "PAEE: tecnologia assistiva e comunicação alternativa avaliadas", "Portaria, art. 10, II", "ppi", ta.status, ta.detail),
    item("paee_profissional", "Profissional de apoio", "PAEE: profissional de apoio, intérprete de Libras e guia-intérprete avaliados", "Portaria, art. 10, III", "ppi", supportStaff.status, supportStaff.detail),
    item("paee_rede", "Rede de proteção", "PAEE: formação e rede de proteção social", "Portaria, art. 10, IV", "ppi", network.status, network.detail),
    item("pei_atividades", "AEE e sala comum", "PEI: atividades do AEE e articulação com o professor regente", "Portaria, art. 11, I", "ppi",
      aeeActivities && filled(plan?.commonRoomStrategies) ? "ok" : "pendente",
      aeeActivities && filled(plan?.commonRoomStrategies)
        ? `${filled(plan?.aeeServices) ? `Atendimentos do AEE: ${list(plan?.aeeServices ?? "").join(", ")}. ` : ""}Estratégias do AEE e da sala comum registradas no plano.`
        : `Registre no plano as estratégias ${[!aeeActivities && "do AEE", !filled(plan?.commonRoomStrategies) && "da sala comum"].filter(Boolean).join(" e ")}.`),
    item("pei_acessibilidade", "Acessibilidade curricular", "PEI: medidas de acessibilidade curricular, didática e avaliativa", "Portaria, art. 11, II", "ppi",
      !plan?.objectives ? "pendente" : curricular && evaluative ? "ok" : "conferir",
      !plan?.objectives
        ? "O plano ainda não tem objetivos."
        : `${plural(plan.objectives, "objetivo", "objetivos")} no plano; ${plural(input.approvedAdaptations, "atividade ou prova adaptada aprovada", "atividades ou provas adaptadas aprovadas")}.${filled(plan.assessmentAccessibility) ? ` Na avaliação: ${list(plan.assessmentAccessibility ?? "").join(", ")}.` : evaluative ? "" : " Registre no PEI a acessibilidade na avaliação."}`),
    item("pei_monitoramento", "Monitoramento", "PEI: acompanhamento e monitoramento do plano", "Portaria, art. 11, III", filled(plan?.monitoring) ? "diario" : "ppi",
      input.diaryRecent && filled(plan?.monitoring) ? "ok" : input.diaryRecent || filled(plan?.monitoring) ? "conferir" : "pendente",
      [
        input.diaryRecent ? `${plural(input.diaryRecent, "registro de aula", "registros de aula")} nos últimos 60 dias.` : "Nenhum registro de aula nos últimos 60 dias.",
        filled(plan?.monitoring) ? `Previsto no PEI: ${list(plan?.monitoring ?? "").join(", ")}.` : "Registre no PEI como o plano será acompanhado.",
      ].join(" ")),
    item("pei_devolutiva", "Devolutiva", "PEI: devolutivas à família", "Portaria, art. 11, IV", "relatorios",
      !input.lastReportAt ? "pendente" : daysSince(input.lastReportAt, now) > REPORT_DAYS ? "conferir" : "ok",
      `${!input.lastReportAt ? "Nenhum relatório do período validado." : `Último relatório do período validado em ${day(input.lastReportAt)}.`}${filled(plan?.familyFeedback) ? ` Previsto no PEI: ${list(plan?.familyFeedback ?? "").join(", ")}.` : ""}`),
  ];

  // Orientação do INEP: para declarar o estudante no Censo, basta um registro de
  // referência (estudo de caso ou PAEE já bastam). Não é obrigatório.
  const reference = censusReference(caseStudy, Boolean(plan));
  // O Censo declara o que o PEI registra: atendimentos do AEE (registro 60) e recursos (registro 30).
  const census = input.census ?? null;
  const differences = plan ? censusDifferences(plan, census) : [];
  const comparable = filled(plan?.aeeServices) && filled(plan?.assessmentAccessibility);
  const censusPlan: { status: EvidenceStatus; detail: string } =
    !plan ? { status: "info", detail: "Sem plano para comparar." }
      : !census ? { status: "info", detail: "Nenhum arquivo do Censo aplicado com este estudante." }
        : differences.length ? { status: "conferir", detail: `No último arquivo do Censo: ${differences.map((entry) => `${lowerFirst(entry.label)}: ${entry.census.join(", ") || "nenhum"}`).join("; ")}. Confira o plano ou o Educacenso.` }
          : !comparable ? { status: "conferir", detail: "Registre no PEI os atendimentos do AEE e os recursos na avaliação: é o que a escola declara no Censo." }
            : { status: "ok", detail: `Iguais no plano e no arquivo do Censo${census.syncedAt ? ` aplicado em ${day(new Date(census.syncedAt))}` : ""}.` };
  const censusItems: EvidenceItem[] = [
    item("censo_registro", "Registro para o Censo", "Registro de referência para declarar no Censo Escolar", "INEP, Censo Escolar (31/08/2026)", "estudo-de-caso",
      reference.backed ? "ok" : "conferir",
      reference.backed ? `Respaldo da declaração: ${reference.records.join(", ")}.` : reference.pending ? `${reference.pending} Sem PAEE, a declaração fica sem registro de referência.` : "Sem estudo de caso concluído nem PAEE. Qualquer um deles basta; laudo não pode ser exigido."),
    item("censo_plano", "Plano e Censo", "Atendimentos do AEE e recursos iguais aos do Censo", "Educacenso, registros 30 e 60", "ppi", censusPlan.status, censusPlan.detail),
  ];

  const { done, absences, cancelled } = input.aee;
  const followItems: EvidenceItem[] = [
    item("aee", "AEE no mês", "Atendimentos do AEE", "Portaria, art. 7º, V", "atendimentos-aee",
      done ? "ok" : absences + cancelled ? "conferir" : "pendente",
      done + absences + cancelled ? `Nos últimos 30 dias: ${plural(done, "realizado", "realizados")}, ${plural(absences, "falta", "faltas")} e ${plural(cancelled, "cancelamento", "cancelamentos")}.` : "Nenhum atendimento registrado nos últimos 30 dias."),
    item("sondagem", "Sondagem", "Avaliação contínua (sondagem)", "Portaria, art. 7º, § 3º", "sondagem",
      input.assessmentAt && daysSince(input.assessmentAt, now) <= REASSESS_DAYS ? "ok" : "conferir",
      !input.assessmentAt ? "Sem linha de base." : daysSince(input.assessmentAt, now) <= REASSESS_DAYS ? `Última aplicação em ${day(input.assessmentAt)}.` : `Última aplicação em ${day(input.assessmentAt)}: a reavaliação venceu.`),
    item("autorizacoes", "Autorizações", "Autorizações da família (IA e terapeuta)", "LGPD, art. 14", "", "info",
      input.consent?.decidedAt
        ? `Decididas em ${day(input.consent.decidedAt)}: uso da IA ${input.consent.aiUse ? "autorizado" : "não autorizado"}; conexão com o terapeuta ${input.consent.therapistLink ? "autorizada" : "não autorizada"}.`
        : "A família ainda não decidiu. Sem a autorização, a IA não recebe dados do estudante."),
  ];

  return [
    { title: "Estudo de caso", items: caseItems },
    { title: "Plano: PAEE e PEI", items: planItems },
    { title: "Atendimento e acompanhamento", items: followItems },
    { title: "Censo Escolar", items: censusItems },
  ];
}

export function evidenceSummary(groups: EvidenceGroup[]): { ok: number; conferir: number; pendente: number; total: number } {
  const items = groups.flatMap((group) => group.items).filter((entry) => entry.status !== "info");
  const count = (status: EvidenceStatus) => items.filter((entry) => entry.status === status).length;
  return { ok: count("ok"), conferir: count("conferir"), pendente: count("pendente"), total: items.length };
}

export function itemTotals(students: { groups: EvidenceGroup[] }[]): { id: string; short: string; label: string; pendente: number; conferir: number }[] {
  const totals = new Map<string, { id: string; short: string; label: string; pendente: number; conferir: number }>();
  for (const entry of students.flatMap((student) => student.groups.flatMap((group) => group.items))) {
    if (entry.status !== "pendente" && entry.status !== "conferir") continue;
    const total = totals.get(entry.id) ?? { id: entry.id, short: entry.short, label: entry.label, pendente: 0, conferir: 0 };
    total[entry.status] += 1;
    totals.set(entry.id, total);
  }
  return [...totals.values()].sort((a, b) => b.pendente - a.pendente || b.conferir - a.conferir);
}
