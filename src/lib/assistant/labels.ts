// Rótulos e sugestões do assistente, sem dependências de servidor: a tela e
// as ferramentas usam os mesmos textos.

export const TOOL_LABELS: Record<string, string> = {
  buscar_estudantes: "Consultando os estudantes",
  ver_estudante: "Lendo o acompanhamento do estudante",
  ver_atividades: "Consultando as atividades",
  proximos_passos_dua: "Consultando os próximos passos do DUA",
  // Sem duração: a faixa de espera dá o tempo certo (com imagens, até 4 minutos).
  propor_plano: "Preparando a proposta de plano com os agentes",
  gerar_atividades: "Criando as 3 sugestões de atividade com os agentes",
  criar_material: "Montando o material acessível",
  registrar_aula: "Preparando o registro da aula",
  decidir_atividade: "Preparando a decisão sobre a atividade",
  marcar_objetivo: "Preparando a mudança do objetivo",
  buscar_recursos: "Consultando o banco de recursos",
  indicadores: "Consultando o painel",
  datas_inclusivas: "Consultando o calendário",
  meu_estudante: "Consultando o acompanhamento",
  contar_conquista: "Preparando a conquista para enviar",
  enviar_orientacoes: "Preparando o relatório",
};

export const STEP_DONE_LABELS: Record<string, string> = {
  buscar_estudantes: "Consultou os estudantes",
  ver_estudante: "Leu o acompanhamento do estudante",
  ver_atividades: "Consultou as atividades",
  proximos_passos_dua: "Consultou os próximos passos do DUA",
  propor_plano: "Preparou a proposta de plano",
  gerar_atividades: "Criou as sugestões de atividade",
  criar_material: "Montou o material acessível",
  registrar_aula: "Preparou o registro da aula",
  decidir_atividade: "Preparou a decisão sobre a atividade",
  marcar_objetivo: "Preparou a mudança do objetivo",
  buscar_recursos: "Consultou o banco de recursos",
  indicadores: "Consultou o painel",
  datas_inclusivas: "Consultou o calendário",
  meu_estudante: "Consultou o acompanhamento",
  contar_conquista: "Preparou a conquista para enviar",
  enviar_orientacoes: "Preparou o relatório",
};

export const ACTION_KIND_LABELS: Record<string, string> = {
  registrar_aula: "Registro de aula",
  decidir_atividade: "Decisão sobre atividade",
  marcar_objetivo: "Situação do objetivo",
  contar_conquista: "Conquista de casa",
  enviar_orientacoes: "Orientações para a escola",
};

export function suggestionsFor(role: string): string[] {
  if (role === "familia") {
    return [
      "O que a escola está trabalhando com meu filho?",
      "Que atividade posso fazer em casa hoje?",
      "Quero contar uma conquista de casa",
      "O que significa “nível de apoio”?",
    ];
  }
  if (role === "terapeuta") {
    return [
      "O que a escola registrou sobre a comunicação?",
      "Quero enviar orientações para a escola",
      "Como transformo uma observação clínica em orientação para a sala?",
    ];
  }
  if (["secretaria", "gestao", "coordenacao"].includes(role)) {
    return [
      "Quais estudantes precisam de atenção?",
      "Como está o acompanhamento este ano?",
      "Que estratégias mais funcionaram na rede?",
      "Quais datas inclusivas vêm aí?",
    ];
  }
  return [
    "Como está o acompanhamento do meu estudante?",
    "Prepare uma atividade para a aula de hoje",
    "Quero registrar a aula de agora",
    "O que é a escala de apoio?",
  ];
}
