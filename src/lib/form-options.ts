// Opções prontas dos formulários. Todo campo com estas listas também oferece
// "Outro", em que a pessoa digita o que não encontrou. Itens de campos gravados
// como lista separada por vírgula (perfil funcional) não podem conter vírgula.

export type ChoiceOption = string | { value: string; label: string };

export const minuteOptions = (values: number[]): ChoiceOption[] =>
  values.map((value) => ({ value: String(value), label: `${value} minutos` }));

export const weekOptions = (values: number[]): ChoiceOption[] =>
  values.map((value) => ({ value: String(value), label: `${value} semanas` }));

// ---------- Perfil funcional ----------
export const ATTENTION_MINUTES = minuteOptions([3, 5, 8, 10, 15, 20, 30, 45]);
export const TASK_TOLERANCE_MINUTES = minuteOptions([5, 8, 10, 15, 20, 30, 45, 60]);

export const INTEREST_OPTIONS = [
  "Dinossauros", "Animais", "Futebol", "Música", "Desenhos animados", "Carros", "Trens",
  "Super-heróis", "Quebra-cabeças", "Blocos de montar", "Desenho e pintura", "Jogos eletrônicos",
  "Natureza e plantas", "Espaço e planetas", "Culinária", "Dança", "Histórias e livros",
  "Números", "Letras", "Massinha de modelar",
];

export const TRIGGER_OPTIONS = [
  "Barulho alto ou repentino", "Mudança de rotina sem aviso", "Transição entre atividades",
  "Ambiente cheio ou agitado", "Espera prolongada", "Toque inesperado", "Luz forte",
  "Cheiros fortes", "Fila", "Tarefa longa demais", "Frustração com erro", "Fome ou sono",
];

export const EARLY_SIGN_OPTIONS = [
  "Cobre os ouvidos", "Afasta o material", "Fica inquieto", "Balança o corpo",
  "Aumenta o tom de voz", "Chora", "Se isola ou se esconde", "Aperta ou morde as mãos",
  "Repete palavras ou sons", "Recusa a atividade", "Levanta e sai do lugar", "Fica em silêncio",
];

export const CALMING_OPTIONS = [
  "Antecipação visual da rotina", "Canto calmo da sala", "Pausa de movimento", "Fone abafador",
  "Objeto de conforto", "Respiração guiada", "Música tranquila", "Pressão profunda (abraço ou colete)",
  "Diminuir os estímulos da sala", "Água ou lanche", "Tempo com o adulto de referência",
  "Atividade de interesse",
];

export const STRENGTH_OPTIONS = [
  "Boa memória visual", "Aprende melhor com material concreto", "Gosta de ajudar os colegas",
  "Segue rotinas com facilidade", "Boa coordenação motora", "Criatividade nas brincadeiras",
  "Interesse intenso sustenta a atenção", "Comunica-se bem com adultos", "Persistência nas tarefas",
  "Facilidade com números", "Facilidade com tecnologia", "Gosta de música e ritmo",
];

// ---------- Plano individual ----------
export const INITIAL_SITUATION_OPTIONS = [
  "Reconhece o próprio nome com apoio de imagem", "Comunica necessidades básicas com gestos ou prancha",
  "Identifica cores e formas", "Conta objetos até 10", "Reconhece as letras do próprio nome",
  "Participa de atividades em grupo com mediação", "Segue a rotina com apoio visual",
  "Lê palavras simples", "Escreve o próprio nome", "Permanece até 10 minutos na tarefa com apoio",
  "Usa o banheiro com supervisão", "Alimenta-se com autonomia",
];

export const COMMON_ROOM_STRATEGY_OPTIONS = [
  "Sentar próximo ao professor", "Instruções curtas e uma por vez", "Apoio visual nas explicações",
  "Atividade da turma adaptada ao interesse", "Tempo adicional nas tarefas", "Pausas programadas",
  "Trabalho em dupla com colega mediador", "Antecipar mudanças da rotina",
  "Avaliação com formas variadas de resposta", "Material ampliado",
];

