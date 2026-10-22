import { notifyFamily } from "./notifications";
import type { FunctionalProfile, Student } from "@prisma/client";
import { aiAllowedFor, imagesAllowedFor } from "./consent";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { assertStudentTeam } from "./records";
import { parseJson } from "./format";
import { CHANNELS } from "./scale";
import { createAgentModel } from "./agents/model";
import { loadAnonymizer } from "./agents/anonymize";
import { recordDeepSeekUse } from "./agents/audit";
import { caseStudyText, profileText } from "./agents/context";
import { describeAgentError, reporting, type AgentReport } from "./agents/generate";
import { runMaterialAgent } from "./agents/material-agent";
import type { TraceStep } from "./agents/schemas";
import { isImageGenerationEnabled } from "./images/openai-images";
import { generateMaterialImages } from "./images/material-images";
import {
  MATERIAL_KIND_LABEL, checkMaterial, isMaterialKind, normalizeMaterialContent, rulesMaterial,
  type MaterialContent, type MaterialContext, type ProfileFacts,
} from "./material-content";

// Geração do material de apoio, usada pela página Materiais de apoio e pelo
// assistente. Com IA ligada, o agente cria o material a partir do perfil (sem
// dados pessoais); sem IA ou se ela falhar, o motor de regras cria. O material
// nasce "sugerido": um profissional aprova antes do uso. Nada aqui é ação pública.

export type MaterialRequest = { kind: string; topic: string; context: string; objectiveId?: string | null; withImages: boolean };

export function profileFacts(student: Pick<Student, "name">, profile: FunctionalProfile): ProfileFacts {
  const sensory = parseJson<Record<string, string>>(profile.sensoryProfile, {});
  return {
    firstName: student.name.split(" ")[0],
    expressiveChannel: profile.expressiveChannel,
    expressiveLabel: CHANNELS[profile.expressiveChannel] ?? profile.expressiveChannel,
    receptiveLabel: CHANNELS[profile.receptiveChannel] ?? profile.receptiveChannel,
    commandSteps: profile.commandSteps,
    attentionMinutes: profile.attentionMinutes,
    toleranceMinutes: profile.taskToleranceMinutes,
    interests: parseJson<string[]>(profile.interests, []).filter(Boolean),
    calming: parseJson<string[]>(profile.calmingStrategies, []).filter(Boolean),
    triggers: parseJson<string[]>(profile.triggers, []).filter(Boolean),
    sensitiveTo: Object.entries(sensory).filter(([, level]) => level === "hiper").map(([area]) => area),
    readingSupport: profile.readingSupport,
    fineMotorSupport: profile.fineMotor,
    usesWheelchair: profile.usesWheelchairOrOrthosis,
    strengths: profile.strengths ?? "",
  };
}

const CONTEXTS: MaterialContext[] = ["sala_comum", "aee", "casa"];

