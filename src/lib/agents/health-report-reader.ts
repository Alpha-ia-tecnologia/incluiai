import "server-only";
import { z } from "zod/v4";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "../prisma";
import type { SessionUser } from "../auth";
import { AUDIT_ACTION, recordChange } from "../audit";
import { runAiJob } from "./job";
import { DOCUMENT_MARKER_LIST, DOCUMENT_PATTERNS, replacePatterns } from "./redactor";
import { SAFEGUARDS } from "../pedagogy-rules";
import { REPORT_FIELDS, REPORT_FIELD_KEYS, fieldOptions, normalizeReading, type RawReading } from "../health-report";

// Fica fora dos arquivos "use server" para não virar uma ação pública.

const MIN_LETTERS = 80;
const MAX_TEXT_CHARS = 60_000;

type Extracted = { text: string } | { error: "protegido" | "sem_texto" | "ilegivel" };

export async function extractReportText(bytes: Uint8Array): Promise<Extracted> {
  try {
    // Cópia: o pdf.js pode tomar posse do buffer que recebe.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const letters = clean.match(/\p{L}/gu)?.length ?? 0;
    if (letters < MIN_LETTERS) return { error: "sem_texto" };
    return { text: clean.slice(0, MAX_TEXT_CHARS) };
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") return { error: "protegido" };
    console.error("[laudo] não foi possível extrair o texto do PDF:", error);
    return { error: "ilegivel" };
  }
}

const SINGULAR: Record<string, string> = {
  "linhas de identificação": "linha de identificação",
  "nomes de profissionais": "nome de profissional",
  "registros profissionais": "registro profissional",
  documentos: "documento",
  endereços: "endereço",
};

function privacyNote(known: string | null, documentCounts: Record<string, number>): string {
  const extra = Object.entries(documentCounts).map(([label, total]) => `${total} ${total === 1 ? SINGULAR[label] ?? label : label}`);
  const note = [
    known,
    extra.length ? `${known ? "Também saíram do texto" : "Antes do envio à IA, saíram do texto"}: ${extra.join(", ")}.` : null,
  ].filter(Boolean).join(" ");
  return note || "Nenhuma informação pessoal foi reconhecida no texto enviado à IA.";
}

const ReadingSchema = z.object({
  tipoDocumento: z.enum(["laudo", "relatorio", "outro"])
    .describe("laudo: médico ou neuropsicológico; relatorio: de terapia ou de outro serviço de saúde; outro: não é um documento de saúde."),
  resumo: z.string()
    .describe("Duas a quatro frases sobre o que o documento ajuda a escola a entender e a fazer. Linguagem pedagógica: participação, comunicação, aprendizagem, rotina e apoios. Sem nome de diagnóstico, CID, medicamento, dose ou exame."),
  orientacoes: z.array(z.object({
    texto: z.string().describe("Uma orientação prática para a escola, começando com verbo no infinitivo. Ex.: Antecipar as mudanças da rotina com apoio visual."),
    trecho: z.string().describe("Trecho curto do documento que sustenta a orientação, copiado sem alterar (até 200 caracteres)."),
  })).describe("Até 8 orientações que o documento traz para o ambiente escolar. Vazio se o documento não traz nenhuma."),
  sugestoes: z.array(z.object({
    campo: z.enum(REPORT_FIELD_KEYS),
    valores: z.array(z.string()).describe("Opções da lista do campo, copiadas exatamente."),
    trecho: z.string().describe("Trecho curto do documento que sustenta a sugestão, copiado sem alterar (até 200 caracteres)."),
  })).describe("Uma entrada por campo do estudo de caso que o documento permite preencher."),
  limites: z.string().describe("O que o documento não permite afirmar, ou partes ilegíveis. Vazio se nada."),
});