export const AEE_STRATEGY_OPTIONS = [
  "Comunicação alternativa e aumentativa", "Jogos pedagógicos adaptados", "Treino de rotina e autonomia",
  "Ensino estruturado", "Tecnologia assistiva", "Atividades com o interesse âncora",
  "Produção de material acessível para a sala comum", "Orientação à família", "Ensino de Libras",
  "Braille e sorobã", "Estimulação de funções cognitivas",
];

export const ACCESSIBILITY_RESOURCE_OPTIONS = [
  "Cartões com imagens", "Prancha de comunicação", "Letras ampliadas", "Engrossador de lápis",
  "Tesoura adaptada", "Fone abafador", "Mesa adaptada", "Plano inclinado", "Tablet com aplicativo de CAA",
  "Acionador", "Lupa", "Material em braille", "Intérprete de Libras", "Tiposcópio", "Calculadora falante",
];

export const DEADLINE_WEEKS = weekOptions([2, 4, 6, 8, 10, 12, 16]);

// ---------- Diário de acompanhamento ----------
export const WHAT_WORKED_OPTIONS = [
  "Mostrar uma imagem antes de explicar", "Instrução curta e uma por vez", "Usar o tema de interesse",
  "Material concreto", "Pausa antes de começar", "Modelo do professor", "Colega como mediador",
  "Aviso antecipado da transição", "Ambiente mais silencioso", "Elogio logo após a tentativa",
  "Prancha de comunicação",
];

export const RECOMMENDATION_OPTIONS = [
  "Repetir a atividade com menos ajuda", "Aumentar o número de opções", "Reduzir o tempo da tarefa",
  "Trocar o material", "Trabalhar em dupla", "Levar a atividade para a sala comum",
  "Manter o mesmo apoio", "Combinar com a família", "Incluir pausa programada",
  "Usar outro tema de interesse",
];

// ---------- Articulação intersetorial (terapeuta) ----------
export const COMMUNICATION_OPTIONS = [
  "Fala com frases curtas", "Gestos e apontar", "Prancha de comunicação (CAA)", "PECS",
  "Tablet com aplicativo de CAA", "Libras", "Olhar e expressões faciais", "Vocalizações",
  "Acionador", "Escrita",
];

export const POSITIONING_OPTIONS = [
  "Cadeira com apoio de tronco", "Apoio para os pés", "Mesa com recorte", "Plano inclinado",
  "Trocar de posição a cada 30 minutos", "Andador", "Cadeira de rodas", "Órtese",
  "Sem necessidades específicas",
];

export const FACILITATOR_OPTIONS = [
  "Rotina previsível", "Ambiente calmo", "Tema de interesse", "Apoio visual", "Adulto de referência",
  "Tempo adicional", "Pausas sensoriais", "Pequenos grupos", "Elogio logo após a tentativa",
];

export const STRATEGIES_TO_TRY_OPTIONS = [
  "Antecipar transições com 2 minutos de aviso", "Pareamento com miniaturas", "Pausa sensorial programada",
  "Instrução em etapas com apoio visual", "Escolha entre duas opções", "Temporizador visual",
  "História social antes de situações novas", "Atividade motora antes de tarefas de mesa",
];

export const SCHOOL_GUIDANCE_OPTIONS = [
  "Avisar as transições com antecedência", "Oferecer fone abafador em momentos de barulho",
  "Manter a prancha sempre ao alcance", "Reduzir estímulos visuais perto da mesa",
  "Permitir pausas quando solicitar", "Usar frases curtas", "Combinar um sinal para pedir ajuda",
  "Evitar toque sem aviso",
];

export const SHARED_GOAL_OPTIONS = [
  "Pedir ajuda usando a prancha", "Ampliar o tempo de permanência na atividade",
  "Ganhar autonomia na alimentação", "Ganhar autonomia na higiene",
  "Aceitar mudanças de rotina com apoio", "Brincar com os colegas", "Ampliar o vocabulário",
  "Reconhecer o próprio nome",
];

