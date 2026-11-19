import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { textContains } from "@/lib/db-text";
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool";
import { z } from "zod/v4";
import { db } from "../prisma";
import { recordView } from "../audit";
import { assertStudentTeam, type SessionUser } from "../auth";
import { can, roleGroup, type Group } from "../roles";
import { familyActivityWhere } from "../policy";
import { loadPlanContext, profileText } from "../agents/context";
import { aiStatusText } from "../agents/ai-status";
import { proposePlan } from "../plan-proposal";
import { generateActivities } from "../activities";
import { ALERTS, objectiveTrend, studentAlerts } from "../insights";
import { JOURNEY_SELECT, nextStepOf } from "../student-journey";
import { MATERIAL_KINDS } from "../material-content";
import { MATERIAL_KIND_KEYS } from "../material-content";
import { ACTIVITY_CONTEXTS } from "../pedagogy-rules";
import { createStudentMaterial } from "../material-generate";
import { loadDashboard } from "../dashboard";
import { CALENDAR_THEMES, dateRangeLabel, relativeLabel, upcomingEvents } from "../commemorative-dates";
import { ACTIVITY_STATUS, CONTEXTS, DIMENSIONS, OBJECTIVE_STATUS, SHIFTS, STAGES, TREND, labelOf, supportInfo } from "../scale";
import { plural, readList } from "../format";
import { ageFrom, brYmd, formatDate } from "../dates";
import { isHomeActivityNote } from "../user-journey";
import { withoutCodes } from "../without-codes";
import { studentFollowUp } from "../dua/applications";
import { hasStudentLabel, type Pseudonymizer } from "../agents/redactor";
import { FALLBACK } from "../action-result";
import { UserError } from "../user-error";
import { decideActivity, saveDiaryEntry, saveFamilyNote, saveIntersectorReport, setObjectiveStatus } from "../records";
import { toActionView } from "./store";
import { isProposalKind, readProposalArgs, writeProposalArgs, type ProposalArgs, type ProposalKind } from "./proposals";
import { forGroup, runningLabel, toolNames, type ByGroup, type ToolName } from "./catalog";
import type { ActionView, AgentProgress, AssistantEvent } from "./types";

export type ToolContext = {
  user: SessionUser;
  group: Group;
  privacy: Pseudonymizer;
  studentIds: string[];
  conversationId: string;
  emit: (event: AssistantEvent) => void;
};

const support = (level: number) => `${level} (${supportInfo(level).code}, ${supportInfo(level).description.toLowerCase()})`;
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const studentRef = z.string().describe("Marcador do estudante, como [ESTUDANTE 1], ou o id dele");

type Report = (progress: AgentProgress) => void;

type Run<Input extends z.ZodObject> = (ctx: ToolContext, args: z.output<Input>, report: Report) => Promise<string>;
type ToolBuilder = (ctx: ToolContext, name: ToolName) => BetaRunnableTool;

function tool<Input extends z.ZodObject>(spec: { description: ByGroup<string>; input: Input; run: ByGroup<Run<Input>> }): ToolBuilder {
  return (ctx, name) => {
    const description = forGroup(spec.description, ctx.group);
    const run = forGroup(spec.run, ctx.group);
    if (description === undefined || !run) throw new Error(`A ferramenta ${name} não tem versão para o grupo ${ctx.group}.`);
    const label = runningLabel(name);
    return betaZodTool({
      name,
      description,
      inputSchema: spec.input,
      run: async (args, context) => {
        const id = context?.toolUse.id ?? name;
        const report: Report = (progress) => ctx.emit({ type: "tool_progress", id, progress });
        try {
          const text = await run(ctx, args, report);
          ctx.emit({ type: "tool_end", step: { id, name, label, ok: true } });
          return ctx.privacy.apply(text);
        } catch (error) {
          if (!(error instanceof UserError)) console.error(`[assistente] ferramenta ${name} falhou:`, error);
          const message = error instanceof UserError ? error.message : FALLBACK;
          ctx.emit({ type: "tool_end", step: { id, name, label, ok: false, summary: message } });
          return `Erro: ${ctx.privacy.apply(message)}`;
        }
      },
    });
  };
}

async function resolveStudentId(ctx: ToolContext, ref: string): Promise<string> {
  const prisma = await db();
  if (hasStudentLabel(ref)) {
    const id = ctx.privacy.studentIdOf(ref);
    if (id && ctx.studentIds.includes(id)) return id;
    throw new UserError("Estudante não encontrado no seu escopo. Use buscar_estudantes para ver a lista.", "not_found");
  }
  const trimmed = ref.trim();
  if (ctx.studentIds.includes(trimmed)) return trimmed;
  const students = await prisma.student.findMany({ where: { id: { in: ctx.studentIds } }, select: { id: true, name: true } });
  const matches = students.filter((student) => normalize(student.name).includes(normalize(trimmed)));
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) throw new UserError(`Mais de um estudante corresponde: ${matches.map((student) => ctx.privacy.studentLabel(student.id)).join(", ")}. Use o id.`);
  throw new UserError("Estudante não encontrado. Use buscar_estudantes para ver a lista.", "not_found");
}

async function propose<K extends ProposalKind>(ctx: ToolContext, kind: K, summary: string, args: ProposalArgs<K>): Promise<string> {
  const prisma = await db();
  const action = await prisma.assistantAction.create({ data: { conversationId: ctx.conversationId, kind, summary, args: writeProposalArgs(kind, args) } });
  ctx.emit({ type: "action", action: toActionView(action) });
  return `Cartão de confirmação preparado (ação ${kind}). Nada foi gravado ainda: a pessoa precisa confirmar no cartão que apareceu na tela. Diga isso em uma frase e não chame esta ferramenta de novo para o mesmo pedido.`;
}

