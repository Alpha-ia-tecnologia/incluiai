import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { prisma } from "../prisma";
import { canSeePedagogicalDetail, isNetworkRole, isStaffOrNetwork, type SessionUser } from "../auth";
import { loadPlanContext, profileText } from "../agents/context";
import { buildActivityCards, createPlanDraft, saveSuggestedActivities } from "../agents/generate";
import { objectiveTrend, studentAlerts } from "../insights";
import { getStudentNextStep } from "../student-journey";
import { assertStudentTeam } from "../records";
import { buildMaterial, MATERIAL_KINDS, type MaterialKind } from "../materials";
import { isImageGenerationEnabled } from "../images/openai-images";
import { createActivityImage } from "../images/save";
import { ALERT_LABELS, TREND_LABELS, loadDashboard } from "../dashboard";
import { CALENDAR_THEMES, dateRangeLabel, relativeLabel, todayInBrazil, upcomingEvents } from "../commemorative-dates";
import { ACTIVITY_STATUS, CONTEXTS, DIMENSIONS, SHIFTS, STAGES, supportInfo } from "../scale";
import { ageFrom, formatDate, parseJson } from "../format";
import { isHomeActivityNote } from "../user-journey";
import { studentFollowUp } from "../dua/applications";
import type { Pseudonymizer } from "./privacy";
import { toActionView } from "./store";
import { TOOL_LABELS } from "./labels";
import type { AgentProgress, AssistantEvent } from "./types";

// Ferramentas do assistente. Cada uma confere a permissão da pessoa de novo
// (o modelo só pede; quem autoriza é o servidor), devolve texto já com
// pseudônimos no lugar dos nomes e, quando altera o acompanhamento, prepara
// um cartão de confirmação em vez de gravar.

export type ToolContext = {
  user: SessionUser;
  privacy: Pseudonymizer;
  studentIds: string[];
  conversationId: string;
  emit: (event: AssistantEvent) => void;
};


const support = (level: number) => `${level} (${supportInfo(level).code}, ${supportInfo(level).description.toLowerCase()})`;
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const studentRef = z.string().describe("Marcador do estudante, como [ESTUDANTE 1], ou o id dele");

// `report` avisa a tela quando cada agente de uma ferramenta longa começa e termina.
type Report = (progress: AgentProgress) => void;

