// Textos gravados no banco com nomes antigos ou técnicos, trocados na tela
// pelos nomes que a plataforma usa hoje. Não altera o que está gravado.

const TIMELINE_TITLES: Record<string, string> = {
  "PPI elaborado": "Plano individual criado",
  "Relatório de Articulação Intersetorial": "Orientações da equipe de saúde",
  "Cadastro no prontuário municipal": "Cadastro na rede municipal",
};

export function timelineTitle(title: string): string {
  return TIMELINE_TITLES[title] ?? title;
}

// Histórico de acessos que a família vê: "abriu o resumo do acompanhamento".
const ACCESS_VERBS: Record<string, string> = { visualizou: "abriu" };
const ACCESS_TEXT: Record<string, { object: string; verb?: string }> = {
  "Visão geral do prontuário": { object: "o resumo do acompanhamento" },
  "Resumo do acompanhamento": { object: "o resumo do acompanhamento" },
  "Relatório de articulação intersetorial": { verb: "enviou", object: "orientações da equipe de saúde" },
  "Orientações para a escola": { verb: "enviou", object: "orientações da equipe de saúde" },
  "Cadastro do estudante": { object: "o cadastro" },
  "Perfil funcional": { object: "o registro de como aprende" },
  "Estudo de caso": { object: "o estudo de caso" },
  "Plano individual (a partir de proposta)": { object: "o plano individual" },
  "Proposta de plano descartada": { verb: "descartou", object: "uma proposta de plano" },
  "Assistente: resumo do estudante": { verb: "pediu", object: "um resumo ao assistente" },
  "Imagem de apoio da atividade (OpenAI, sem dados pessoais)": { object: "uma imagem de apoio para atividade, sem dados pessoais" },
  "Informações pedagógicas, sem dados pessoais, enviadas ao DeepSeek (fallback de IA)": { object: "informações pedagógicas, sem dados pessoais, para a IA de reserva (DeepSeek)" },
  "Laudo anexado ao estudo de caso": { verb: "anexou", object: "um laudo ao estudo de caso" },
  "Laudo excluído do estudo de caso": { verb: "excluiu", object: "um laudo do estudo de caso" },
  "Arquivo do laudo": { object: "o arquivo de um laudo" },
  "Texto do laudo, sem nomes nem contatos, enviado ao Claude para leitura": { object: "o texto de um laudo, sem nomes nem contatos, para a leitura pela IA (Claude)" },
  "Estudo de caso: informações do laudo": { verb: "juntou", object: "informações de um laudo ao estudo de caso" },
};

export function accessSentence(action: string, detail: string | null): string {
  const known = detail ? ACCESS_TEXT[detail] : undefined;
  const verb = known?.verb ?? ACCESS_VERBS[action] ?? action;
  const object = known?.object ?? (detail ? detail.charAt(0).toLowerCase() + detail.slice(1) : "");
  return [verb, object].filter(Boolean).join(" ");
}

// Acessos iguais no mesmo dia (mesmo papel, mesma ação) viram uma linha só,
// com a contagem: a família lê o que aconteceu, não uma lista repetida.
export function groupAccessLogs(
  logs: { id: string; role: string; action: string; detail: string | null; createdAt: Date }[],
  formatDay: (date: Date) => string,
) {
  const groups: { key: string; role: string; sentence: string; date: string; count: number }[] = [];
  for (const log of logs) {
    const sentence = accessSentence(log.action, log.detail);
    const date = formatDay(log.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.role === log.role && last.sentence === sentence && last.date === date) last.count += 1;
    else groups.push({ key: log.id, role: log.role, sentence, date, count: 1 });
  }
  return groups;
}

// Materiais gravados antes da revisão de texto: código do canal e "o(a)".
export function materialText(text: string, channels: Record<string, string>): string {
  return text
    .replace(/Cartões de comunicação alternativa \(([a-z_]+)\)\./, (_, code: string) => `Cartões de comunicação alternativa para usar com ${channels[code] ?? "a comunicação do estudante"}.`)
    .replace(/^Eu sou o\(a\) (.+?) e vou para a escola\./, "Meu nome é $1 e eu vou para a escola.");
}