// ---------- Portal da família ----------
export const FAMILY_ACHIEVEMENT_OPTIONS = [
  "Pediu algo usando a prancha", "Comeu sem ajuda", "Vestiu-se com pouca ajuda",
  "Brincou com outra criança", "Contou como foi o dia na escola", "Esperou a vez em uma brincadeira",
  "Usou o banheiro com autonomia", "Reconheceu o próprio nome", "Aceitou uma mudança de rotina",
  "Dormiu melhor", "Experimentou um alimento novo",
];

export const FAMILY_MEMBER_OPTIONS = [
  "Mãe", "Pai", "Avó", "Avô", "Irmã", "Irmão", "Tia", "Tio", "Responsável legal", "Cuidador(a)",
];

// ---------- Cadastros e matrícula ----------
export const REGION_OPTIONS = ["Centro", "Zona Norte", "Zona Sul", "Zona Leste", "Zona Oeste", "Zona Rural"];

export const CLASS_NAME_OPTIONS = ["Turma A", "Turma B", "Turma C", "Turma D", "Turma E", "Turma F"];

export const GRADE_YEAR_OPTIONS = [
  "Berçário", "Maternal", "Pré I", "Pré II",
  "1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano", "7º ano", "8º ano", "9º ano",
  "1ª série (Ensino Médio)", "2ª série (Ensino Médio)", "3ª série (Ensino Médio)",
  "EJA — anos iniciais", "EJA — anos finais",
];

// Anos/séries de cada etapa, para o cadastro mostrar só o que faz sentido.
export const GRADES_BY_STAGE: Record<string, string[]> = {
  educacao_infantil: GRADE_YEAR_OPTIONS.slice(0, 4),
  anos_iniciais: GRADE_YEAR_OPTIONS.slice(4, 9),
  anos_finais: GRADE_YEAR_OPTIONS.slice(9, 13),
  ensino_medio: GRADE_YEAR_OPTIONS.slice(13, 16),
  eja: GRADE_YEAR_OPTIONS.slice(16),
};

export const AEE_FREQUENCY_OPTIONS = [
  "1 vez por semana", "2 vezes por semana", "3 vezes por semana", "4 vezes por semana",
  "Todos os dias", "A cada 15 dias",
];

export const ACCESSIBILITY_NOTE_OPTIONS = [
  "Usa prancha de comunicação", "Precisa de mesa adaptada", "Usa cadeira de rodas",
  "Precisa de transporte acessível", "Usa fone abafador", "Precisa de material ampliado",
  "Precisa de intérprete de Libras", "Usa óculos", "Precisa de apoio na alimentação",
  "Precisa de apoio na higiene", "Tem restrição alimentar",
];

// ---------- Atividades ----------
export const REJECT_REASON_OPTIONS = [
  "Não temos o material necessário", "Difícil demais para o momento", "Fácil demais para o momento",
  "Não combina com o tema da aula", "Tempo de aula insuficiente", "Não respeita o perfil sensorial",
  "Já foi aplicada recentemente", "Precisa de mais apoio do que temos",
];

export const LESSON_TOPIC_OPTIONS = [
  "Chamada e nomes da turma", "Leitura de palavras", "Produção de texto", "Alfabeto e letras",
  "Números e contagem", "Adição e subtração", "Frações", "Formas geométricas", "Seres vivos",
  "Corpo humano", "Família e comunidade", "Datas comemorativas", "Artes e cores",
  "Educação física e jogos",
];

// Separa uma resposta gravada como texto em itens. Campos de texto livre usam
// ";" (o item digitado pode ter vírgula); o perfil funcional usa vírgula.
export function splitItems(value: string | null | undefined, separator: "," | ";" = ";"): string[] {
  const pattern = separator === "," ? /[,;\n]/ : /[;\n]/;
  return (value ?? "").split(pattern).map((item) => item.trim()).filter(Boolean);
}
