import { z } from "zod/v4";
import { extractText, getDocumentProxy } from "unpdf";
import { prisma } from "../prisma";
import { hasApiKey } from "../env";
import { claudeAgentModel } from "./claude";
import { describeAgentError } from "./generate";
import { loadAnonymizer, naturalizePlaceholders, type Anonymizer } from "./anonymize";
import { REPORT_FIELDS, REPORT_FIELD_KEYS, fieldOptions, normalizeReading, type RawReading } from "../health-report";

// Leitura de um laudo pela IA. Fica fora dos arquivos "use server": quem chama
// confere a permissão antes.
//
// Privacidade (LGPD): a IA nunca recebe o arquivo, só o texto extraído do PDF,
// e o texto sai anonimizado. Além dos nomes conhecidos pela plataforma (o
// estudante, a família, a equipe, as escolas) e dos contatos e documentos de
// sempre, saem as linhas de identificação do laudo, nomes depois de "Dr." e
// "Dra.", registros profissionais (CRM, CRP...), cartão do SUS, RG e
// endereços. Só o Claude lê laudos: o DeepSeek, provedor de reserva dos outros
// agentes, não recebe dados de saúde.

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

const REPORT_PATTERNS: { label: string; regex: RegExp; replacement: string }[] = [
  {
    label: "linhas de identificação",
    regex: /(?<![\p{L}])(Paciente|Nome(?: completo| do paciente| da criança| do estudante| do aluno)?|M[ãa]e|Pai|Respons[áa]vel(?: legal)?|Filia[çc][ãa]o|Acompanhante|Data de nascimento|Nascimento|D\.?N\.?|Endere[çc]o|Prontu[áa]rio|Matr[íi]cula)\s*:[^\n]*/giu,
    replacement: "$1: [OMITIDO]",
  },
  { label: "nomes de profissionais", regex: /(?<![\p{L}])(?:Dr\.ª|Dra?\.?|Doutora?)\s+\p{Lu}[\p{L}'’-]+(?:\s+(?:d[aeo]s?\s+)?\p{Lu}[\p{L}'’-]+){0,4}/gu, replacement: "[PROFISSIONAL]" },
  { label: "registros profissionais", regex: /\b(?:CRM|CRP|CRFa|CREFITO|COREN|CRN|CRO|RQE)\b[\s:/-]*(?:[A-Z]{2}[\s:/-]*)?\d[\d./-]*/g, replacement: "[REGISTRO PROFISSIONAL]" },
  { label: "documentos", regex: /\b\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, replacement: "[DOCUMENTO]" },
  { label: "documentos", regex: /\b\d{1,2}\.\d{3}\.\d{3}-[\dXx]\b/g, replacement: "[DOCUMENTO]" },
  { label: "endereços", regex: /(?<![\p{L}])(?:Rua|Avenida|Av\.|Travessa|Alameda|Rodovia|Estrada|Praça)\s+[^\n,;]{2,80}(?:,\s*(?:n[º°o.]\s*)?\d+[A-Za-z]?)?/gu, replacement: "[ENDEREÇO]" },
];

const SINGULAR: Record<string, string> = {
  "linhas de identificação": "linha de identificação",
  "nomes de profissionais": "nome de profissional",
  "registros profissionais": "registro profissional",
  documentos: "documento",
  endereços: "endereço",
};

