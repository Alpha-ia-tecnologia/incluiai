// Dossiê de evidências (item 8 do plano), puro para teste com node --test
// (src/lib/evidence.test.mjs). Para cada exigência do Decreto nº 12.686/2025
// (com a redação do 12.773/2025) e da Portaria MEC nº 421/2026, diz se o
// registro está na plataforma e onde. Aponta o registro; não é parecer jurídico.

export type EvidenceStatus = "ok" | "conferir" | "pendente" | "info";
export type EvidenceItem = { id: string; label: string; short: string; norm: string; status: EvidenceStatus; detail: string; tab: string };
export type EvidenceGroup = { title: string; items: EvidenceItem[] };

export type EvidenceInput = {
  now: Date;
  caseStudy: { status: string; concludedAt: Date | null; content: Record<string, string> } | null;
  plan: { createdAt: Date; reviewedAt: Date | null; reviewDate: Date; commonRoomStrategies: string | null; aeeStrategies: string | null; accessibilityResources: string | null; objectives: number } | null;
  approvedAdaptations: number; // atividades e provas adaptadas aprovadas
  diaryRecent: number; // registros de aula nos últimos 60 dias
  aee: { done: number; absences: number; cancelled: number }; // últimos 30 dias
  lastReportAt: Date | null; // último relatório do período validado
  assessmentAt: Date | null; // última sondagem
  consent: { aiUse: boolean; therapistLink: boolean; decidedAt: Date | null } | null;
};

export const STATUS_LABEL: Record<EvidenceStatus, string> = { ok: "Em dia", conferir: "Conferir", pendente: "Pendente", info: "Informação" };