const SYSTEM = `Você apoia a equipe do Atendimento Educacional Especializado (AEE) de uma escola pública brasileira. A equipe anexou um laudo ou relatório de saúde de um estudante e quer saber o que ele traz de útil para a escola.

O AEE é pedagógico e não depende de laudo. Seu papel é traduzir o documento em barreiras e apoios para o ambiente escolar, não repetir nem avaliar o diagnóstico.

Princípios que valem para tudo o que você escrever:
${SAFEGUARDS}

Regras da leitura:
- Use só o que está escrito no documento. Se algo não aparece, não sugira. Não complete lacunas com o que costuma valer para um diagnóstico.
- O resumo e as orientações falam de participação, comunicação, aprendizagem, rotina, ambiente e apoios. Não citam nome de diagnóstico, CID, medicamento, dose nem exame.
- O diagnóstico, quando o documento traz, só aparece como sugestão para o campo "diagnostico", escolhendo entre as opções da lista.
- Nas sugestões de campo, copie as opções exatamente como estão na lista. Se nenhuma opção corresponde ao que o documento diz, não sugira aquele campo.
- "publicoAlvo" só quando o documento deixa claro deficiência, transtorno do espectro autista ou altas habilidades.
- "Medicação no horário escolar" só se o documento indicar dose durante o período da escola.
- Cada sugestão e cada orientação traz um trecho curto do documento que a sustenta, copiado sem alterar.
- Os marcadores entre colchetes (${DOCUMENT_MARKER_LIST}) substituem dados pessoais. Mantenha-os como estão e não tente adivinhar o que escondem.
- Escreva em português do Brasil, com frases curtas e sem jargão clínico.
- Se o documento não for um laudo ou relatório de saúde, use tipoDocumento "outro" e deixe orientações e sugestões vazias.`;

function buildPrompt(text: string) {
  const fields = REPORT_FIELDS.map((field) => `- ${field.key} (${field.label}; ${field.type === "multi" ? "várias respostas" : "uma resposta"}): ${fieldOptions(field).map((option) => `"${option}"`).join("; ")}`);
  return `## Campos do estudo de caso que você pode sugerir\n${fields.join("\n")}\n\n## Documento (texto extraído do PDF, já anonimizado)\n"""\n${text}\n"""`;
}

export async function processHealthReport(reportId: string, user: SessionUser) {
  const prisma = await db();
  const report = await prisma.healthReport.findUniqueOrThrow({ where: { id: reportId }, select: { studentId: true, mimeType: true, data: true } });
  const save = (data: { status: string; reading?: string; privacyNote?: string; failure?: string | null }) =>
    prisma.healthReport.update({ where: { id: reportId }, data: { failure: null, ...data } });

  if (report.mimeType !== "application/pdf") return save({ status: "sem_texto" });
  const extracted = await extractReportText(new Uint8Array(report.data));
  if ("error" in extracted) {
    if (extracted.error === "protegido") return save({ status: "falhou", failure: "O PDF está protegido por senha. Envie uma cópia sem senha." });
    if (extracted.error === "ilegivel") return save({ status: "falhou", failure: "Não foi possível abrir este PDF. Ele pode estar danificado." });
    return save({ status: "sem_texto" });
  }
  const documentCounts: Record<string, number> = {};
  const text = replacePatterns(extracted.text, DOCUMENT_PATTERNS, documentCounts);
  const outcome = await runAiJob<RawReading>({
    task: "leitura do laudo",
    scope: { student: report.studentId },
    student: report.studentId,
    needs: "files",
    run: (model) => model({ agent: "Leitura do laudo", system: SYSTEM, prompt: buildPrompt(text), schema: ReadingSchema, effort: "medium" }),
  });
  if (outcome.reason === "desligada") return save({ status: "ia_desligada" });
  if (outcome.reason === "sem_autorizacao") return save({ status: "sem_autorizacao" });
  const note = privacyNote(outcome.privacy.summary, documentCounts);
  try {
    if (outcome.value) await save({ status: "lido", reading: JSON.stringify(normalizeReading(outcome.value)), privacyNote: note });
    else await save({ status: "falhou", privacyNote: note, failure: `A leitura pela IA não terminou (${outcome.error}). O arquivo continua guardado.` });
  } finally {
    await recordChange(user, report.studentId, AUDIT_ACTION.sentToAi, "Texto do laudo, sem nomes nem contatos, para leitura (Claude)");
  }
}