export function anonymizeReportText(text: string, anonymizer: Anonymizer): { text: string; note: string } {
  const counts: Record<string, number> = {};
  let result = text;
  for (const pattern of REPORT_PATTERNS) {
    result = result.replace(pattern.regex, (...args) => {
      counts[pattern.label] = (counts[pattern.label] ?? 0) + 1;
      return pattern.replacement.replace("$1", String(args[1] ?? ""));
    });
  }
  result = anonymizer.apply(result);
  const extra = Object.entries(counts).map(([label, total]) => `${total} ${total === 1 ? SINGULAR[label] ?? label : label}`);
  const known = anonymizer.summary();
  const note = [
    known,
    extra.length ? `${known ? "Também saíram do texto" : "Antes do envio à IA, saíram do texto"}: ${extra.join(", ")}.` : null,
  ].filter(Boolean).join(" ");
  return { text: result, note: note || "Nenhuma informação pessoal foi reconhecida no texto enviado à IA." };
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

Regras:
- Use só o que está escrito no documento. Se algo não aparece, não sugira. Não complete lacunas com o que costuma valer para um diagnóstico.
- O resumo e as orientações falam de participação, comunicação, aprendizagem, rotina, ambiente e apoios. Não citam nome de diagnóstico, CID, medicamento, dose nem exame.
- O diagnóstico, quando o documento traz, só aparece como sugestão para o campo "diagnostico", escolhendo entre as opções da lista.
- Nas sugestões de campo, copie as opções exatamente como estão na lista. Se nenhuma opção corresponde ao que o documento diz, não sugira aquele campo.
- "publicoAlvo" só quando o documento deixa claro deficiência, transtorno do espectro autista ou altas habilidades.
- "Medicação no horário escolar" só se o documento indicar dose durante o período da escola.
- Cada sugestão e cada orientação traz um trecho curto do documento que a sustenta, copiado sem alterar.
- Os marcadores entre colchetes ([ESTUDANTE], [PROFISSIONAL], [DATA], [OMITIDO] e outros) substituem dados pessoais. Mantenha-os como estão e não tente adivinhar o que escondem.
- Escreva em português do Brasil, com frases curtas e sem jargão clínico.
- Se o documento não for um laudo ou relatório de saúde, use tipoDocumento "outro" e deixe orientações e sugestões vazias.`;

function buildPrompt(text: string) {
  const fields = REPORT_FIELDS.map((field) => `- ${field.key} (${field.label}; ${field.type === "multi" ? "várias respostas" : "uma resposta"}): ${fieldOptions(field).map((option) => `"${option}"`).join("; ")}`);
  return `## Campos do estudo de caso que você pode sugerir\n${fields.join("\n")}\n\n## Documento (texto extraído do PDF, já anonimizado)\n"""\n${text}\n"""`;
}

// Marcadores próprios do laudo que sobrarem na resposta viram texto comum.
const LEFTOVER_MARKERS = /\[(OMITIDO|REGISTRO PROFISSIONAL|ENDEREÇO)\]/g;
function withoutMarkers<T>(value: T): T {
  if (typeof value === "string") return value.replace(LEFTOVER_MARKERS, "(informação omitida)") as T;
  if (Array.isArray(value)) return value.map((item) => withoutMarkers(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutMarkers(item)])) as T;
  return value;
}

// Lê o laudo guardado e grava o resultado no próprio registro. Nunca lança:
// o arquivo já está guardado, e a tela mostra o que aconteceu.
export async function processHealthReport(reportId: string) {
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
  if (!hasApiKey("ANTHROPIC_API_KEY")) return save({ status: "ia_desligada" });

  const { text, note } = anonymizeReportText(extracted.text, await loadAnonymizer(report.studentId));
  try {
    const raw = await claudeAgentModel<RawReading>({ agent: "Leitura do laudo", system: SYSTEM, prompt: buildPrompt(text), schema: ReadingSchema, effort: "medium" });
    const reading = normalizeReading(withoutMarkers(naturalizePlaceholders(raw)));
    await save({ status: "lido", reading: JSON.stringify(reading), privacyNote: note });
  } catch (error) {
    console.error("[laudo] leitura pela IA falhou:", error);
    await save({ status: "falhou", privacyNote: note, failure: `A leitura pela IA não terminou (${describeAgentError(error)}). O arquivo continua guardado.` });
  } finally {
    await prisma.accessLog.create({
      data: { studentId: report.studentId, actor: "Agentes de IA", role: "sistema", action: "enviou", detail: "Texto do laudo, sem nomes nem contatos, enviado ao Claude para leitura" },
    });
  }
}