const NETWORK_PANEL = "Números do painel para a rede inteira ou para uma escola (pelo id): jornada, avisos, planos, aulas, atividades, uso da IA e estudantes com avisos.";

const TOOLS: Record<ToolName, ToolBuilder> = {
  buscar_estudantes: tool({
    description: "Lista os estudantes que a pessoa pode acompanhar, com marcador, id, turma, escola e próximo passo da jornada. Filtros opcionais por texto e por turma.",
    input: z.object({
      busca: z.string().optional().describe("Marcador, id ou parte do nome digitado pela pessoa"),
      turma: z.string().optional().describe("Parte do nome da turma, como 'Turma B'"),
    }),
    run: async (ctx, args) => {
      const prisma = await db();
      const students = await prisma.student.findMany({
        where: { id: { in: ctx.studentIds }, ...(args.turma ? { className: textContains(args.turma) } : {}) },
        orderBy: { name: "asc" },
        include: {
          ...JOURNEY_SELECT,
          diaryEntries: { orderBy: { date: "desc" }, select: { id: true, date: true }, take: 1 },
        },
      });
      const busca = args.busca;
      const list = !busca ? students
        : hasStudentLabel(busca) ? students.filter((student) => student.id === ctx.privacy.studentIdOf(busca))
        : students.filter((student) => student.id === busca || normalize(student.name).includes(normalize(busca)));
      if (!list.length) return "Nenhum estudante encontrado com esse filtro.";
      const lines = list.slice(0, 60).map((student) => {
        const next = nextStepOf(student);
        return `- ${ctx.privacy.studentLabel(student.id)} (id ${student.id}): ${student.gradeYear}, ${student.className}, ${SHIFTS[student.shift] ?? student.shift}, ${ctx.privacy.schoolLabel(student.schoolId)}; próximo passo: ${next.label} (${next.href}); último registro de aula: ${student.diaryEntries[0] ? formatDate(student.diaryEntries[0].date) : "nenhum"}.`;
      });
      return `${plural(list.length, "estudante", "estudantes")}${list.length > 60 ? " (mostrando 60)" : ""}:\n${lines.join("\n")}`;
    },
  }),
  ver_estudante: tool({
    description: "Resumo completo de um estudante: jornada e próximo passo, avisos, plano e objetivos (com ids e tendência), como aprende, registros de aula, atividades, família e orientações da saúde. Consulte antes de responder sobre um estudante.",
    input: z.object({ estudante: studentRef }),
    run: async (ctx, args) => {
      const prisma = await db();
      const id = await resolveStudentId(ctx, args.estudante);
      const s = await prisma.student.findUniqueOrThrow({
        where: { id },
        include: {
          caseStudy: { select: { status: true } },
          profile: { select: { id: true } },
          plans: { include: { objectives: true }, orderBy: { createdAt: "desc" } },
          diaryEntries: { orderBy: { date: "asc" } },
          activities: { orderBy: { createdAt: "desc" } },
          familyNotes: { orderBy: { date: "desc" }, take: 3 },
          intersectorReports: { orderBy: { createdAt: "desc" }, take: 1 },
          materials: { select: { kind: true, title: true } },
          planDraft: { select: { source: true, createdAt: true } },
        },
      });
      await recordView(ctx.user, id, "Assistente: resumo do estudante");
      const { text } = await loadPlanContext(id);
      const label = ctx.privacy.studentLabel(id);
      const activePlan = s.plans.find((plan) => plan.status === "ativo");
      const next = nextStepOf(s);
      const alerts = studentAlerts({ plans: s.plans, entries: s.diaryEntries });
      const counts = Object.fromEntries(Object.keys(ACTIVITY_STATUS).map((status) => [status, s.activities.filter((a) => a.status === status).length]));
      const health = s.intersectorReports[0];
      const sections = [
        `# ${label} (id ${id})`,
        `${s.gradeYear}, ${s.className}, ${SHIFTS[s.shift] ?? s.shift}, ${ctx.privacy.schoolLabel(s.schoolId)}. ${ageFrom(s.birthDate)} anos, ${STAGES[s.stage] ?? s.stage}. Atendimento: ${s.aeeFrequency ?? "frequência não informada"}. Profissional de apoio: ${s.supportProfessional ? "sim" : "não"}.${s.accessibilityNotes ? ` Recursos de acessibilidade: ${s.accessibilityNotes}.` : ""}`,
        `Páginas: resumo /estudantes/${id} · estudo de caso /estudantes/${id}/estudo-de-caso · como aprende /estudantes/${id}/perfil · plano /estudantes/${id}/ppi · atividades /estudantes/${id}/atividades · materiais /estudantes/${id}/materiais · registrar aula /estudantes/${id}/diario · evolução /estudantes/${id}/linha-do-tempo`,
        `\n## Jornada\nPróximo passo sugerido: ${next.label} (${next.href}). Estudo de caso: ${s.caseStudy?.status === "concluido" ? "concluído" : s.caseStudy ? "em rascunho" : "não feito"}. Como aprende: ${s.profile ? "preenchido" : "não preenchido"}. Plano ativo: ${activePlan ? "sim" : "não"}. Atividades preparadas: ${counts.aceita + counts.aplicada}. Registros de aula: ${s.diaryEntries.length}.`,
        alerts.length ? `Avisos: ${alerts.map((alert) => alert.message).join(" ")}` : "Avisos: nenhum.",
        activePlan
          ? `\n## Plano ativo (revisão em ${formatDate(activePlan.reviewDate)})\n${activePlan.objectives.map((objective) => {
            const insight = objectiveTrend(objective, s.diaryEntries);
            return `- Objetivo (id ${objective.id}, ${DIMENSIONS[objective.dimension] ?? objective.dimension}, ${labelOf(OBJECTIVE_STATUS, objective.status).toLowerCase()}): ${objective.description} Apoio atual ${support(objective.currentSupport)} → esperado ${support(objective.targetSupport)}. Tendência: ${TREND[insight.trend].label}. ${insight.message}${insight.lastSupportLevels.length ? ` Últimos níveis de apoio: ${insight.lastSupportLevels.join(" → ")}.` : ""}`;
          }).join("\n") || "Sem objetivos."}`
          : "\n## Plano\nSem plano ativo.",
        s.planDraft ? `Há uma proposta de plano aguardando revisão (${s.planDraft.source === "ia" ? "agentes de IA" : "motor de regras"}, ${formatDate(s.planDraft.createdAt)}) em /estudantes/${id}/ppi#proposta.` : "",
        `\n${text}`,
        `\n## Atividades (${Object.entries(counts).map(([status, total]) => `${total} ${ACTIVITY_STATUS[status].label.toLowerCase()}`).join(", ")})\n${s.activities.slice(0, 8).map((a) => `- (id ${a.id}) ${a.title}: ${labelOf(CONTEXTS, a.context)}, ${labelOf(ACTIVITY_STATUS, a.status)}, ${a.durationMinutes} min${a.objectiveId ? `, objetivo ${a.objectiveId}` : ""}`).join("\n") || "Nenhuma atividade ainda."}`,
        s.materials.length ? `Materiais acessíveis: ${s.materials.map((m) => m.title).join("; ")}.` : "Materiais acessíveis: nenhum.",
        `\n## A família observou\n${s.familyNotes.map((note) => `- "${note.note}" (${formatDate(note.date)})`).join("\n") || "Nenhuma observação da família ainda."}`,
        health ? `\n## Orientações da saúde (${formatDate(health.createdAt)})\nComunicação eficaz: ${health.communication}. Recursos: ${health.accessResources}. Estratégias a testar: ${health.strategiesToTry}. Orientações à escola: ${health.schoolGuidance}. Objetivos compartilhados: ${health.sharedGoals}.` : "",
      ];
      return sections.filter(Boolean).join("\n");
    },
  }),
  ver_atividades: tool({
    description: "Atividades de um estudante com passos, materiais, forma de resposta e critério de sucesso. Útil para orientar a aula de hoje ou avaliar sugestões.",
    input: z.object({
      estudante: studentRef,
      situacao: z.enum(["sugerida", "aceita", "aplicada", "rejeitada", "todas"]).optional().describe("Filtra pela situação; padrão: todas"),
      limite: z.number().int().min(1).max(20).optional(),
    }),
    run: async (ctx, args) => {
      const prisma = await db();
      const id = await resolveStudentId(ctx, args.estudante);
      const activities = await prisma.activity.findMany({
        where: { studentId: id, ...(args.situacao && args.situacao !== "todas" ? { status: args.situacao } : {}) },
        orderBy: { createdAt: "desc" },
        take: args.limite ?? 8,
        include: { objective: { select: { id: true, action: true } }, image: { select: { kind: true } } },
      });
      if (!activities.length) return `Nenhuma atividade ${args.situacao && args.situacao !== "todas" ? `com situação "${args.situacao}" ` : ""}para ${ctx.privacy.studentLabel(id)}. Página: /estudantes/${id}/atividades`;
      return activities.map((a) => [
        `### ${a.title} (id ${a.id}) · ${labelOf(CONTEXTS, a.context)} · ${labelOf(ACTIVITY_STATUS, a.status)} · ${a.durationMinutes} min · origem: ${a.source}`,
        a.objective ? `Objetivo (id ${a.objective.id}): ${a.objective.action}` : "",
        `Materiais: ${readList(a.materials).join(", ") || "nenhum"}`,
        `Passos: ${readList(a.steps).map((step, index) => `${index + 1}. ${step}`).join(" ")}`,
        `Resposta aceita: ${a.responseForm}. Critério de sucesso: ${a.successCriterion}.`,
        `Escada de apoio: mais apoio: ${a.supportBelow} | alvo: ${a.supportTarget} | menos apoio: ${a.supportAbove}.`,
        `Plano B: ${a.planB}.`,
        a.classParticipation ? `Como a turma participa: ${a.classParticipation}` : "",
        a.rejectReason ? `Motivo da rejeição: ${a.rejectReason}` : "",
        a.image ? "Tem imagem de apoio gerada." : "",
      ].filter(Boolean).join("\n")).join("\n\n") + `\n\nPágina: /estudantes/${id}/atividades`;
    },
  }),
  proximos_passos_dua: tool({
    description: "Próximos passos sugeridos para um estudante a partir das evidências das atividades planejadas com DUA. Cada sugestão traz a base usada e o que ainda precisa ser observado. São recomendações para a equipe revisar: não são decisão profissional nem resultado observado.",
    input: z.object({ estudante: studentRef }),
    run: async (ctx, args) => {
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const suggestions = await studentFollowUp(ctx.user, id);
      await recordView(ctx.user, id, "Assistente: próximos passos das atividades com DUA");
      const label = ctx.privacy.studentLabel(id);
      const notice = "Recomendações para a equipe revisar. Recomendação não é decisão profissional, e decisão não é resultado observado: a equipe decide o que fazer, e o resultado só existe quando for observado e registrado.";
      const page = `Página: /estudantes/${id}/atividades/dua (passo Atividade, planejar com DUA)`;
      if (!suggestions.length) {
        return `Nenhum próximo passo sugerido para ${label} nas atividades com DUA: ainda não há evidência registrada, ou os registros não apontam o que retomar. Não conclua nada sobre a aprendizagem a partir disso.\n${notice}\n${page}`;
      }
      return [
        `# Próximos passos sugeridos para ${label} (atividades com DUA)`,
        notice,
        ...suggestions.map((item, index) => `${index + 1}. ${item.text}\n   Base usada: ${item.basis}\n   O que ainda precisa ser observado: ${item.pending}`),
        page,
      ].join("\n");
    },
  }),
  propor_plano: tool({
    description: "Pede aos agentes de IA uma proposta de plano (PAEE, PEI e objetivos) para o estudante, a partir do estudo de caso e de como aprende. Demora de 1 a 3 minutos e tem custo; chame só quando a pessoa pedir claramente. A proposta fica aguardando revisão em /estudantes/ID/ppi#proposta.",
    input: z.object({ estudante: studentRef }),
    run: async (ctx, args, report) => {
      const id = await resolveStudentId(ctx, args.estudante);
      const { proposal, source, trace } = await proposePlan(ctx.user, id, report);
      return [
        `Proposta pronta (${source === "ia" ? "agentes de IA" : "motor de regras"}). Trilha: ${trace.map((step) => step.agent).join(" → ")}.`,
        `Revisão sugerida em ${proposal.reviewWeeks} semanas. O estudante já consegue: ${proposal.initialSituation.join("; ")}.`,
        `Objetivos propostos:\n${proposal.objectives.map((objective, index) => `${index + 1}. [${DIMENSIONS[objective.dimension] ?? objective.dimension}] ${objective.action}, ${objective.condition}, em ${objective.criterion}, em ${objective.deadlineWeeks} semanas (apoio ${objective.currentSupport} → ${objective.targetSupport}). Por quê: ${objective.rationale}`).join("\n")}`,
        `Estratégias para a sala comum: ${proposal.commonRoomStrategies.join("; ")}.`,
        proposal.aeeServices.length ? `Atendimentos do AEE sugeridos (nomes do Censo): ${proposal.aeeServices.join("; ")}.` : "",
        "A proposta também sugere os itens do PAEE e do PEI (recursos, tecnologia assistiva, apoio, rede, avaliação, acompanhamento e devolutiva) para a equipe conferir.",
        `A pessoa revisa, escolhe os objetivos e ativa o plano em /estudantes/${id}/ppi#proposta.`,
      ].filter(Boolean).join("\n");
    },
  }),
  gerar_atividades: tool({
    description: "Cria 3 sugestões de atividade (sala comum, AEE e casa) para um objetivo e um conteúdo da aula da turma. Demora de 1 a 3 minutos (com imagens, cerca de 1 minuto a mais) e tem custo. As sugestões ficam aguardando a decisão da pessoa em /estudantes/ID/atividades.",
    input: z.object({
      estudante: studentRef,
      objetivoId: z.string().describe("Id do objetivo ativo (do resumo do estudante)"),
      conteudoDaAula: z.string().describe("O que a turma vai trabalhar na aula, como 'chamada com os nomes' ou 'contagem até 10'"),
      comImagens: z.boolean().optional().describe("Gerar também imagens de apoio (pictogramas) para cada atividade"),
    }),
    run: async (ctx, args, report) => {
      const id = await resolveStudentId(ctx, args.estudante);
      const { cards, created, images } = await generateActivities(ctx.user, id, { objectiveId: args.objetivoId, lessonTopic: args.conteudoDaAula, withImages: Boolean(args.comImagens) }, report);
      return [
        `3 sugestões criadas (origem: ${cards[0]?.source === "ia" ? "agentes de IA" : "motor de regras"}) e aguardando a decisão da pessoa em /estudantes/${id}/atividades.${images === null ? "" : ` Imagens de apoio geradas: ${images} de ${created.length}.`}`,
        ...cards.map((card, index) => [
          `### ${card.title} (id ${created[index]?.id}) · ${labelOf(CONTEXTS, card.context)} · ${card.durationMinutes} min`,
          `Materiais: ${card.materials.join(", ")}`,
          `Passos: ${card.steps.map((step, i) => `${i + 1}. ${step}`).join(" ")}`,
          `Critério de sucesso: ${card.successCriterion}. Plano B: ${card.planB}`,
          card.classParticipation ? `Como a turma participa: ${card.classParticipation}` : "",
          card.reviewNotes?.length ? `Pontos para a pessoa conferir: ${card.reviewNotes.join("; ")}` : "",
        ].filter(Boolean).join("\n")),
      ].join("\n\n");
    },
  }),
  criar_material: tool({
    description: "Cria um material de apoio a partir do perfil do estudante, com cartões, como preparar e usar, e atividades para aplicar na sala comum, no AEE e em casa: rotina visual, passo a passo de uma tarefa, história social, prancha de comunicação, quadro de escolhas ou cartões de autorregulação. Com imagens=true, desenha um pictograma por cartão (leva até 1 minuto). O material fica como sugestão em /estudantes/ID/materiais até a equipe aprovar.",
    input: z.object({
      estudante: studentRef,
      tipo: z.enum(MATERIAL_KIND_KEYS),
      tema: z.string().optional().describe("Situação ou conteúdo do material. Ex.: hora do lanche, troca de sala, leitura compartilhada"),
      contexto: z.enum(ACTIVITY_CONTEXTS).optional().describe("Onde o material será mais usado"),
      imagens: z.boolean().optional().describe("Gerar um pictograma para cada cartão. Use quando a pessoa pedir imagem ou figura."),
    }),
    run: async (ctx, args) => {
      const id = await resolveStudentId(ctx, args.estudante);
      const { material, content, source, images } = await createStudentMaterial(ctx.user, id, {
        kind: args.tipo, topic: args.tema ?? "", context: args.contexto ?? "aee", withImages: Boolean(args.imagens),
      });
      const kind = MATERIAL_KINDS.find((item) => item.kind === args.tipo);
      return [
        `${kind?.label ?? args.tipo} criado ${source === "ia" ? "pelos agentes de IA" : "pelas regras da plataforma"}: "${material.title}". Fica como sugestão até a equipe aprovar.`,
        `Para que serve: ${content.purpose}`,
        `Cartões: ${content.cards.map((card) => card.label).join("; ")}.`,
        `Atividades para aplicar: ${content.activities.map((activity) => `${activity.title} (${activity.durationMinutes} min)`).join("; ")}.`,
        images.requested ? `Imagens: ${images.created} pictograma(s) prontos${images.errors.length ? `; ${images.errors[0]}` : ""}.` : "Sem imagens: podem ser geradas na página do material.",
        content.reviewNotes.length ? `Pontos para a equipe conferir: ${content.reviewNotes.join("; ")}` : "",
        `Ver, aprovar e imprimir: /estudantes/${id}/materiais/${material.id}.`,
      ].filter(Boolean).join("\n");
    },
  }),
  registrar_aula: tool({
    description: "Prepara o registro de uma aula em 3 toques (participação, apoio e critério), com observação opcional. Não grava: abre um cartão para a pessoa confirmar. Reúna os três toques antes de chamar.",
    input: z.object({
      estudante: studentRef,
      objetivoId: z.string().optional().describe("Id do objetivo trabalhado"),
      atividadeId: z.string().optional().describe("Id da atividade aplicada; ao confirmar, ela passa a 'aplicada'"),
      participacao: z.enum(["total", "parcial", "recusou"]),
      apoio: z.number().int().min(0).max(5).describe("Nível de apoio necessário, de 0 (independente) a 5 (apoio físico total)"),
      criterio: z.enum(["sim", "parcial", "nao"]).describe("O critério do objetivo foi atingido?"),
      observacao: z.string().optional(),
      oQueAjudou: z.string().optional().describe("Estratégias que ajudaram, separadas por ponto e vírgula"),
      proximoPasso: z.string().optional().describe("O que tentar no próximo encontro"),
    }),
    run: async (ctx, args) => {
      const prisma = await db();
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const student = await prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true } });
      const objective = args.objetivoId ? await prisma.objective.findFirst({ where: { id: args.objetivoId, plan: { studentId: id } }, select: { id: true, action: true } }) : null;
      if (args.objetivoId && !objective) throw new UserError("Objetivo não encontrado para este estudante.", "not_found");
      const activity = args.atividadeId ? await prisma.activity.findFirst({ where: { id: args.atividadeId, studentId: id }, select: { id: true, title: true } }) : null;
      if (args.atividadeId && !activity) throw new UserError("Atividade não encontrada para este estudante.", "not_found");
      const participation = { total: "participou de toda a atividade", parcial: "participou de parte", recusou: "recusou" }[args.participacao];
      const criterion = { sim: "atingiu o critério", parcial: "atingiu parcialmente", nao: "não atingiu o critério" }[args.criterio];
      const authorRole = ctx.user.role;
      const summary = `Registrar a aula de ${student.name}: ${participation}, apoio ${support(args.apoio)}, ${criterion}.${objective ? ` Objetivo: ${objective.action}.` : ""}${activity ? ` Atividade: ${activity.title} (passa a aplicada).` : ""}${args.observacao ? ` Observação: ${args.observacao}` : ""}`;
      return propose(ctx, "registrar_aula", summary, {
        studentId: id, objectiveId: objective?.id ?? null, activityId: activity?.id ?? null,
        participation: args.participacao, supportLevel: args.apoio, criterionMet: args.criterio,
        note: args.observacao ?? null, whatWorked: args.oQueAjudou ?? null, recommendation: args.proximoPasso ?? null, authorRole,
      });
    },
  }),
  decidir_atividade: tool({
    description: "Prepara a aceitação ou a rejeição de uma atividade sugerida. Não grava: abre um cartão para a pessoa confirmar.",
    input: z.object({
      estudante: studentRef,
      atividadeId: z.string(),
      decisao: z.enum(["aceitar", "rejeitar"]),
      motivo: z.string().optional().describe("Motivo da rejeição, em poucas palavras"),
    }),
    run: async (ctx, args) => {
      const prisma = await db();
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const activity = await prisma.activity.findFirst({ where: { id: args.atividadeId, studentId: id }, select: { id: true, title: true, status: true } });
      if (!activity) throw new UserError("Atividade não encontrada para este estudante.", "not_found");
      const summary = args.decisao === "aceitar" ? `Aceitar a atividade “${activity.title}” para usar com o estudante.` : `Rejeitar a atividade “${activity.title}”${args.motivo ? ` (motivo: ${args.motivo})` : ""}.`;
      return propose(ctx, "decidir_atividade", summary, { studentId: id, activityId: activity.id, decision: args.decisao === "aceitar" ? "aceita" : "rejeitada", reason: args.motivo ?? null });
    },
  }),
  marcar_objetivo: tool({
    description: "Prepara a mudança de situação de um objetivo (alcançado, em revisão ou ativo). Não grava: abre um cartão para a pessoa confirmar. Só sugira 'alcançado' quando os registros mostrarem.",
    input: z.object({ estudante: studentRef, objetivoId: z.string(), situacao: z.enum(["alcancado", "em_revisao", "ativo"]) }),
    run: async (ctx, args) => {
      const prisma = await db();
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const objective = await prisma.objective.findFirst({ where: { id: args.objetivoId, plan: { studentId: id } }, select: { id: true, description: true } });
      if (!objective) throw new UserError("Objetivo não encontrado para este estudante.", "not_found");
      return propose(ctx, "marcar_objetivo", `Marcar como ${OBJECTIVE_STATUS[args.situacao].label.toLowerCase()} o objetivo: ${objective.description}`, { studentId: id, objectiveId: objective.id, status: args.situacao });
    },
  }),
  buscar_recursos: tool({
    description: "Busca no banco municipal de recursos inclusivos (planos, atividades, CAA, tecnologia assistiva, vídeos de formação, experiências exitosas), com evidências de uso.",
    input: z.object({
      busca: z.string().optional().describe("Palavra ou tema, como 'rotina' ou 'leitura'"),
      etapa: z.string().optional().describe("Etapa de ensino, como 'anos_iniciais'"),
      tipo: z.string().optional().describe("Tipo do recurso, como 'caa' ou 'atividade'"),
    }),
    run: async (ctx, args) => {
      const prisma = await db();
      const resources = await prisma.resource.findMany({
        where: {
          ...(args.busca ? { OR: [{ title: textContains(args.busca) }, { description: textContains(args.busca) }, { skillArea: textContains(args.busca) }] } : {}),
          ...(args.etapa ? { stage: textContains(args.etapa) } : {}),
          ...(args.tipo ? { resourceType: textContains(args.tipo) } : {}),
        },
        orderBy: [{ timesUsed: "desc" }, { title: "asc" }],
        take: 10,
        include: { activities: { select: { title: true, context: true, durationMinutes: true }, orderBy: { position: "asc" } } },
      });
      if (!resources.length) return "Nenhum recurso encontrado. Página do banco: /recursos";
      return resources.map((resource) => `- ${resource.title} (id ${resource.id}, /recursos/${resource.id}): ${resource.description} Etapa: ${resource.stage}; área: ${resource.skillArea}; tipo: ${resource.resourceType}; complexidade: ${resource.complexity}; ${plural(resource.timesUsed, "uso", "usos")}${resource.timesUsed ? `, ${Math.round((resource.positiveOutcomes / resource.timesUsed) * 100)}% com bom resultado` : ""}. Atividades: ${resource.activities.map((activity) => `${activity.title} (${labelOf(CONTEXTS, activity.context)}, ${activity.durationMinutes} min)`).join("; ") || "nenhuma"}.`).join("\n");
    },
  }),
  indicadores: tool({
    description: {
      professor: "Números do painel da escola da pessoa: jornada, avisos, planos, aulas, atividades e uso da IA.",
      escola: NETWORK_PANEL,
      rede: NETWORK_PANEL,
    },
    input: z.object({ escolaId: z.string().optional().describe("Id da escola, para a gestão da rede; vazio para toda a rede") }),
    run: async (ctx, args) => {
      const network = can(ctx.user.role, "management");
      const d = await loadDashboard(ctx.user, { period: "ano", school: network ? args.escolaId : undefined });
      const scope = d.scope.schoolId ? ctx.privacy.schoolLabel(d.scope.schoolId) : "toda a rede";
      return [
        `Painel (${scope}, este ano; página /painel):`,
        `- Estudantes: ${d.overview.students} (${d.overview.withAEE} no AEE); escolas: ${d.overview.schools}; turmas: ${d.overview.classes}.`,
        `- Com plano ativo: ${d.overview.withActivePlan} (${d.overview.planCoverage ?? 0}%). Objetivos em acompanhamento: ${d.overview.activeObjectives}; alcançados: ${d.overview.achievedObjectives}; com redução de apoio: ${d.overview.reducedSupport} de ${d.overview.measurableObjectives}.`,
        `- Registros de aula: ${d.overview.records} (${d.overview.studentsWithRecord} estudantes com registro). Participação plena: ${d.overview.fullParticipationPct ?? 0}%.`,
        `- Avisos: ${d.attention.byKind.map((kind) => `${kind.value} ${kind.label.toLowerCase()}`).join("; ")}. Revisões de plano nos próximos ${d.attention.reviewHorizonDays} dias: ${d.attention.reviewsSoon}.`,
        `- Jornada: ${d.journey.steps.map((step) => `${step.label}: ${step.done} de ${d.overview.students}`).join("; ")}. Conclusão média: ${d.journey.completion ?? 0}%.`,
        `- Atividades no ano: ${d.activities.created} criadas; sugestões aguardando avaliação: ${d.overview.pendingSuggestions}; adesão: ${d.activities.sources.map((source) => `${source.label} ${source.adhesion === null ? "—" : `${source.adhesion}%`}`).join(", ")}.`,
        `- Tendência dos objetivos: ${d.learning.trends.map((trend) => `${trend.label}: ${trend.value}`).join("; ")}.`,
        d.records.strategies.length ? `- Estratégias que mais funcionaram: ${d.records.strategies.map((item) => `${item.label} (${item.value}x)`).join(", ")}.` : "",
        `- IA: ${aiStatusText(d.ai.providers, can(ctx.user.role, "configureAi"))}; planos propostos pela IA: ${d.ai.planProposals.ia}; atividades da IA: ${d.ai.activities.total}; imagens: ${d.ai.images}.`,
        network ? `- Escolas da rede: ${d.scope.schools.map((school) => `${ctx.privacy.schoolLabel(school.id)} (id ${school.id})`).join(", ")}.` : "",
        d.profile.caa.withoutResources ? `- Leitura para a gestão: ${d.profile.caa.withoutResources} de ${d.profile.caa.total} estudantes com comunicação alternativa ainda sem recursos de acessibilidade registrados.` : "",
        d.attention.students.length && can(ctx.user.role, "seeNames") ? `- Estudantes com avisos (no seu escopo): ${d.attention.students.filter((student) => student.alerts.length).slice(0, 15).map((student) => `${ctx.privacy.studentLabel(student.id)} (id ${student.id}): ${student.alerts.map((kind) => ALERTS[kind].label.toLowerCase()).join(", ")}`).join("; ")}.` : "",
      ].filter(Boolean).join("\n");
    },
  }),
  meu_estudante: tool({
    description: {
      familia: "O que a escola está trabalhando com o estudante, as atividades para fazer em casa (com o passo a passo), as conquistas registradas pela escola e o que a família já contou.",
      terapeuta: "Comunicação, interesses e apoios registrados pela escola (perfil funcional) e os relatórios de articulação já enviados. Sem notas, diário ou dados administrativos.",
    },
    input: z.object({}),
    run: {
      familia: async (ctx) => {
        const studentId = ctx.studentIds[0];
        const prisma = await db();
        if (!studentId) return "O acesso ainda não está vinculado a um estudante. Peça à escola para conferir o cadastro.";
        const s = await prisma.student.findUniqueOrThrow({
          where: { id: studentId },
          include: {
            plans: { where: { status: "ativo" }, include: { objectives: { where: { status: "ativo" } } } },
            activities: { where: familyActivityWhere, orderBy: { createdAt: "desc" }, take: 5 },
            timeline: { where: { type: "conquista" }, orderBy: { date: "desc" }, take: 5 },
            familyNotes: { orderBy: { date: "desc" }, take: 5 },
          },
        });
        const label = ctx.privacy.studentLabel(studentId);
        const objectives = s.plans.flatMap((plan) => plan.objectives);
        return [
          `# ${label} (página: /familia/${studentId})`,
          `## O que a escola está trabalhando\n${objectives.map((objective) => `- ${withoutCodes(objective.description)}`).join("\n") || "A escola ainda está montando o plano."}`,
          `## Atividades para fazer em casa\n${s.activities.map((a) => `- ${withoutCodes(a.title)} (${a.durationMinutes} min). Materiais: ${readList(a.materials).join(", ")}. Passos: ${readList(a.steps).map((step, index) => `${index + 1}. ${withoutCodes(step)}`).join(" ")} Se não der certo: ${withoutCodes(a.planB)}`).join("\n") || "A escola ainda não enviou atividades para casa."}`,
          `## Conquistas registradas pela escola\n${s.timeline.map((event) => `- ${withoutCodes(event.title)}${event.description ? `: ${withoutCodes(event.description)}` : ""} (${formatDate(event.date)})`).join("\n") || "Nenhuma ainda."}`,
          `## O que a família já contou\n${s.familyNotes.map((note) => `- "${note.note}" (${note.author}, ${formatDate(note.date)})${isHomeActivityNote(note.note) ? " [atividade feita em casa]" : ""}`).join("\n") || "Nenhuma observação ainda."}`,
        ].join("\n\n");
      },
      terapeuta: async (ctx) => {
        const studentId = ctx.studentIds[0];
        const prisma = await db();
        if (!studentId) return "O acesso ainda não está vinculado a um estudante. Peça à escola para conferir o cadastro.";
        const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { profile: true, intersectorReports: { orderBy: { createdAt: "desc" }, take: 3 } } });
        return [
          `# ${ctx.privacy.studentLabel(studentId)} (página: /terapeuta)`,
          `${s.gradeYear}, ${STAGES[s.stage] ?? s.stage}.`,
          `## Como aprende (registrado pela escola)\n${s.profile ? profileText(s.profile) : "A escola ainda não preencheu o perfil."}`,
          `## Relatórios enviados\n${s.intersectorReports.map((report) => `- ${formatDate(report.createdAt)}: comunicação: ${report.communication}; recursos: ${report.accessResources}; estratégias: ${report.strategiesToTry}; orientações: ${report.schoolGuidance}; objetivos compartilhados: ${report.sharedGoals}.`).join("\n") || "Nenhum relatório ainda."}`,
        ].join("\n\n");
      },
    },
  }),
  contar_conquista: tool({
    description: "Prepara o envio de uma conquista observada em casa para a equipe da escola. Não envia: abre um cartão para a família confirmar.",
    input: z.object({ texto: z.string().describe("O que o estudante conseguiu fazer, com as palavras da família"), quem: z.string().optional().describe("Quem observou, como 'mãe' ou 'avó'") }),
    run: async (ctx, args) => {
      const studentId = ctx.studentIds[0];
      if (!studentId) throw new UserError("O acesso ainda não está vinculado a um estudante.");
      if (!args.texto.trim()) throw new UserError("Escreva o que aconteceu.");
      return propose(ctx, "contar_conquista", `Contar para a escola: “${args.texto.trim()}”${args.quem ? ` (observado por ${args.quem})` : ""}.`, { studentId, note: args.texto.trim(), author: args.quem?.trim() || "Família" });
    },
  }),
  enviar_orientacoes: tool({
    description: "Prepara um relatório de articulação intersetorial para a escola, só com informações funcionais. Não envia: abre um cartão para o terapeuta confirmar. Reúna os campos obrigatórios antes de chamar.",
    input: z.object({
      comunicacao: z.string().describe("Formas de comunicação mais eficazes"),
      recursos: z.string().describe("Recursos de acessibilidade utilizados"),
      posicionamento: z.string().optional().describe("Necessidades de posicionamento ou mobilidade"),
      facilitadores: z.string().describe("Fatores que facilitam a participação"),
      estrategias: z.string().describe("Estratégias que a escola pode testar"),
      orientacoes: z.string().describe("Orientações aplicáveis ao ambiente escolar"),
      objetivosCompartilhados: z.string().describe("Objetivos compartilhados entre escola e família"),
    }),
    run: async (ctx, args) => {
      const studentId = ctx.studentIds[0];
      if (!studentId) throw new UserError("O acesso ainda não está vinculado a um estudante.");
      const summary = `Enviar orientações à escola: comunicação: ${args.comunicacao}; recursos: ${args.recursos}; ${args.posicionamento ? `posicionamento: ${args.posicionamento}; ` : ""}facilitadores: ${args.facilitadores}; estratégias: ${args.estrategias}; orientações: ${args.orientacoes}; objetivos compartilhados: ${args.objetivosCompartilhados}.`;
      return propose(ctx, "enviar_orientacoes", summary, {
        studentId, communication: args.comunicacao, accessResources: args.recursos, positioning: args.posicionamento ?? null,
        facilitators: args.facilitadores, schoolGuidance: args.orientacoes, strategiesToTry: args.estrategias, sharedGoals: args.objetivosCompartilhados,
      });
    },
  }),
  datas_inclusivas: tool({
    description: "Próximas datas comemorativas do público do AEE (autismo, Libras, braille, síndrome de Down, pessoa com deficiência...), com a ideia de atividade para a turma toda.",
    input: z.object({ dias: z.number().int().min(7).max(366).optional().describe("Horizonte em dias; padrão 60") }),
    run: async (ctx, args) => {
      const today = brYmd();
      const events = upcomingEvents(today, args.dias ?? 60);
      if (!events.length) return "Nenhuma data comemorativa no período. Calendário: /calendario";
      return `Hoje é ${String(today.day).padStart(2, "0")}/${String(today.month).padStart(2, "0")}/${today.year}. Próximas datas (calendário em /calendario):\n` + events.slice(0, 12).map((event) => `- ${event.entry.title}, ${dateRangeLabel(event)} (${relativeLabel(event, today).toLowerCase()}), tema ${CALENDAR_THEMES[event.entry.theme].label}. ${event.entry.about} Ideia para a turma: ${event.entry.idea} Origem: ${event.entry.origin}`).join("\n");
    },
  }),
};