export async function createStudentMaterial(user: SessionUser, studentId: string, request: MaterialRequest, report?: AgentReport) {
  await assertStudentTeam(user, studentId);
  if (!isMaterialKind(request.kind)) throw new Error("Escolha o tipo de material.");
  const kind = request.kind;
  const context: MaterialContext = CONTEXTS.includes(request.context as MaterialContext) ? (request.context as MaterialContext) : "aee";
  const topic = request.topic.replace(/\s+/g, " ").trim().slice(0, 160);
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { profile: true, caseStudy: true } });
  if (!student.profile) throw new Error("Preencha Como aprende antes de gerar materiais.");
  // O objetivo precisa ser do plano DESTE estudante (nada de vínculo entre pessoas diferentes).
  const objective = request.objectiveId
    ? await prisma.objective.findFirst({ where: { id: request.objectiveId, plan: { studentId } }, select: { id: true, description: true, action: true, condition: true, criterion: true } })
    : null;
  if (request.objectiveId && !objective) throw new Error("O objetivo escolhido não é do plano deste estudante.");
  const objectiveText = objective ? `${objective.action}, ${objective.condition}, ${objective.criterion}` : null;
  const facts = profileFacts(student, student.profile);
  const rules = { kind, toleranceMinutes: facts.toleranceMinutes };

  let result: { title: string; content: MaterialContent } | null = null;
  let source: "ia" | "regras" = "regras";
  let trace: TraceStep[] = [];
  // IA só com a autorização da família; sem ela, o material sai pelas regras.
  if (await aiAllowedFor(studentId)) {
    const anonymizer = await loadAnonymizer(studentId);
    const agents = createAgentModel(anonymizer);
    const contextText = [
      `## Como aprende\n${profileText(student.profile)}`,
      student.caseStudy ? `\n## Estudo de caso (parte pedagógica)\n${caseStudyText(student.caseStudy.content)}` : "",
    ].filter(Boolean).join("\n");
    try {
      const generated = await runMaterialAgent({ kind, topic, context, objective: objectiveText, contextText, facts }, reporting(agents.model, report));
      result = { title: generated.title, content: generated.content };
      source = "ia";
      trace = [{ agent: "Anonimização", summary: anonymizer.summary() ?? "Nenhuma informação pessoal encontrada nos textos enviados à IA." }, ...generated.trace];
    } catch (error) {
      console.error("[materiais] geração por IA falhou:", error);
      report?.({ agent: "Motor de regras", phase: "start" });
      trace = [{ agent: "Agentes de IA", summary: `Indisponíveis no momento (${describeAgentError(error)}). O material foi feito pelas regras da plataforma.` }];
    }
    await recordDeepSeekUse(studentId, agents.deepseekAgents(), trace);
  } else {
    report?.({ agent: "Motor de regras", phase: "start" });
    trace = [{ agent: "Motor de regras", summary: "A IA está desligada nesta instalação. O material foi feito pelas regras da plataforma." }];
  }
  if (!result) {
    result = rulesMaterial({ kind, topic, context, objective: objectiveText, facts });
    result.content.reviewNotes = checkMaterial(result.content, rules);
  }

  const title = `${result.title.replace(/\s+/g, " ").trim().slice(0, 100)} · ${facts.firstName}`;
  const material = await prisma.material.create({
    data: { studentId, kind, title, content: JSON.stringify(result.content), source, topic: topic || null, context, objectiveId: objective?.id ?? null, status: "sugerido", trace: JSON.stringify(trace) },
  });
  await prisma.timelineEvent.create({ data: { studentId, type: "recurso", title: `Material de apoio preparado: ${title}`, description: `${MATERIAL_KIND_LABEL[kind]} com ${result.content.activities.length} atividade(s) para aplicar. Aguarda aprovação da equipe.` } });
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "criou", detail: `Material de apoio (${source === "ia" ? "agentes de IA" : "regras"}): ${MATERIAL_KIND_LABEL[kind]}` } });

  let images = { created: 0, errors: [] as string[], requested: false };
  if (request.withImages && (await imagesAllowedFor(studentId))) {
    report?.({ agent: "Ilustração", phase: "start" });
    images = { ...(await generateMaterialImages(material.id, user)), requested: true };
    report?.({ agent: "Ilustração", phase: images.errors.length && !images.created ? "fail" : "end" });
  }
  return { material, content: result.content, source, images };
}

async function loadOwnMaterial(user: SessionUser, studentId: string, materialId: string) {
  await assertStudentTeam(user, studentId);
  const material = await prisma.material.findFirst({ where: { id: materialId, studentId } });
  if (!material) throw new Error("Material não encontrado para este estudante.");
  return material;
}

// Aprovar para uso: decisão do profissional, registrada com autoria e data.
export async function approveStudentMaterial(user: SessionUser, studentId: string, materialId: string) {
  const material = await loadOwnMaterial(user, studentId, materialId);
  await prisma.material.update({ where: { id: material.id }, data: { status: "aprovado", approvedBy: user.name, approvedAt: new Date() } });
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "editou", detail: `Material de apoio aprovado para uso: ${material.title}` } });
  await notifyFamily(studentId, "material_aprovado", `/familia/${studentId}#materiais`);
}

export async function addMaterialImages(user: SessionUser, studentId: string, materialId: string) {
  const material = await loadOwnMaterial(user, studentId, materialId);
  if (!isImageGenerationEnabled()) throw new Error("A geração de imagens não está configurada (falta OPENAI_API_KEY).");
  if (!(await imagesAllowedFor(studentId))) throw new Error("A família ainda não autorizou o uso de IA com os dados deste estudante.");
  return generateMaterialImages(material.id, user);
}

// Leva uma atividade do material para as Atividades do estudante, como sugerida:
// segue o fluxo de sempre (aceitar → aplicar → registrar aula).
export async function saveMaterialActivity(user: SessionUser, studentId: string, materialId: string, index: number) {
  const material = await loadOwnMaterial(user, studentId, materialId);
  const content = normalizeMaterialContent(parseJson<unknown>(material.content, {}));
  const activity = content.activities[index];
  if (!activity) throw new Error("Atividade não encontrada neste material.");
  const created = await prisma.activity.create({
    data: {
      studentId,
      objectiveId: material.objectiveId,
      title: activity.title,
      context: activity.context,
      durationMinutes: activity.durationMinutes,
      materials: JSON.stringify([material.title, ...activity.materials]),
      steps: JSON.stringify(activity.steps),
      responseForm: activity.responseForms.join("; "),
      adaptations: JSON.stringify(content.adaptations.map((item) => ({ text: item.text, rule: item.basis }))),
      supportBelow: activity.supportBelow,
      supportTarget: activity.supportTarget,
      supportAbove: activity.supportAbove,
      successCriterion: activity.successCriterion,
      planB: activity.planB,
      classParticipation: activity.classParticipation ?? null,
      reviewNotes: content.reviewNotes.length ? JSON.stringify(content.reviewNotes) : null,
      status: "sugerida",
      source: material.source === "ia" ? "ia" : "regras",
    },
  });
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "criou", detail: `Atividade a partir do material: ${activity.title}` } });
  return created.id;
}