function define<Schema extends z.ZodType>(ctx: ToolContext, name: string, description: string, inputSchema: Schema, run: (args: z.infer<Schema>, report: Report) => Promise<string>): BetaRunnableTool {
  const label = TOOL_LABELS[name] ?? name;
  return betaZodTool({
    name,
    description,
    inputSchema,
    run: async (args, context) => {
      const id = context?.toolUse.id ?? name;
      const report: Report = (progress) => ctx.emit({ type: "tool_progress", id, progress });
      try {
        const text = await run(args, report);
        ctx.emit({ type: "tool_end", step: { id, name, label, ok: true } });
        return ctx.privacy.apply(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[assistente] ferramenta ${name} falhou:`, error);
        ctx.emit({ type: "tool_end", step: { id, name, label, ok: false, summary: message } });
        return `Erro: ${ctx.privacy.apply(message)}`;
      }
    },
  });
}

// O modelo se refere ao estudante pelo marcador ([ESTUDANTE 1]) ou pelo id;
// um nome escrito por engano ainda é aceito se for único no escopo.
async function resolveStudentId(ctx: ToolContext, ref: string): Promise<string> {
  const label = ref.match(/ESTUDANTE\s*(\d+)/i);
  if (label) {
    const number = Number(label[1]);
    const id = Object.entries(ctx.privacy.map.students).find(([, value]) => value === number)?.[0];
    if (id && ctx.studentIds.includes(id)) return id;
    throw new Error("Estudante não encontrado no seu escopo. Use buscar_estudantes para ver a lista.");
  }
  const trimmed = ref.trim();
  if (ctx.studentIds.includes(trimmed)) return trimmed;
  const students = await prisma.student.findMany({ where: { id: { in: ctx.studentIds } }, select: { id: true, name: true } });
  const matches = students.filter((student) => normalize(student.name).includes(normalize(trimmed)));
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) throw new Error(`Mais de um estudante corresponde: ${matches.map((student) => ctx.privacy.studentLabel(student.id)).join(", ")}. Use o id.`);
  throw new Error("Estudante não encontrado. Use buscar_estudantes para ver a lista.");
}

async function logAccess(ctx: ToolContext, studentId: string, detail: string) {
  await prisma.accessLog.create({ data: { studentId, actor: ctx.user.name, role: ctx.user.role, action: "visualizou", detail } });
}

async function propose(ctx: ToolContext, kind: string, summary: string, args: Record<string, unknown>): Promise<string> {
  const action = await prisma.assistantAction.create({ data: { conversationId: ctx.conversationId, kind, summary, args: JSON.stringify(args) } });
  ctx.emit({ type: "action", action: toActionView(action) });
  return `Cartão de confirmação preparado (ação ${kind}). Nada foi gravado ainda: a pessoa precisa confirmar no cartão que apareceu na tela. Diga isso em uma frase e não chame esta ferramenta de novo para o mesmo pedido.`;
}

const journeyInput = (student: {
  id: string;
  caseStudy: { status: string } | null;
  profile: unknown | null;
  plans: { objectives: { id: string }[] }[];
  activities: { id: string }[];
  diaryEntries: { id: string }[];
}) => getStudentNextStep({
  id: student.id,
  caseStudy: (student.caseStudy?.status as "rascunho" | "concluido" | undefined) ?? null,
  hasProfile: !!student.profile,
  hasPlan: student.plans.length > 0,
  hasObjective: student.plans.some((plan) => plan.objectives.length > 0),
  hasPreparedActivity: student.activities.length > 0,
  hasDiary: student.diaryEntries.length > 0,
});

// ---------------------------------------------------------------------------
// Equipe escolar e gestão
// ---------------------------------------------------------------------------
function staffTools(ctx: ToolContext): BetaRunnableTool[] {
  const network = isNetworkRole(ctx.user.role);

  const buscarEstudantes = define(ctx, "buscar_estudantes",
    "Lista os estudantes que a pessoa pode acompanhar, com marcador, id, turma, escola e próximo passo da jornada. Filtros opcionais por texto e por turma.",
    z.object({
      busca: z.string().optional().describe("Marcador, id ou parte do nome digitado pela pessoa"),
      turma: z.string().optional().describe("Parte do nome da turma, como 'Turma B'"),
    }),
    async (args) => {
      const students = await prisma.student.findMany({
        where: { id: { in: ctx.studentIds }, ...(args.turma ? { className: { contains: args.turma } } : {}) },
        orderBy: { name: "asc" },
        include: {
          caseStudy: { select: { status: true } },
          profile: { select: { id: true } },
          plans: { where: { status: "ativo" }, select: { objectives: { where: { status: "ativo" }, select: { id: true }, take: 1 } } },
          activities: { where: { status: { in: ["aceita", "aplicada"] } }, select: { id: true }, take: 1 },
          diaryEntries: { orderBy: { date: "desc" }, select: { id: true, date: true }, take: 1 },
        },
      });
      let list = students;
      if (args.busca) {
        const label = args.busca.match(/ESTUDANTE\s*(\d+)/i);
        if (label) list = students.filter((student) => ctx.privacy.map.students[student.id] === Number(label[1]));
        else list = students.filter((student) => student.id === args.busca || normalize(student.name).includes(normalize(args.busca!)));
      }
      if (!list.length) return "Nenhum estudante encontrado com esse filtro.";
      const lines = list.slice(0, 60).map((student) => {
        const next = journeyInput(student);
        return `- ${ctx.privacy.studentLabel(student.id)} (id ${student.id}): ${student.gradeYear}, ${student.className}, ${SHIFTS[student.shift] ?? student.shift}, ${ctx.privacy.schoolLabel(student.schoolId)}; AEE: ${student.hasAEE ? "sim" : "não"}; próximo passo: ${next.label} (${next.href}); último registro de aula: ${student.diaryEntries[0] ? formatDate(student.diaryEntries[0].date) : "nenhum"}.`;
      });
      return `${plural(list.length, "estudante", "estudantes")}${list.length > 60 ? " (mostrando 60)" : ""}:\n${lines.join("\n")}`;
    });

  const verEstudante = define(ctx, "ver_estudante",
    "Resumo completo de um estudante: jornada e próximo passo, avisos, plano e objetivos (com ids e tendência), como aprende, registros de aula, atividades, família e orientações da saúde. Consulte antes de responder sobre um estudante.",
    z.object({ estudante: studentRef }),
    async (args) => {
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
      await logAccess(ctx, id, "Assistente: resumo do estudante");
      const { text } = await loadPlanContext(id);
      const label = ctx.privacy.studentLabel(id);
      const activePlan = s.plans.find((plan) => plan.status === "ativo");
      const next = journeyInput({ ...s, plans: activePlan ? [{ objectives: activePlan.objectives.filter((o) => o.status === "ativo") }] : [], activities: s.activities.filter((a) => a.status === "aceita" || a.status === "aplicada") });
      const alerts = studentAlerts({ plans: s.plans, entries: s.diaryEntries });
      const counts = Object.fromEntries(Object.keys(ACTIVITY_STATUS).map((status) => [status, s.activities.filter((a) => a.status === status).length]));
      const health = s.intersectorReports[0];
      const sections = [
        `# ${label} (id ${id})`,
        `${s.gradeYear}, ${s.className}, ${SHIFTS[s.shift] ?? s.shift}, ${ctx.privacy.schoolLabel(s.schoolId)}. ${ageFrom(s.birthDate)} anos, ${STAGES[s.stage] ?? s.stage}. AEE: ${s.hasAEE ? `sim${s.aeeFrequency ? ` (${s.aeeFrequency})` : ""}` : "não"}. Profissional de apoio: ${s.supportProfessional ? "sim" : "não"}.${s.accessibilityNotes ? ` Recursos de acessibilidade: ${s.accessibilityNotes}.` : ""}`,
        `Páginas: resumo /estudantes/${id} · estudo de caso /estudantes/${id}/estudo-de-caso · como aprende /estudantes/${id}/perfil · plano /estudantes/${id}/ppi · atividades /estudantes/${id}/atividades · materiais /estudantes/${id}/materiais · registrar aula /estudantes/${id}/diario · evolução /estudantes/${id}/linha-do-tempo`,
        `\n## Jornada\nPróximo passo sugerido: ${next.label} (${next.href}). Estudo de caso: ${s.caseStudy?.status === "concluido" ? "concluído" : s.caseStudy ? "em rascunho" : "não feito"}. Como aprende: ${s.profile ? "preenchido" : "não preenchido"}. Plano ativo: ${activePlan ? "sim" : "não"}. Atividades preparadas: ${counts.aceita + counts.aplicada}. Registros de aula: ${s.diaryEntries.length}.`,
        alerts.length ? `Avisos: ${alerts.map((alert) => alert.message).join(" ")}` : "Avisos: nenhum.",
        activePlan
          ? `\n## Plano ativo (revisão em ${formatDate(activePlan.reviewDate)})\n${activePlan.objectives.map((objective) => {
            const insight = objectiveTrend(objective, s.diaryEntries);
            return `- Objetivo (id ${objective.id}, ${DIMENSIONS[objective.dimension] ?? objective.dimension}, ${objective.status === "alcancado" ? "alcançado" : objective.status === "em_revisao" ? "em revisão" : "ativo"}): ${objective.description} Apoio atual ${support(objective.currentSupport)} → esperado ${support(objective.targetSupport)}. Tendência: ${TREND_LABELS[insight.trend]}. ${insight.message}${insight.lastSupportLevels.length ? ` Últimos níveis de apoio: ${insight.lastSupportLevels.join(" → ")}.` : ""}`;
          }).join("\n") || "Sem objetivos."}`
          : "\n## Plano\nSem plano ativo.",
        s.planDraft ? `Há uma proposta de plano aguardando revisão (${s.planDraft.source === "ia" ? "agentes de IA" : "motor de regras"}, ${formatDate(s.planDraft.createdAt)}) em /estudantes/${id}/ppi#proposta.` : "",
        `\n${text}`,
        `\n## Atividades (${Object.entries(counts).map(([status, total]) => `${total} ${ACTIVITY_STATUS[status].toLowerCase()}`).join(", ")})\n${s.activities.slice(0, 8).map((a) => `- (id ${a.id}) ${a.title}: ${CONTEXTS[a.context] ?? a.context}, ${ACTIVITY_STATUS[a.status] ?? a.status}, ${a.durationMinutes} min${a.objectiveId ? `, objetivo ${a.objectiveId}` : ""}`).join("\n") || "Nenhuma atividade ainda."}`,
        s.materials.length ? `Materiais acessíveis: ${s.materials.map((m) => m.title).join("; ")}.` : "Materiais acessíveis: nenhum.",
        `\n## A família observou\n${s.familyNotes.map((note) => `- "${note.note}" (${formatDate(note.date)})`).join("\n") || "Nenhuma observação da família ainda."}`,
        health ? `\n## Orientações da saúde (${formatDate(health.createdAt)})\nComunicação eficaz: ${health.communication}. Recursos: ${health.accessResources}. Estratégias a testar: ${health.strategiesToTry}. Orientações à escola: ${health.schoolGuidance}. Objetivos compartilhados: ${health.sharedGoals}.` : "",
      ];
      return sections.filter(Boolean).join("\n");
    });

  const verAtividades = define(ctx, "ver_atividades",
    "Atividades de um estudante com passos, materiais, forma de resposta e critério de sucesso. Útil para orientar a aula de hoje ou avaliar sugestões.",
    z.object({
      estudante: studentRef,
      situacao: z.enum(["sugerida", "aceita", "aplicada", "rejeitada", "todas"]).optional().describe("Filtra pela situação; padrão: todas"),
      limite: z.number().int().min(1).max(20).optional(),
    }),
    async (args) => {
      const id = await resolveStudentId(ctx, args.estudante);
      const activities = await prisma.activity.findMany({
        where: { studentId: id, ...(args.situacao && args.situacao !== "todas" ? { status: args.situacao } : {}) },
        orderBy: { createdAt: "desc" },
        take: args.limite ?? 8,
        include: { objective: { select: { id: true, action: true } }, image: { select: { kind: true } } },
      });
      if (!activities.length) return `Nenhuma atividade ${args.situacao && args.situacao !== "todas" ? `com situação "${args.situacao}" ` : ""}para ${ctx.privacy.studentLabel(id)}. Página: /estudantes/${id}/atividades`;
      return activities.map((a) => [
        `### ${a.title} (id ${a.id}) · ${CONTEXTS[a.context] ?? a.context} · ${ACTIVITY_STATUS[a.status] ?? a.status} · ${a.durationMinutes} min · origem: ${a.source}`,
        a.objective ? `Objetivo (id ${a.objective.id}): ${a.objective.action}` : "",
        `Materiais: ${parseJson<string[]>(a.materials, []).join(", ") || "nenhum"}`,
        `Passos: ${parseJson<string[]>(a.steps, []).map((step, index) => `${index + 1}. ${step}`).join(" ")}`,
        `Resposta aceita: ${a.responseForm}. Critério de sucesso: ${a.successCriterion}.`,
        `Escada de apoio: mais apoio: ${a.supportBelow} | alvo: ${a.supportTarget} | menos apoio: ${a.supportAbove}.`,
        `Plano B: ${a.planB}.`,
        a.classParticipation ? `Como a turma participa: ${a.classParticipation}` : "",
        a.rejectReason ? `Motivo da rejeição: ${a.rejectReason}` : "",
        a.image ? "Tem imagem de apoio gerada." : "",
      ].filter(Boolean).join("\n")).join("\n\n") + `\n\nPágina: /estudantes/${id}/atividades`;
    });

  // Próximos passos do DUA (RF08), só leitura: saem das evidências registradas nas
  // atividades com DUA. São recomendações; a decisão e o resultado ficam com a equipe.
  const proximosPassosDua = define(ctx, "proximos_passos_dua",
    "Próximos passos sugeridos para um estudante a partir das evidências das atividades planejadas com DUA. Cada sugestão traz a base usada e o que ainda precisa ser observado. São recomendações para a equipe revisar: não são decisão profissional nem resultado observado.",
    z.object({ estudante: studentRef }),
    async (args) => {
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      // studentFollowUp confere de novo o recorte do estudante (equipe pedagógica com acesso).
      const suggestions = await studentFollowUp(ctx.user, id);
      await logAccess(ctx, id, "Assistente: próximos passos das atividades com DUA");
      const label = ctx.privacy.studentLabel(id);
      const notice = "Recomendações para a equipe revisar. Recomendação não é decisão profissional, e decisão não é resultado observado: a equipe decide o que fazer, e o resultado só existe quando for observado e registrado.";
      const page = `Página: /estudantes/${id}/dua (atividades com DUA do estudante)`;
      if (!suggestions.length) {
        return `Nenhum próximo passo sugerido para ${label} nas atividades com DUA: ainda não há evidência registrada, ou os registros não apontam o que retomar. Não conclua nada sobre a aprendizagem a partir disso.\n${notice}\n${page}`;
      }
      return [
        `# Próximos passos sugeridos para ${label} (atividades com DUA)`,
        notice,
        ...suggestions.map((item, index) => `${index + 1}. ${item.text}\n   Base usada: ${item.basis}\n   O que ainda precisa ser observado: ${item.pending}`),
        page,
      ].join("\n");
    });

  const proporPlano = define(ctx, "propor_plano",
    "Pede aos agentes de IA uma proposta de plano (PPI) para o estudante, a partir do estudo de caso e de como aprende. Demora de 1 a 3 minutos e tem custo; chame só quando a pessoa pedir claramente. A proposta fica aguardando revisão em /estudantes/ID/ppi#proposta.",
    z.object({ estudante: studentRef }),
    async (args, report) => {
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const { proposal, source, trace } = await createPlanDraft(id, ctx.user, report);
      revalidatePath(`/estudantes/${id}/ppi`);
      return [
        `Proposta pronta (${source === "ia" ? "agentes de IA" : "motor de regras"}). Trilha: ${trace.map((step) => step.agent).join(" → ")}.`,
        `Revisão sugerida em ${proposal.reviewWeeks} semanas. O estudante já consegue: ${proposal.initialSituation.join("; ")}.`,
        `Objetivos propostos:\n${proposal.objectives.map((objective, index) => `${index + 1}. [${DIMENSIONS[objective.dimension] ?? objective.dimension}] ${objective.action}, ${objective.condition}, em ${objective.criterion}, em ${objective.deadlineWeeks} semanas (apoio ${objective.currentSupport} → ${objective.targetSupport}). Por quê: ${objective.rationale}`).join("\n")}`,
        `Estratégias para a sala comum: ${proposal.commonRoomStrategies.join("; ")}.`,
        `A pessoa revisa, escolhe os objetivos e ativa o plano em /estudantes/${id}/ppi#proposta.`,
      ].join("\n");
    });

  const gerarAtividades = define(ctx, "gerar_atividades",
    "Cria 3 sugestões de atividade (sala comum, AEE e casa) para um objetivo e um conteúdo da aula da turma. Demora de 1 a 3 minutos (com imagens, cerca de 1 minuto a mais) e tem custo. As sugestões ficam aguardando a decisão da pessoa em /estudantes/ID/atividades.",
    z.object({
      estudante: studentRef,
      objetivoId: z.string().describe("Id do objetivo ativo (do resumo do estudante)"),
      conteudoDaAula: z.string().describe("O que a turma vai trabalhar na aula, como 'chamada com os nomes' ou 'contagem até 10'"),
      comImagens: z.boolean().optional().describe("Gerar também imagens de apoio (pictogramas) para cada atividade"),
    }),
    async (args, report) => {
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const student = await prisma.student.findUniqueOrThrow({ where: { id } });
      const profile = await prisma.functionalProfile.findUnique({ where: { studentId: id } });
      if (!profile) throw new Error(`Preencha Como aprende antes de gerar atividades: /estudantes/${id}/perfil`);
      const objective = await prisma.objective.findFirst({ where: { id: args.objetivoId, plan: { studentId: id } } });
      if (!objective) throw new Error("Objetivo não encontrado para este estudante. Consulte ver_estudante para os ids.");
      const withImages = Boolean(args.comImagens) && isImageGenerationEnabled();
      // Avisa logo no início que haverá imagens: a tela conta 4 minutos em vez de 3.
      if (withImages) report({ agent: "Ilustração", phase: "queued" });
      const cards = await buildActivityCards({ student, profile, objective, lessonTopic: args.conteudoDaAula }, report);
      const created = await saveSuggestedActivities(id, objective.id, cards);
      let images = "";
      if (withImages) {
        report({ agent: "Ilustração", phase: "start" });
        const results = await Promise.allSettled(created.map((activity) => createActivityImage(activity.id, "sequencia", ctx.user)));
        report({ agent: "Ilustração", phase: "end" });
        const ok = results.filter((result) => result.status === "fulfilled").length;
        images = ` Imagens de apoio geradas: ${ok} de ${created.length}.`;
      }
      revalidatePath("/estudantes/[id]", "layout");
      return [
        `3 sugestões criadas (origem: ${cards[0]?.source === "ia" ? "agentes de IA" : "motor de regras"}) e aguardando a decisão da pessoa em /estudantes/${id}/atividades.${images}`,
        ...cards.map((card, index) => [
          `### ${card.title} (id ${created[index]?.id}) · ${CONTEXTS[card.context]} · ${card.durationMinutes} min`,
          `Materiais: ${card.materials.join(", ")}`,
          `Passos: ${card.steps.map((step, i) => `${i + 1}. ${step}`).join(" ")}`,
          `Critério de sucesso: ${card.successCriterion}. Plano B: ${card.planB}`,
          card.classParticipation ? `Como a turma participa: ${card.classParticipation}` : "",
          card.reviewNotes?.length ? `Pontos para a pessoa conferir: ${card.reviewNotes.join("; ")}` : "",
        ].filter(Boolean).join("\n")),
      ].join("\n\n");
    });

  const criarMaterial = define(ctx, "criar_material",
    "Gera um material acessível a partir do perfil do estudante: rotina visual, história social ou prancha de comunicação. Fica em /estudantes/ID/materiais, pronto para imprimir.",
    z.object({ estudante: studentRef, tipo: z.enum(["rotina_visual", "historia_social", "prancha_caa"]) }),
    async (args) => {
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const student = await prisma.student.findUniqueOrThrow({ where: { id } });
      const profile = await prisma.functionalProfile.findUnique({ where: { studentId: id } });
      if (!profile) throw new Error(`Preencha Como aprende antes de gerar materiais: /estudantes/${id}/perfil`);
      const { title, content } = buildMaterial(args.tipo as MaterialKind, student, profile);
      await prisma.material.create({ data: { studentId: id, kind: args.tipo, title, content: JSON.stringify(content), source: "regras" } });
      await prisma.timelineEvent.create({ data: { studentId: id, type: "recurso", title: `Material acessível gerado: ${title}` } });
      revalidatePath(`/estudantes/${id}/materiais`);
      const kind = MATERIAL_KINDS.find((item) => item.kind === args.tipo);
      return `${kind?.label ?? args.tipo} criado: "${title}". ${content.intro} Cartões: ${content.cards.map((card) => card.label).join(", ")}. Imprimível em /estudantes/${id}/materiais.`;
    });

  const registrarAula = define(ctx, "registrar_aula",
    "Prepara o registro de uma aula em 3 toques (participação, apoio e critério), com observação opcional. Não grava: abre um cartão para a pessoa confirmar. Reúna os três toques antes de chamar.",
    z.object({
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
    async (args) => {
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const student = await prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true } });
      const objective = args.objetivoId ? await prisma.objective.findFirst({ where: { id: args.objetivoId, plan: { studentId: id } }, select: { id: true, action: true } }) : null;
      if (args.objetivoId && !objective) throw new Error("Objetivo não encontrado para este estudante.");
      const activity = args.atividadeId ? await prisma.activity.findFirst({ where: { id: args.atividadeId, studentId: id }, select: { id: true, title: true } }) : null;
      if (args.atividadeId && !activity) throw new Error("Atividade não encontrada para este estudante.");
      const participation = { total: "participou de toda a atividade", parcial: "participou de parte", recusou: "recusou" }[args.participacao];
      const criterion = { sim: "atingiu o critério", parcial: "atingiu parcialmente", nao: "não atingiu o critério" }[args.criterio];
      const authorRole = ["professor_sala", "professor_aee", "apoio"].includes(ctx.user.role) ? ctx.user.role : ctx.user.role;
      const summary = `Registrar a aula de ${student.name}: ${participation}, apoio ${support(args.apoio)}, ${criterion}.${objective ? ` Objetivo: ${objective.action}.` : ""}${activity ? ` Atividade: ${activity.title} (passa a aplicada).` : ""}${args.observacao ? ` Observação: ${args.observacao}` : ""}`;
      return propose(ctx, "registrar_aula", summary, {
        studentId: id, objectiveId: objective?.id ?? null, activityId: activity?.id ?? null,
        participation: args.participacao, supportLevel: args.apoio, criterionMet: args.criterio,
        note: args.observacao ?? null, whatWorked: args.oQueAjudou ?? null, recommendation: args.proximoPasso ?? null, authorRole,
      });
    });

  const decidirAtividade = define(ctx, "decidir_atividade",
    "Prepara a aceitação ou a rejeição de uma atividade sugerida. Não grava: abre um cartão para a pessoa confirmar.",
    z.object({
      estudante: studentRef,
      atividadeId: z.string(),
      decisao: z.enum(["aceitar", "rejeitar"]),
      motivo: z.string().optional().describe("Motivo da rejeição, em poucas palavras"),
    }),
    async (args) => {
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const activity = await prisma.activity.findFirst({ where: { id: args.atividadeId, studentId: id }, select: { id: true, title: true, status: true } });
      if (!activity) throw new Error("Atividade não encontrada para este estudante.");
      const summary = args.decisao === "aceitar" ? `Aceitar a atividade “${activity.title}” para usar com o estudante.` : `Rejeitar a atividade “${activity.title}”${args.motivo ? ` (motivo: ${args.motivo})` : ""}.`;
      return propose(ctx, "decidir_atividade", summary, { studentId: id, activityId: activity.id, decision: args.decisao === "aceitar" ? "aceita" : "rejeitada", reason: args.motivo ?? null });
    });

  const marcarObjetivo = define(ctx, "marcar_objetivo",
    "Prepara a mudança de situação de um objetivo (alcançado, em revisão ou ativo). Não grava: abre um cartão para a pessoa confirmar. Só sugira 'alcançado' quando os registros mostrarem.",
    z.object({ estudante: studentRef, objetivoId: z.string(), situacao: z.enum(["alcancado", "em_revisao", "ativo"]) }),
    async (args) => {
      const id = await resolveStudentId(ctx, args.estudante);
      await assertStudentTeam(ctx.user, id);
      const objective = await prisma.objective.findFirst({ where: { id: args.objetivoId, plan: { studentId: id } }, select: { id: true, description: true } });
      if (!objective) throw new Error("Objetivo não encontrado para este estudante.");
      const label = { alcancado: "alcançado", em_revisao: "em revisão", ativo: "ativo" }[args.situacao];
      return propose(ctx, "marcar_objetivo", `Marcar como ${label} o objetivo: ${objective.description}`, { studentId: id, objectiveId: objective.id, status: args.situacao });
    });

  const buscarRecursos = define(ctx, "buscar_recursos",
    "Busca no banco municipal de recursos inclusivos (planos, atividades, CAA, tecnologia assistiva, vídeos de formação, experiências exitosas), com evidências de uso.",
    z.object({
      busca: z.string().optional().describe("Palavra ou tema, como 'rotina' ou 'leitura'"),
      etapa: z.string().optional().describe("Etapa de ensino, como 'anos_iniciais'"),
      tipo: z.string().optional().describe("Tipo do recurso, como 'caa' ou 'atividade'"),
    }),
    async (args) => {
      const resources = await prisma.resource.findMany({
        where: {
          ...(args.busca ? { OR: [{ title: { contains: args.busca } }, { description: { contains: args.busca } }, { skillArea: { contains: args.busca } }] } : {}),
          ...(args.etapa ? { stage: { contains: args.etapa } } : {}),
          ...(args.tipo ? { resourceType: { contains: args.tipo } } : {}),
        },
        orderBy: [{ timesUsed: "desc" }, { title: "asc" }],
        take: 10,
        include: { activities: { select: { title: true, context: true, durationMinutes: true }, orderBy: { position: "asc" } } },
      });
      if (!resources.length) return "Nenhum recurso encontrado. Página do banco: /recursos";
      return resources.map((resource) => `- ${resource.title} (id ${resource.id}, /recursos/${resource.id}): ${resource.description} Etapa: ${resource.stage}; área: ${resource.skillArea}; tipo: ${resource.resourceType}; complexidade: ${resource.complexity}; ${plural(resource.timesUsed, "uso", "usos")}${resource.timesUsed ? `, ${Math.round((resource.positiveOutcomes / resource.timesUsed) * 100)}% com bom resultado` : ""}. Atividades: ${resource.activities.map((activity) => `${activity.title} (${CONTEXTS[activity.context] ?? activity.context}, ${activity.durationMinutes} min)`).join("; ") || "nenhuma"}.`).join("\n");
    });

  const indicadores = define(ctx, "indicadores",
    network
      ? "Números do painel para a rede inteira ou para uma escola (pelo id): jornada, avisos, planos, aulas, atividades, uso da IA e estudantes com avisos."
      : "Números do painel da escola da pessoa: jornada, avisos, planos, aulas, atividades e uso da IA.",
    z.object({ escolaId: z.string().optional().describe("Id da escola, para a gestão da rede; vazio para toda a rede") }),
    async (args) => {
      const d = await loadDashboard(ctx.user, { period: "ano", school: network ? args.escolaId : undefined });
      const scope = d.scope.schoolId ? ctx.privacy.schoolLabel(d.scope.schoolId) : "toda a rede";
      return [
        `Painel (${scope}, este ano; página /painel):`,
        `- Estudantes: ${d.overview.students} (${d.overview.withAEE} no AEE); escolas: ${d.overview.schools}; turmas: ${d.overview.classes}.`,
        `- Com plano ativo: ${d.overview.withActivePlan} (${d.overview.planCoverage ?? 0}%). Objetivos em acompanhamento: ${d.overview.activeObjectives}; alcançados: ${d.overview.achievedObjectives}; com redução de apoio: ${d.overview.reducedSupport} de ${d.overview.measurableObjectives}.`,
        `- Registros de aula: ${d.overview.records} (${d.overview.studentsWithRecord} estudantes com registro). Participação plena: ${d.overview.fullParticipationPct ?? 0}%.`,
        `- Avisos: ${d.attention.byKind.map((kind) => `${kind.value} ${ALERT_LABELS[kind.key].toLowerCase()}`).join("; ")}. Revisões de plano nos próximos ${d.attention.reviewHorizonDays} dias: ${d.attention.reviewsSoon}.`,
        `- Jornada: ${d.journey.steps.map((step) => `${step.label}: ${step.done} de ${d.overview.students}`).join("; ")}. Conclusão média: ${d.journey.completion ?? 0}%.`,
        `- Atividades no ano: ${d.activities.created} criadas; sugestões aguardando avaliação: ${d.overview.pendingSuggestions}; adesão: ${d.activities.sources.map((source) => `${source.label} ${source.adhesion === null ? "—" : `${source.adhesion}%`}`).join(", ")}.`,
        `- Tendência dos objetivos: ${d.learning.trends.map((trend) => `${trend.label}: ${trend.value}`).join("; ")}.`,
        d.records.strategies.length ? `- Estratégias que mais funcionaram: ${d.records.strategies.map((item) => `${item.label} (${item.value}x)`).join(", ")}.` : "",
        `- IA: Claude ${d.ai.providers.claude ? "ativo" : "não configurado"}, DeepSeek ${d.ai.providers.deepseek ? "ativo" : "não configurado"}, OpenAI ${d.ai.providers.openai ? "ativo" : "não configurado"}; planos propostos pela IA: ${d.ai.planProposals.ia}; atividades da IA: ${d.ai.activities.total}; imagens: ${d.ai.images}.`,
        network ? `- Escolas da rede: ${d.scope.schools.map((school) => `${ctx.privacy.schoolLabel(school.id)} (id ${school.id})`).join(", ")}.` : "",
        d.profile.caa.withoutResources ? `- Leitura para a gestão: ${d.profile.caa.withoutResources} de ${d.profile.caa.total} estudantes com comunicação alternativa ainda sem recursos de acessibilidade registrados.` : "",
        d.attention.students.length ? `- Estudantes com avisos (no seu escopo): ${d.attention.students.filter((student) => student.alerts.length).slice(0, 15).map((student) => `${ctx.privacy.studentLabel(student.id)} (id ${student.id}): ${student.alerts.map((kind) => ALERT_LABELS[kind].toLowerCase()).join(", ")}`).join("; ")}.` : "",
      ].filter(Boolean).join("\n");
    });

  return [
    buscarEstudantes, verEstudante, verAtividades, proximosPassosDua, proporPlano, gerarAtividades, criarMaterial,
    registrarAula, decidirAtividade, marcarObjetivo, buscarRecursos, indicadores, datasInclusivas(ctx),
  ];
}

function datasInclusivas(ctx: ToolContext): BetaRunnableTool {
  return define(ctx, "datas_inclusivas",
    "Próximas datas comemorativas do público do AEE (autismo, Libras, braille, síndrome de Down, pessoa com deficiência...), com a ideia de atividade para a turma toda.",
    z.object({ dias: z.number().int().min(7).max(366).optional().describe("Horizonte em dias; padrão 60") }),
    async (args) => {
      const today = todayInBrazil();
      const events = upcomingEvents(today, args.dias ?? 60);
      if (!events.length) return "Nenhuma data comemorativa no período. Calendário: /calendario";
      return `Hoje é ${String(today.day).padStart(2, "0")}/${String(today.month).padStart(2, "0")}/${today.year}. Próximas datas (calendário em /calendario):\n` + events.slice(0, 12).map((event) => `- ${event.entry.title}, ${dateRangeLabel(event)} (${relativeLabel(event, today).toLowerCase()}), tema ${CALENDAR_THEMES[event.entry.theme].label}. ${event.entry.about} Ideia para a turma: ${event.entry.idea} Origem: ${event.entry.origin}`).join("\n");
    });
}

// ---------------------------------------------------------------------------
// Família
// ---------------------------------------------------------------------------
function familyTools(ctx: ToolContext): BetaRunnableTool[] {
  const studentId = ctx.studentIds[0];
  const meuEstudante = define(ctx, "meu_estudante",
    "O que a escola está trabalhando com o estudante, as atividades para fazer em casa (com o passo a passo), as conquistas registradas pela escola e o que a família já contou.",
    z.object({}),
    async () => {
      if (!studentId) return "O acesso ainda não está vinculado a um estudante. Peça à escola para conferir o cadastro.";
      const s = await prisma.student.findUniqueOrThrow({
        where: { id: studentId },
        include: {
          plans: { where: { status: "ativo" }, include: { objectives: { where: { status: "ativo" } } } },
          activities: { where: { context: "casa", status: { in: ["aceita", "aplicada"] } }, orderBy: { createdAt: "desc" }, take: 5 },
          timeline: { where: { type: "conquista" }, orderBy: { date: "desc" }, take: 5 },
          familyNotes: { orderBy: { date: "desc" }, take: 5 },
        },
      });
      const label = ctx.privacy.studentLabel(studentId);
      const objectives = s.plans.flatMap((plan) => plan.objectives);
      return [
        `# ${label} (página: /familia/${studentId})`,
        `## O que a escola está trabalhando\n${objectives.map((objective) => `- ${objective.description}`).join("\n") || "A escola ainda está montando o plano."}`,
        `## Atividades para fazer em casa\n${s.activities.map((a) => `- ${a.title} (${a.durationMinutes} min). Materiais: ${parseJson<string[]>(a.materials, []).join(", ")}. Passos: ${parseJson<string[]>(a.steps, []).map((step, index) => `${index + 1}. ${step}`).join(" ")} Se não der certo: ${a.planB}`).join("\n") || "A escola ainda não enviou atividades para casa."}`,
        `## Conquistas registradas pela escola\n${s.timeline.map((event) => `- ${event.title}${event.description ? `: ${event.description}` : ""} (${formatDate(event.date)})`).join("\n") || "Nenhuma ainda."}`,
        `## O que a família já contou\n${s.familyNotes.map((note) => `- "${note.note}" (${note.author}, ${formatDate(note.date)})${isHomeActivityNote(note.note) ? " [atividade feita em casa]" : ""}`).join("\n") || "Nenhuma observação ainda."}`,
      ].join("\n\n");
    });

  const contarConquista = define(ctx, "contar_conquista",
    "Prepara o envio de uma conquista observada em casa para a equipe da escola. Não envia: abre um cartão para a família confirmar.",
    z.object({ texto: z.string().describe("O que o estudante conseguiu fazer, com as palavras da família"), quem: z.string().optional().describe("Quem observou, como 'mãe' ou 'avó'") }),
    async (args) => {
      if (!studentId) throw new Error("O acesso ainda não está vinculado a um estudante.");
      if (!args.texto.trim()) throw new Error("Escreva o que aconteceu.");
      return propose(ctx, "contar_conquista", `Contar para a escola: “${args.texto.trim()}”${args.quem ? ` (observado por ${args.quem})` : ""}.`, { studentId, note: args.texto.trim(), author: args.quem?.trim() || "Família" });
    });

  return [meuEstudante, contarConquista, datasInclusivas(ctx)];
}

// ---------------------------------------------------------------------------
// Terapeuta
// ---------------------------------------------------------------------------
function therapistTools(ctx: ToolContext): BetaRunnableTool[] {
  const studentId = ctx.studentIds[0];
  const meuEstudante = define(ctx, "meu_estudante",
    "Comunicação, interesses e apoios registrados pela escola (perfil funcional) e os relatórios de articulação já enviados. Sem notas, diário ou dados administrativos.",
    z.object({}),
    async () => {
      if (!studentId) return "O acesso ainda não está vinculado a um estudante. Peça à escola para conferir o cadastro.";
      const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { profile: true, intersectorReports: { orderBy: { createdAt: "desc" }, take: 3 } } });
      return [
        `# ${ctx.privacy.studentLabel(studentId)} (página: /terapeuta)`,
        `${s.gradeYear}, ${STAGES[s.stage] ?? s.stage}. AEE: ${s.hasAEE ? "sim" : "não"}.`,
        `## Como aprende (registrado pela escola)\n${s.profile ? profileText(s.profile) : "A escola ainda não preencheu o perfil."}`,
        `## Relatórios enviados\n${s.intersectorReports.map((report) => `- ${formatDate(report.createdAt)}: comunicação: ${report.communication}; recursos: ${report.accessResources}; estratégias: ${report.strategiesToTry}; orientações: ${report.schoolGuidance}; objetivos compartilhados: ${report.sharedGoals}.`).join("\n") || "Nenhum relatório ainda."}`,
      ].join("\n\n");
    });

  const enviarOrientacoes = define(ctx, "enviar_orientacoes",
    "Prepara um relatório de articulação intersetorial para a escola, só com informações funcionais. Não envia: abre um cartão para o terapeuta confirmar. Reúna os campos obrigatórios antes de chamar.",
    z.object({
      comunicacao: z.string().describe("Formas de comunicação mais eficazes"),
      recursos: z.string().describe("Recursos de acessibilidade utilizados"),
      posicionamento: z.string().optional().describe("Necessidades de posicionamento ou mobilidade"),
      facilitadores: z.string().describe("Fatores que facilitam a participação"),
      estrategias: z.string().describe("Estratégias que a escola pode testar"),
      orientacoes: z.string().describe("Orientações aplicáveis ao ambiente escolar"),
      objetivosCompartilhados: z.string().describe("Objetivos compartilhados entre escola e família"),
    }),
    async (args) => {
      if (!studentId) throw new Error("O acesso ainda não está vinculado a um estudante.");
      const summary = `Enviar orientações à escola: comunicação: ${args.comunicacao}; recursos: ${args.recursos}; ${args.posicionamento ? `posicionamento: ${args.posicionamento}; ` : ""}facilitadores: ${args.facilitadores}; estratégias: ${args.estrategias}; orientações: ${args.orientacoes}; objetivos compartilhados: ${args.objetivosCompartilhados}.`;
      return propose(ctx, "enviar_orientacoes", summary, {
        studentId, communication: args.comunicacao, accessResources: args.recursos, positioning: args.posicionamento ?? null,
        facilitators: args.facilitadores, schoolGuidance: args.orientacoes, strategiesToTry: args.estrategias, sharedGoals: args.objetivosCompartilhados,
      });
    });

  return [meuEstudante, enviarOrientacoes, datasInclusivas(ctx)];
}

// A lista é determinística por perfil: a mesma conversa recebe sempre as
// mesmas ferramentas na mesma ordem.
export function buildTools(ctx: ToolContext): BetaRunnableTool[] {
  const role = ctx.user.role;
  if (role === "familia") return familyTools(ctx);
  if (role === "terapeuta") return therapistTools(ctx);
  if (isStaffOrNetwork(role) && canSeePedagogicalDetail(role)) return staffTools(ctx);
  return [datasInclusivas(ctx)];
}