export function buildTools(context: Omit<ToolContext, "group">): BetaRunnableTool[] {
  const ctx: ToolContext = { ...context, group: roleGroup(context.user.role) };
  return toolNames(ctx.group).map((name) => TOOLS[name](ctx, name));
}

type Performer<K extends ProposalKind> = (user: SessionUser, args: ProposalArgs<K>) => Promise<string>;

const PERFORMERS: { [K in ProposalKind]: Performer<K> } = {
  registrar_aula: async (user, args) => {
    await saveDiaryEntry(user, args.studentId, args);
    return `Registro da aula salvo. Veja em [Registro](/estudantes/${args.studentId}/diario).`;
  },
  decidir_atividade: async (user, args) => {
    const activity = await decideActivity(user, args.studentId, args.activityId, args.decision, args.reason);
    return args.decision === "aceita"
      ? `Atividade “${activity.title}” aceita. Veja em [Atividades](/estudantes/${args.studentId}/atividades).`
      : `Atividade “${activity.title}” rejeitada. O motivo ajuda a melhorar as sugestões.`;
  },
  marcar_objetivo: async (user, args) => {
    await setObjectiveStatus(user, args.studentId, args.objectiveId, args.status);
    return `Objetivo marcado como ${OBJECTIVE_STATUS[args.status].label.toLowerCase()}. Veja em [Plano](/estudantes/${args.studentId}/ppi).`;
  },
  contar_conquista: async (user, args) => {
    await saveFamilyNote(user, args.studentId, args.note, args.author);
    return `Conquista enviada para a equipe da escola. Veja em [Acompanhamento](/familia/${args.studentId}).`;
  },
  enviar_orientacoes: async (user, { studentId, ...report }) => {
    await saveIntersectorReport(user, studentId, report);
    return "Relatório enviado para a equipe escolar. Veja em [Orientações](/terapeuta#relatorios).";
  },
};