const DAY = 86_400_000;
const YEAR_DAYS = 365;
const REPORT_DAYS = 200; // um semestre e a margem para validar
const REASSESS_DAYS = 84; // o mesmo prazo da sondagem
const day = (date: Date) => date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const daysSince = (date: Date, now: Date) => (now.getTime() - date.getTime()) / DAY;
const list = (value: string | undefined) => (value ?? "").split(/[;\n]/).map((item) => item.trim()).filter(Boolean);
const filled = (value: string | null | undefined) => Boolean(value?.trim());
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
    item("etapa2", "Etapa II", "Etapa II: barreiras e contexto escolar", "Decreto, art. 11, § 1º, II", "estudo-de-caso",
      filled(content.barreiras) || filled(content.participacao) || filled(content.espacos) ? "ok" : "pendente",
      filled(content.barreiras) ? `Barreiras observadas: ${list(content.barreiras).join(", ")}.` : filled(content.participacao) || filled(content.espacos) ? "Observação na escola registrada." : "Registre a observação na escola."),
    item("etapa3", "Etapa III", "Etapa III: potencialidades e demandas de apoio", "Decreto, art. 11, § 1º, III", "estudo-de-caso",
      (filled(content.potencialidades) || filled(content.aprendeMelhor)) && needs.length ? "ok" : "pendente",
      needs.length ? `Necessidades: ${needs.join(", ")}.` : "Registre as potencialidades e as necessidades identificadas."),
    item("etapa4", "Etapa IV", "Etapa IV: estratégias e recursos de acessibilidade", "Decreto, art. 11, § 1º, IV", "estudo-de-caso",
      resources.length || filled(plan?.accessibilityResources) ? "ok" : "pendente",
      resources.length ? `Recursos indicados: ${resources.join(", ")}.` : filled(plan?.accessibilityResources) ? "Recursos registrados no plano." : "Indique os recursos e serviços na síntese do estudo de caso."),
    item("familia", "Família", "Participação da família", "Decreto, art. 11, § 3º", "estudo-de-caso",
      interviewed.length || participants.includes("Família") ? "ok" : "pendente",
      interviewed.length ? `Entrevista com: ${interviewed.join(", ")}.` : participants.includes("Família") ? "A família participou do estudo." : "Registre a entrevista com a família."),
    (() => {
      const heard = filled(content.formaEscuta) && content.formaEscuta !== "Não foi possível";
      const status: EvidenceStatus = heard || participants.includes("O próprio estudante") ? "ok" : content.formaEscuta === "Não foi possível" ? "conferir" : "pendente";
      const detail = heard ? `Escuta por: ${content.formaEscuta}.` : status === "ok" ? "O estudante participou do estudo." : status === "conferir" ? "A escuta não foi possível: tente outra forma, como desenho, prancha ou observação das escolhas." : "Registre a escuta do estudante.";
      return item("estudante", "Estudante", "Participação do estudante", "Decreto, art. 11, § 3º", "estudo-de-caso", status, detail);
    })(),
    item("laudo", "Sem laudo", "Sem exigência de laudo", "Decreto, art. 11, § 7º; Portaria nº 421/2026, art. 7º, § 4º", "estudo-de-caso", "info",
      "A plataforma não pede diagnóstico nem laudo em nenhuma etapa. O diagnóstico informado pela família é opcional e só o AEE e a coordenação o veem."),
  ];

  const last = plan ? (plan.reviewedAt ?? plan.createdAt) : null;
  const tea = [...needs, ...resources].filter((entry) => /tecnologia assistiva|comunicação alternativa|prancha/i.test(entry));
  const staff = resources.filter((entry) => /profissional de apoio|intérprete|guia-intérprete/i.test(entry));
  const planItems: EvidenceItem[] = [
    item("plano", "Plano", "Plano a partir do estudo de caso", "Decreto, art. 12; Portaria, art. 7º, IV", "ppi",
      plan ? "ok" : "pendente",
      plan ? `Plano de ensino desde ${day(plan.createdAt)}: o documento único com as finalidades do PAEE e do PEI (Portaria, art. 7º, § 2º).` : concluded ? "Monte o plano de ensino a partir do estudo de caso." : "Depende do estudo de caso concluído."),
    item("revisao", "Revisão anual", "Revisão anual do plano", "Portaria, art. 7º, § 3º", "ppi",
      !plan || !last ? "pendente" : daysSince(last, now) > YEAR_DAYS ? "pendente" : plan.reviewDate < now ? "conferir" : "ok",
      !plan || !last ? "Sem plano." : daysSince(last, now) > YEAR_DAYS ? `A última revisão foi em ${day(last)}, há mais de um ano.` : plan.reviewDate < now ? `Revisado em ${day(last)}; a revisão marcada para ${day(plan.reviewDate)} passou.` : `${plan.reviewedAt ? "Revisado" : "Feito"} em ${day(last)}; próxima revisão em ${day(plan.reviewDate)}.`),
    item("paee_recursos", "Recursos", "PAEE: materiais e recursos contra as barreiras", "Portaria, art. 10, I", "ppi",
      resources.length || filled(plan?.accessibilityResources) ? "ok" : "pendente",
      filled(plan?.accessibilityResources) ? "Recursos de acessibilidade registrados no plano." : resources.length ? "Recursos indicados no estudo de caso." : "Registre os recursos de acessibilidade no plano."),
    item("paee_ta", "TA e CAA", "PAEE: tecnologia assistiva e comunicação alternativa avaliadas", "Portaria, art. 10, II", "estudo-de-caso",
      tea.length ? "ok" : "conferir",
      tea.length ? `Indicado: ${tea.join(", ")}.` : "Nada indicado. Se a equipe avaliou e não há necessidade, registre isso nos recursos de acessibilidade do plano."),
    item("paee_profissional", "Profissional de apoio", "PAEE: profissional de apoio, intérprete de Libras e guia-intérprete avaliados", "Portaria, art. 10, III", "estudo-de-caso",
      staff.length ? "ok" : "conferir",
      staff.length ? `Indicado: ${staff.join(", ")}.` : "Nada indicado. Se a equipe avaliou e não há necessidade, registre isso nos recursos de acessibilidade do plano."),
    item("paee_rede", "Rede de proteção", "PAEE: formação e rede de proteção social", "Portaria, art. 10, IV", "estudo-de-caso",
      referrals.length ? "ok" : "conferir",
      referrals.length ? `Encaminhamentos: ${referrals.join(", ")}.` : "Registre os encaminhamentos na síntese do estudo de caso, ou Nenhum."),
    item("pei_atividades", "AEE e sala comum", "PEI: atividades do AEE e articulação com o professor regente", "Portaria, art. 11, I", "ppi",
      filled(plan?.aeeStrategies) && filled(plan?.commonRoomStrategies) ? "ok" : "pendente",
      filled(plan?.aeeStrategies) && filled(plan?.commonRoomStrategies) ? "Estratégias do AEE e da sala comum registradas no plano." : `Registre no plano as estratégias ${[!filled(plan?.aeeStrategies) && "do AEE", !filled(plan?.commonRoomStrategies) && "da sala comum"].filter(Boolean).join(" e ")}.`),
    item("pei_acessibilidade", "Acessibilidade curricular", "PEI: medidas de acessibilidade curricular, didática e avaliativa", "Portaria, art. 11, II", "atividades",
      !plan?.objectives ? "pendente" : filled(plan.accessibilityResources) || input.approvedAdaptations ? "ok" : "conferir",
      !plan?.objectives ? "O plano ainda não tem objetivos." : `${plural(plan.objectives, "objetivo", "objetivos")} no plano; ${plural(input.approvedAdaptations, "atividade ou prova adaptada aprovada", "atividades ou provas adaptadas aprovadas")}.`),
    item("pei_monitoramento", "Monitoramento", "PEI: acompanhamento e monitoramento do plano", "Portaria, art. 11, III", "diario",
      input.diaryRecent ? "ok" : "pendente",
      input.diaryRecent ? `${plural(input.diaryRecent, "registro de aula", "registros de aula")} nos últimos 60 dias.` : "Nenhum registro de aula nos últimos 60 dias."),
    item("pei_devolutiva", "Devolutiva", "PEI: devolutivas à família", "Portaria, art. 11, IV", "relatorios",
      !input.lastReportAt ? "pendente" : daysSince(input.lastReportAt, now) > REPORT_DAYS ? "conferir" : "ok",
      !input.lastReportAt ? "Nenhum relatório do período validado." : `Último relatório do período validado em ${day(input.lastReportAt)}.`),
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
  ];
}

export function evidenceSummary(groups: EvidenceGroup[]): { ok: number; conferir: number; pendente: number; total: number } {
  const items = groups.flatMap((group) => group.items).filter((entry) => entry.status !== "info");
  const count = (status: EvidenceStatus) => items.filter((entry) => entry.status === status).length;
  return { ok: count("ok"), conferir: count("conferir"), pendente: count("pendente"), total: items.length };
}

// Visão da escola ou da rede: por item, quantos estudantes têm pendência ou algo
// a conferir, do mais frequente ao menos (só os itens com algum estudante).
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