function perform<K extends ProposalKind>(user: SessionUser, kind: K, stored: string): Promise<string> {
  return PERFORMERS[kind](user, readProposalArgs(kind, stored));
}

export async function executeAction(user: SessionUser, actionId: string, decision: "confirmar" | "cancelar"): Promise<{ action: ActionView; error?: string }> {
  const prisma = await db();
  const action = await prisma.assistantAction.findFirst({ where: { id: actionId, conversation: { userId: user.id } } });
  if (!action) throw new UserError("Ação não encontrada.", "not_found");
  if (action.status !== "pendente") return { action: toActionView(action) };

  if (decision === "cancelar") {
    const cancelled = await prisma.assistantAction.update({ where: { id: action.id }, data: { status: "cancelada", decidedAt: new Date(), result: null } });
    return { action: toActionView(cancelled) };
  }

  try {
    if (!isProposalKind(action.kind)) throw new Error(`Tipo de ação desconhecido: ${action.kind}`);
    const result = await perform(user, action.kind, action.args);
    const confirmed = await prisma.assistantAction.update({ where: { id: action.id }, data: { status: "confirmada", decidedAt: new Date(), result } });
    return { action: toActionView(confirmed) };
  } catch (error) {
    if (!(error instanceof UserError)) console.error("[assistente] ação falhou:", error);
    return { action: toActionView(action), error: error instanceof UserError ? error.message : "Não foi possível executar a ação." };
  }
}
