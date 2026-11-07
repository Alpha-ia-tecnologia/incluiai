import type { ActivityPrintPack, PrintableCard, PrintableSheet } from "./resource-print-types";

const resources = [
  "Padrões e sequências investigativas",
  "Classificação e pistas lógicas",
  "Conversas com escolhas e comentários",
  "Planejar o lanche com autonomia",
  "Brincadeiras de turnos e colaboração",
  "Diário de observação da natureza",
  "Ateliê de marcas e texturas",
  "Mapas táteis e leitura do espaço",
  "Textos do cotidiano: avisos e trajetos",
  "Orçamento e compras com dinheiro fictício",
  "Laboratório de perguntas e investigação",
  "Projeto coletivo: ideias para a escola",
] as const;

const pack = (resource: number, activityTitle: string, ...sheets: PrintableSheet[]): ActivityPrintPack => ({ resourceTitle: resources[resource], activityTitle, sheets });
const cards = (title: string, instruction: string, items: PrintableCard[], columns: 2 | 3 | 4 = 3): PrintableSheet => ({ kind: "cards", title, instruction, cards: items, columns });
const worksheet = (title: string, instruction: string, fields: { label: string; lines?: 1 | 2 | 3 }[]): PrintableSheet => ({ kind: "worksheet", title, instruction, fields });
const table = (title: string, instruction: string, columns: string[], rows: string[][]): PrintableSheet => ({ kind: "table", title, instruction, columns, rows });
const text = (title: string, instruction: string, paragraphs: string[]): PrintableSheet => ({ kind: "text", title, instruction, paragraphs });
const map = (title: string, instruction: string, places: [string, string, string], route: string[]): PrintableSheet => ({ kind: "map", title, instruction, places, route });
const words = (...labels: string[]): PrintableCard[] => labels.map((label) => ({ label }));
const photo = (label: string, asset: string, alt: string): PrintableCard => ({ label, image: `/images/games/${asset}.webp`, alt });
const newPhoto = (label: string, asset: string, alt: string): PrintableCard => ({ label, image: `/images/activities/cards/${asset}.webp`, alt });
const frame = (label: string, blank: string): PrintableCard => ({ label, blank });
const shape = (label: string, form: PrintableCard["shape"], tone: PrintableCard["tone"]): PrintableCard => ({ label, shape: form, tone });
const apple = () => photo("Maçã", "apple", "Uma maçã vermelha inteira.");
const banana = () => photo("Banana", "banana", "Uma banana amarela.");
const orange = () => photo("Laranja", "orange", "Uma laranja inteira.");
const ball = () => photo("Bola", "ball", "Uma bola azul.");
const book = () => photo("Livro", "book", "Um livro fechado com capa vermelha.");
const pencil = () => photo("Lápis", "legacy/lapis", "Um lápis amarelo com borracha na ponta.");
const backpack = () => photo("Mochila", "backpack", "Uma mochila verde.");
const cup = () => newPhoto("Copo", "copo", "Um copo vazio.");
const plate = () => newPhoto("Prato", "prato", "Um prato vazio.");
const napkin = () => newPhoto("Guardanapo", "guardanapo", "Um guardanapo dobrado.");
const turnCards = () => words("MINHA VEZ", "SUA VEZ", "PODEMOS FAZER JUNTOS", "PRECISO DE AJUDA", "QUERO MUDAR", "QUERO PARAR");
const groceryCards = (): PrintableCard[] => [
  { label: "Arroz — preço fictício: R$ 8" },
  { label: "Feijão — preço fictício: R$ 7" },
  { label: "Sabão — preço fictício: R$ 4" },
  { ...apple(), label: "Fruta — preço fictício: R$ 3" },
];

export const PRINT_CATALOG_B: ActivityPrintPack[] = [
  pack(0, "Qual trecho está se repetindo?",
    text("Uma sequência para completar", "Leia a sequência ou apresente as peças correspondentes. Recorte os cartões da próxima folha e continue o padrão sobre a mesa.", [
      "CÍRCULO — QUADRADO — CÍRCULO — QUADRADO — ______ — ______",
      "Qual trecho reaparece? Separe duas peças para mostrar a unidade que se repete.",
      "Depois, escolha as duas peças que completam os espaços. O nome e o contorno das formas ajudam, além da cor.",
    ]),
    cards("Peças da sequência", "Recorte as seis peças. Use três círculos e três quadrados para montar e continuar a sequência; não é necessário colar.", [
      shape("Círculo", "circle", "red"), shape("Quadrado", "square", "blue"),
      shape("Círculo", "circle", "red"), shape("Quadrado", "square", "blue"),
      shape("Círculo", "circle", "red"), shape("Quadrado", "square", "blue"),
    ]),
    worksheet("Como reconheci a repetição", "Registre com desenho, escrita ou ditado depois de organizar as peças.", [
      { label: "O trecho que se repete é:", lines: 2 },
      { label: "As duas peças que escolhi para continuar são:", lines: 2 },
      { label: "Expliquei ou mostrei a regra assim:", lines: 2 },
    ])),
  pack(0, "Um padrão criado por mim",
    cards("Formas para inventar um padrão", "Recorte e escolha duas ou três formas. Monte uma repetição sobre a mesa e convide um parceiro a continuá-la.", [
      shape("Círculo", "circle", "red"), shape("Quadrado", "square", "blue"), shape("Triângulo", "triangle", "yellow"),
      shape("Círculo", "circle", "red"), shape("Quadrado", "square", "blue"), shape("Triângulo", "triangle", "yellow"),
      shape("Círculo", "circle", "red"), shape("Quadrado", "square", "blue"), shape("Triângulo", "triangle", "yellow"),
    ]),
    cards("Decisões do autor", "Mantenha estas mensagens disponíveis para explicar e revisar o padrão. O parceiro pode ler as mensagens em voz alta.", words("QUERO REPETIR", "QUERO TROCAR", "PODE CONTINUAR", "ESTA É A MINHA REGRA", "PRECISO DE AJUDA", "QUERO PARAR")),
    worksheet("Meu padrão e a continuação", "Desenhe ou descreva a unidade de repetição. Registre também uma decisão sobre a continuação feita pelo parceiro.", [
      { label: "Minha unidade de repetição:", lines: 3 },
      { label: "O parceiro continuou assim:", lines: 2 },
      { label: "Quero manter ou mudar:", lines: 2 },
    ])),
  pack(0, "Padrões em objetos de casa",
    cards("Livro e bola: uma repetição possível", "Recorte as fotos e organize livro, bola, livro, bola. Escolha como continuar. Você também pode usar dois tipos de objetos reais que já tenha em casa.", [book(), ball(), book(), ball(), book(), ball()]),
    worksheet("Uma regra escolhida em casa", "Um familiar pode registrar a explicação pelo meio de comunicação utilizado. Não é necessário comprar materiais ou enviar fotografia.", [
      { label: "Os dois tipos de objeto que escolhemos:", lines: 1 },
      { label: "Nossa sequência, desenhada ou descrita:", lines: 3 },
      { label: "O que vem depois? Como descobrimos?", lines: 2 },
    ])),

  pack(1, "Uma coleção, dois critérios",
    cards("Uma coleção para reorganizar", "Recorte as oito fotos e organize os grupos usando uma regra. Depois reorganize a mesma coleção com outra regra.", [
      apple(), banana(), orange(), photo("Pão", "legacy/pao", "Um pão francês inteiro."),
      book(), pencil(), photo("Régua", "legacy/regua", "Uma régua de madeira."), backpack(),
    ], 4),
    cards("Critérios e rótulos de grupo", "Escolha um critério ou escreva outro. Um mesmo objeto pode participar de grupos diferentes quando a regra muda.", [
      ...words("É UM ALIMENTO", "USAMOS NA ESCOLA", "TEM CONTORNO ARREDONDADO", "TEM FORMA ALONGADA"),
      frame("GRUPO 1", "Escreva o nome ou a regra deste grupo."), frame("GRUPO 2", "Escreva o nome ou a regra deste grupo."),
    ], 2),
    worksheet("Duas organizações da mesma coleção", "Registre quais fotos entraram em cada grupo. Aceite critérios diferentes quando houver uma explicação coerente.", [
      { label: "Primeira regra e grupos que formamos:", lines: 3 },
      { label: "Segunda regra e grupos que formamos:", lines: 3 },
      { label: "Uma foto que mudou de grupo e por quê:", lines: 2 },
    ])),
  pack(1, "Eliminar opções com pistas",
    cards("Quatro opções para investigar", "Recorte as fotos e deixe todas visíveis. Use uma pista por vez para manter ou retirar opções.", [apple(), ball(), book(), pencil()], 2),
    cards("Pistas e respostas", "Para procurar a maçã, combine “é vermelho” e “tem contorno arredondado”. Para procurar o livro, combine “tem páginas” e “usamos para ler”. O parceiro lê as pistas se necessário.", words(
      "É VERMELHO", "TEM CONTORNO ARREDONDADO", "TEM PÁGINAS", "USAMOS PARA LER", "SIM", "NÃO", "PRECISO CONFERIR", "QUERO OUVIR DE NOVO",
    ), 2),
    table("Quais opções permaneceram?", "Anote a pista e as fotos que permaneceram ou foram retiradas. Não é necessário acertar sem apoio.", ["Pista apresentada", "Fotos mantidas", "Fotos retiradas"], [["", "", ""], ["", "", ""], ["", "", ""]])),
  pack(1, "Organizar e explicar um conjunto",
    cards("Fotos para escolher um conjunto", "Escolha quatro a seis cartões ou objetos equivalentes disponíveis em casa. Decida uma forma de organizá-los e explique sua regra.", [apple(), orange(), book(), pencil(), ball(), backpack()]),
    worksheet("Minha forma de organizar", "Use desenho, escrita ou ditado. O familiar pode mover os objetos conforme as decisões de quem está organizando.", [
      { label: "Quais objetos escolhi?", lines: 2 },
      { label: "Qual foi a minha regra?", lines: 2 },
      { label: "Como os grupos ficaram?", lines: 3 },
      { label: "O que quero manter ou reorganizar?", lines: 2 },
    ])),

  pack(2, "Uma escolha que pode mudar",
    cards("Duas opções para explorar", "Ofereça estas opções somente se livro e bola estiverem disponíveis. Use as molduras para substituir pelas duas opções reais escolhidas para o encontro.", [
      { ...book(), label: "Ler ou explorar um livro" }, { ...ball(), label: "Brincar com uma bola" },
      frame("Outra opção real 1", "Adicione uma foto, um desenho ou o nome da opção disponível."),
      frame("Outra opção real 2", "Adicione uma foto, um desenho ou o nome da opção disponível."),
    ], 2),
    cards("Posso escolher e mudar de ideia", "Recorte ou use como uma prancha. Leia as mensagens, aguarde a resposta e confirme a escolha pelo canal de comunicação habitual.", words("EU ESCOLHO ESTA", "QUERO CONHECER A OUTRA", "NÃO QUERO NENHUMA", "GOSTEI", "QUERO TROCAR", "QUERO TERMINAR"), 2)),
  pack(2, "Comentário com um parceiro atento",
    cards("Um assunto para a conversa", "Escolha a flor, o livro ou um assunto que faça sentido para os participantes. A foto inicia a conversa; não há comentário esperado.", [
      photo("Flor", "legacy/flor", "Uma flor amarela com haste e folhas verdes."), book(), frame("Nosso assunto", "Acrescente uma imagem autorizada ou uma palavra escolhida pelos participantes."),
    ]),
    cards("Comentários e convites para responder", "Deixe as mensagens disponíveis durante a conversa. O parceiro responde ao comentário e também pode fazer uma pergunta.", words("GOSTEI DISSO", "ACHEI DIFERENTE", "NÃO SEI", "TENHO UMA PERGUNTA", "E VOCÊ?", "QUERO TERMINAR"), 2)),
  pack(2, "Minha opinião sobre uma escolha da família",
    cards("As opções reais da família", "Preencha antes de conversar, com duas opções possíveis de brincadeira, música ou leitura. Não use nomes ou imagens pessoais sem autorização.", [
      frame("OPÇÃO 1", "Cole uma imagem, desenhe ou escreva o nome da primeira opção."),
      frame("OPÇÃO 2", "Cole uma imagem, desenhe ou escreva o nome da segunda opção."),
    ], 2),
    cards("Minha opinião também conta", "Use as mensagens na conversa, com leitura pelo parceiro quando necessário. Uma recusa ou mudança de ideia também recebe resposta.", words("PREFIRO ESTA", "TENHO OUTRA IDEIA", "NÃO QUERO AGORA", "QUERO SABER MAIS", "QUERO MUDAR MINHA ESCOLHA", "E VOCÊ, O QUE PREFERE?"), 2)),

  pack(3, "O que precisamos para organizar a mesa?",
    cards("Utensílios do lanche de simulação", "Recorte as fotos e escolha os utensílios que deseja usar. A atividade pode acontecer com embalagens e objetos, sem comer ou provar alimentos.", [cup(), plate(), napkin()]),
    cards("Etapas e mensagens para organizar", "Coloque as etapas na ordem escolhida e mantenha as mensagens de apoio disponíveis. As fotos dos utensílios podem ser colocadas junto de cada etapa.", words("ESCOLHER OS UTENSÍLIOS", "ORGANIZAR A MESA", "GUARDAR AO TERMINAR", "EU ESCOLHO", "PRECISO DE AJUDA", "QUERO PARAR"), 2),
    table("Como quero organizar minha mesa?", "Marque a escolha e descreva ou desenhe o lugar de cada utensílio. Um parceiro pode registrar as decisões.", ["Utensílio", "Quero usar?", "Onde desejo colocar?"], [["Copo", "", ""], ["Prato", "", ""], ["Guardanapo", "", ""]])),
  pack(3, "Sequência de organização e pedido de ajuda",
    cards("Utensílios para relacionar às etapas", "Use os cartões junto dos utensílios reais e das três etapas de organização. O estudante pode orientar um parceiro a movimentar os objetos.", [cup(), plate(), napkin()]),
    cards("Uma sequência com apoio escolhido", "Recorte e organize escolher, organizar e guardar. Depois indique em qual etapa deseja fazer junto, pedir ajuda ou parar.", words("1. ESCOLHER", "2. ORGANIZAR", "3. GUARDAR", "QUERO FAZER JUNTO", "PRECISO DE AJUDA", "QUERO PARAR"), 2),
    table("Que apoio quero em cada etapa?", "Registre as preferências expressas; não é necessário reduzir o apoio para concluir a proposta.", ["Etapa", "Como desejo participar", "Apoio que escolhi"], [["Escolher", "", ""], ["Organizar", "", ""], ["Guardar", "", ""]])),
  pack(3, "Participar do planejamento do próprio lanche",
    cards("Opções para um planejamento possível", "Escolha somente as opções autorizadas e disponíveis em casa. As fotografias podem ser usadas em uma simulação, sem consumo.", [
      apple(), banana(), cup(), plate(), napkin(), newPhoto("Água", "agua", "Um copo com água."),
    ]),
    cards("Decisões sobre meu lanche", "Leia as mensagens se necessário e confirme a decisão. O familiar pode organizar os materiais conforme a orientação recebida.", words("EU ESCOLHO ESTE", "QUERO OUTRA OPÇÃO", "NÃO QUERO", "PRECISO DE AJUDA", "QUERO ORGANIZAR ASSIM", "TERMINEI"), 2)),

  pack(4, "Uma construção com papéis escolhidos",
    cards("Um modelo de peças para combinar", "Use os cartões para escolher peças e posições de uma construção com blocos. Também é possível montar uma composição plana com as peças de papel recortadas.", [
      shape("Peça retangular 1", "rectangle", "blue"), shape("Peça retangular 2", "rectangle", "blue"), shape("Peça retangular 3", "rectangle", "red"),
      shape("Peça quadrada 1", "square", "yellow"), shape("Peça quadrada 2", "square", "yellow"), shape("Peça triangular", "triangle", "green"),
    ]),
    cards("Turnos e funções escolhidas", "Mantenha os cartões próximos da construção. Cada participante pode escolher uma peça, indicar sua posição, orientar um parceiro ou observar.", turnCards(), 2),
    worksheet("Decisões da nossa construção", "Desenhe ou descreva duas decisões tomadas pelos participantes. A construção pode mudar durante a brincadeira.", [
      { label: "A função que escolhi:", lines: 1 },
      { label: "Uma peça e a posição que indiquei:", lines: 2 },
      { label: "Uma decisão que fizemos juntos:", lines: 2 },
      { label: "O que quero mudar na construção:", lines: 2 },
    ])),
  pack(4, "Um jogo que o grupo pode adaptar",
    map("Um percurso curto para jogar junto", "Use o percurso como base de uma brincadeira sem eliminação. Comece no início e combine como cada participante indicará um movimento até a chegada.", ["Início", "Casa do meio", "Chegada"], ["Início", "Casa do meio", "Chegada"]),
    cards("Peças, movimentos e regras de acesso", "Recorte os marcadores. Combine uma regra de movimento e permita que um parceiro mova a peça conforme a orientação de quem está no turno.", [
      ...words("MINHA PEÇA", "PEÇA DO PARCEIRO", "AVANÇAR UMA CASA", "FAZER O MOVIMENTO JUNTO", "PEDIR AJUDA", "QUERO PARAR"),
    ], 2),
    worksheet("A regra que escolhemos", "Registre como o grupo adaptou a brincadeira. Rever uma regra faz parte do jogo.", [
      { label: "Como cada participante escolhe o movimento?", lines: 2 },
      { label: "Quem movimenta a peça, se houver apoio?", lines: 1 },
      { label: "Como comunicamos turno, ajuda ou encerramento?", lines: 2 },
      { label: "Que regra queremos manter ou mudar?", lines: 2 },
    ])),
  pack(4, "Brincadeira curta com um familiar",
    cards("Uma escolha para brincar junto", "Use a foto da bola se esse material estiver disponível. Na moldura, acrescente outro material que a família já tenha e queira oferecer.", [ball(), frame("Outra brincadeira disponível", "Acrescente uma foto, um desenho ou o nome do material escolhido.")], 2),
    cards("Turnos em uma brincadeira curta", "Deixe as mensagens ao alcance e aceite continuar, mudar, observar ou parar. O familiar pode ler e confirmar cada mensagem.", words("MINHA VEZ", "SUA VEZ", "QUERO MAIS", "QUERO MUDAR", "QUERO OBSERVAR", "QUERO PARAR"), 2)),

  pack(5, "Uma folha, várias maneiras de observar",
    cards("Uma folha para observar em imagem", "Use esta foto ou uma folha segura já disponível. Escolha observação visual, descrição oral ou toque opcional no material real.", [photo("Folha", "legacy/folha", "Uma folha verde com nervuras visíveis.")], 2),
    worksheet("Ficha de observação de uma folha", "Registre duas características observadas. Desenho, escrita, ditado ou seleção de palavras são possibilidades.", [
      { label: "Data e lugar da observação:", lines: 1 },
      { label: "Observei uma folha real ou uma imagem?", lines: 1 },
      { label: "Primeira característica percebida:", lines: 2 },
      { label: "Segunda característica percebida:", lines: 2 },
      { label: "Uma pergunta que surgiu:", lines: 2 },
    ])),
  pack(5, "O que mudou entre dois registros?",
    cards("Dois registros da mesma planta", "Preencha as molduras com registros da mesma planta em dois dias. Não use fotos de plantas diferentes como se fossem uma sequência de crescimento.", [
      frame("REGISTRO 1 — DATA: ______", "Acrescente a primeira foto, o desenho ou uma descrição da planta."),
      frame("REGISTRO 2 — DATA: ______", "Acrescente a segunda foto, o desenho ou uma descrição da mesma planta."),
    ], 2),
    table("Compare o que foi registrado", "Consulte os dois registros e descreva o que mudou ou permaneceu. Quando os registros não permitem concluir, indique a dúvida.", ["Característica", "Primeiro registro", "Segundo registro"], [["Forma ou posição", "", ""], ["Cor ou outra característica", "", ""], ["Informação que ainda falta", "", ""]]),
    cards("Mensagens para comparar", "Use as mensagens depois de olhar, ouvir ou explorar os registros pelo meio de acesso escolhido.", words("MUDOU", "PERMANECEU", "NÃO SEI", "QUERO CONFERIR DE NOVO", "TENHO UMA PERGUNTA", "QUERO PARAR"), 2)),
  pack(5, "Uma observação pela janela ou em imagem",
    cards("Escolha um elemento natural", "Escolha uma das imagens ou observe um elemento acessível pela janela. Não é preciso sair de casa ou coletar materiais.", [
      photo("Árvore", "legacy/arvore", "Uma árvore de copa verde em um campo."),
      photo("Flor", "legacy/flor", "Uma flor amarela com haste e folhas verdes."),
      photo("Folha", "legacy/folha", "Uma folha verde com nervuras visíveis."),
    ]),
    worksheet("O que observei perto de mim", "Um familiar pode registrar o que foi comunicado. Uma observação e uma pergunta são suficientes.", [
      { label: "O elemento que escolhi:", lines: 1 },
      { label: "Uma característica que percebi:", lines: 2 },
      { label: "Uma pergunta que quero fazer:", lines: 2 },
      { label: "Como preferi observar ou comunicar:", lines: 1 },
    ])),

  pack(6, "Que marcas cada instrumento deixa?",
    worksheet("Marcas de dois instrumentos", "Experimente ou observe as marcas feitas com rolo e pincel. Use cada área para desenhar uma marca, fazer a marca com o instrumento ou descrever o que percebeu.", [
      { label: "ROLO — uma marca que observei ou escolhi fazer:", lines: 3 },
      { label: "PINCEL — uma marca que observei ou escolhi fazer:", lines: 3 },
      { label: "Uma diferença entre as marcas:", lines: 2 },
    ]),
    cards("Escolhas durante a criação", "Leia as mensagens quando necessário e siga as decisões de quem está criando. Observar também é uma forma possível de participar.", words("ESCOLHO O ROLO", "ESCOLHO O PINCEL", "QUERO OUTRA MARCA", "QUERO MUDAR A POSIÇÃO", "QUERO OBSERVAR", "QUERO TERMINAR"), 2)),
  pack(6, "Uma composição com formas escolhidas",
    cards("Formas para recortar e compor", "Recorte as formas e escolha quais quer usar. Teste as posições antes de fixar na base; a cor não precisa ser o critério da escolha.", [
      shape("Círculo 1", "circle", "red"), shape("Círculo 2", "circle", "blue"), shape("Círculo 3", "circle", "yellow"), shape("Círculo 4", "circle", "green"),
      shape("Quadrado 1", "square", "red"), shape("Quadrado 2", "square", "blue"), shape("Quadrado 3", "square", "yellow"), shape("Quadrado 4", "square", "green"),
      shape("Triângulo 1", "triangle", "red"), shape("Triângulo 2", "triangle", "blue"), shape("Triângulo 3", "triangle", "yellow"), shape("Triângulo 4", "triangle", "green"),
    ], 4),
    worksheet("Decisões da minha composição", "Faça a composição em uma base separada e use esta ficha para registrar escolhas. Um parceiro pode recortar, mover e fixar as peças conforme a orientação recebida.", [
      { label: "Quais formas escolhi?", lines: 2 },
      { label: "Uma posição que quero manter ou mudar:", lines: 2 },
      { label: "Título que escolho, se desejar:", lines: 1 },
      { label: "O que desejo contar sobre minha criação:", lines: 2 },
    ])),
  pack(6, "Coleção de marcas em papel",
    worksheet("Duas possibilidades de fazer marcas", "Use os espaços para experimentar com materiais já disponíveis, desenhar a marca observada ou ditar uma descrição. Não há figura para copiar.", [
      { label: "Primeira escolha de instrumento ou superfície:", lines: 1 },
      { label: "Marca ou descrição da primeira escolha:", lines: 3 },
      { label: "Segunda escolha de instrumento ou superfície:", lines: 1 },
      { label: "Marca ou descrição da segunda escolha:", lines: 3 },
      { label: "O que prefiro manter, mudar ou encerrar:", lines: 2 },
    ]),
    cards("Preferências do autor", "O familiar pode ler as opções e registrar a mensagem confirmada, sem exigir desenho figurativo nem toque em texturas.", words("PREFIRO A PRIMEIRA", "PREFIRO A SEGUNDA", "QUERO MISTURAR AS DUAS", "QUERO OUTRA OPÇÃO", "QUERO OBSERVAR", "QUERO TERMINAR"), 2)),

  pack(7, "Um percurso escolar em uma base",
    map("Mapa de exemplo para adaptar", "Este percurso é fictício: sala, biblioteca e pátio. Localize partida, referência e chegada; adapte os nomes e o caminho antes de representar um percurso real da escola.", ["Sala", "Biblioteca", "Pátio"], ["Sala", "Biblioteca", "Pátio"]),
    cards("Legenda e marcadores do percurso", "Recorte os marcadores e combine seus significados. No mapa real, acrescente relevo apenas se esse for um modo de acesso escolhido pelos leitores.", [
      shape("PONTO DE PARTIDA", "circle", "blue"), shape("REFERÊNCIA DO CAMINHO", "square", "yellow"), shape("PONTO DE CHEGADA", "triangle", "green"),
      ...words("SALA", "BIBLIOTECA", "PÁTIO"),
    ]),
    worksheet("Meu percurso conhecido", "Registre com os leitores como adaptar o exemplo à escola. A representação não exige realizar o deslocamento.", [
      { label: "Partida e chegada do percurso escolhido:", lines: 1 },
      { label: "Duas referências e sua ordem no caminho:", lines: 2 },
      { label: "Como combinamos a legenda:", lines: 2 },
      { label: "Uma informação que o leitor pediu para esclarecer:", lines: 2 },
    ])),
  pack(7, "A legenda ajuda a encontrar o caminho?",
    map("Um mapa com informação a conferir", "Mapa fictício para investigação: um lugar está sem identificação. Compare o desenho, a legenda e os rótulos disponíveis antes de propor uma revisão.", ["Sala", "Local sem identificação", "Pátio"], ["Sala", "Local sem identificação", "Pátio"]),
    cards("Rótulos e mensagens de revisão", "Escolha um rótulo possível somente depois de combinar qual lugar o mapa representa. Há mais de uma possibilidade até que essa informação seja confirmada.", words("SALA", "BIBLIOTECA", "PÁTIO", "FALTA INFORMAÇÃO", "PRECISO CONFERIR", "QUERO REVISAR"), 2),
    worksheet("A revisão que ajuda o leitor", "Anote ou dite o que estava pouco claro e como a informação foi conferida.", [
      { label: "O que consegui localizar usando a legenda:", lines: 2 },
      { label: "A informação que faltava:", lines: 2 },
      { label: "Como conferimos o nome ou a posição:", lines: 2 },
      { label: "Minha proposta de revisão:", lines: 2 },
    ])),
  pack(7, "Mapa de uma mesa imaginária",
    cards("Objetos para inventar uma mesa", "Recorte as fotos ou use objetos equivalentes. Combine qual lado será a referência de quem vai ler o mapa antes de organizar as posições.", [book(), pencil(), ball()]),
    table("Posições da mesa imaginária", "Organize uma mesa para um personagem, sem representar uma residência real. Descreva as posições em relação à referência combinada.", ["Objeto", "Posição que escolhi", "O que o leitor entendeu"], [["Livro", "", ""], ["Lápis", "", ""], ["Bola", "", ""]]),
    worksheet("Desenho ou descrição do meu mapa", "Desenhe a mesa ou dite a descrição. Uma informação pode ser revista depois da leitura pelo parceiro.", [
      { label: "Referência de quem lê: qual lado da mesa?", lines: 1 },
      { label: "Mapa da mesa imaginária:", lines: 3 },
      { label: "O que quero conferir ou revisar:", lines: 2 },
    ])),

  pack(8, "O que este aviso informa?",
    text("Aviso fictício para leitura", "Este aviso foi criado para estudo. Leia ou ouça o texto e consulte as informações ao responder à ficha.", [
      "OFICINA DE LEITURA",
      "Dia: 14 de maio. Horário: das 18h às 19h.",
      "Local: biblioteca da escola.",
      "Leve um texto que queira compartilhar.",
      "O aviso não apresenta informações sobre inscrição. Que pergunta você faria antes de participar?",
    ]),
    worksheet("Localizar informações em um aviso", "Você pode marcar o aviso, responder oralmente, apontar partes do texto ou ditar para um parceiro registrar.", [
      { label: "Qual é a atividade anunciada?", lines: 1 },
      { label: "Em qual dia e horário acontece?", lines: 1 },
      { label: "Qual é o local?", lines: 1 },
      { label: "O que o aviso pede para levar?", lines: 1 },
      { label: "Que informação falta ou precisa ser esclarecida?", lines: 2 },
    ])),
  pack(8, "Conferir orientações de um trajeto",
    map("Um trajeto fictício dentro da escola", "Use este mapa apenas como material de leitura. Localize sala, biblioteca e pátio seguindo o caminho representado.", ["Sala", "Biblioteca", "Pátio"], ["Sala", "Biblioteca", "Pátio"]),
    text("Três orientações para conferir", "Relacione cada orientação ao mapa. Uma delas usa uma palavra que não identifica o lugar de chegada com clareza.", [
      "1. Comece na sala.",
      "2. Siga pelo caminho até a biblioteca.",
      "3. Depois, vá para lá.",
      "Que lugar “lá” poderia indicar? Reescreva a última orientação com o nome do lugar que foi combinado.",
    ]),
    worksheet("Uma orientação mais clara", "Um leitor pode percorrer o mapa com um marcador, enquanto outra pessoa registra a revisão.", [
      { label: "O ponto de partida é:", lines: 1 },
      { label: "A palavra ou informação que ficou pouco clara:", lines: 1 },
      { label: "Minha nova versão da última orientação:", lines: 2 },
      { label: "O leitor chegou ao lugar combinado? O que precisamos conferir?", lines: 2 },
    ])),
  pack(8, "Uma orientação que outra pessoa entende",
    cards("Ações para escrever uma orientação", "Use as palavras como referência e escolha um objeto real simples. A moldura pode receber uma foto, desenho ou nome desse objeto.", [
      book(), frame("Objeto que escolhemos", "Acrescente uma foto, um desenho ou o nome do objeto disponível."),
      ...words("PEGUE", "ABRA", "COLOQUE", "FECHE", "CONFIRA", "REVISE"),
    ], 2),
    worksheet("Escrever, testar e revisar", "Escolha uma situação cotidiana, como organizar um livro ou uma pasta. O leitor confere a clareza sem precisar adivinhar o que fazer.", [
      { label: "A situação e o objeto que escolhemos:", lines: 1 },
      { label: "Minha primeira orientação:", lines: 3 },
      { label: "O que o leitor compreendeu ou perguntou:", lines: 2 },
      { label: "Minha orientação revisada:", lines: 3 },
    ])),

  pack(9, "Duas compras dentro do orçamento",
    cards("Mercado de simulação: quatro preços", "Recorte as etiquetas e escolha dois itens. Todos os preços são fictícios e servem somente para esta atividade.", groceryCards(), 2),
    cards("Dinheiro fictício para compor valores", "Recorte os cartões e use-os para representar os valores da simulação. Estes cartões não são dinheiro verdadeiro.", [
      ...Array.from({ length: 4 }, (): PrintableCard => ({ label: "R$ 1 — FICTÍCIO" })),
      ...Array.from({ length: 2 }, (): PrintableCard => ({ label: "R$ 2 — FICTÍCIO" })),
      ...Array.from({ length: 2 }, (): PrintableCard => ({ label: "R$ 5 — FICTÍCIO" })),
      { label: "R$ 10 — FICTÍCIO" }, { label: "ORÇAMENTO: R$ 20 — FICTÍCIO" },
    ], 4),
    table("Minha compra com orçamento de vinte reais", "Registre dois itens, calcule o total e confira se cabe no orçamento fictício de R$ 20. Calculadora e contagem representada são permitidas.", ["Registro da simulação", "Item ou valor fictício"], [["Primeiro item e preço", ""], ["Segundo item e preço", ""], ["Total da compra", ""], ["O total cabe em R$ 20?", ""], ["Quanto sobra?", ""]])),
  pack(9, "Conferir o troco da simulação",
    cards("Preço, pagamento e unidades fictícias", "Separe o preço e o pagamento. Use os dez cartões de um real para representar quanto fica com a compra e quanto retorna como troco.", [
      { label: "PREÇO FICTÍCIO: R$ 7" }, { label: "PAGAMENTO FICTÍCIO: R$ 10" },
      ...Array.from({ length: 10 }, (): PrintableCard => ({ label: "R$ 1 — FICTÍCIO", quantity: 1 })),
    ], 4),
    table("Registro do troco fictício", "Preencha os valores e confira o troco com cartões ou calculadora. Não use informações financeiras da família.", ["Preço fictício", "Pagamento fictício", "Troco encontrado"], [["", "", ""]]),
    worksheet("Conferir por outra estratégia", "Explique, desenhe ou mostre com os cartões a relação entre preço, troco e pagamento.", [
      { label: "Como encontrei o troco:", lines: 2 },
      { label: "Minha conferência: preço + troco = pagamento", lines: 2 },
      { label: "O que conferi ou revisei usando outra estratégia:", lines: 2 },
    ])),
  pack(9, "Comparar dois planos de compra fictícios",
    cards("Preços para consultar", "Use as etiquetas como referência ao comparar os dois planos. Os valores são inventados para a atividade.", groceryCards(), 2),
    text("Duas listas inventadas", "Calcule o total de cada plano e combine um critério de escolha antes de decidir. Nenhuma lista representa compras reais de uma família.", [
      "PLANO A: arroz por R$ 8 e feijão por R$ 7. Total: __________.",
      "PLANO B: arroz por R$ 8 e sabão por R$ 4. Total: __________.",
      "Critérios possíveis para discutir: menor total, dois alimentos ou outro critério que o grupo definir.",
    ]),
    worksheet("Comparar e explicar minha escolha", "A escolha deve ser coerente com o critério combinado. Um parceiro pode registrar uma explicação comunicada por fala, olhar, gesto ou CAA.", [
      { label: "O critério que combinamos:", lines: 1 },
      { label: "Total fictício do plano A:", lines: 1 },
      { label: "Total fictício do plano B:", lines: 1 },
      { label: "O plano que escolho:", lines: 1 },
      { label: "Como minha escolha se relaciona ao critério:", lines: 2 },
    ])),

  pack(10, "Como a posição da luz muda uma sombra?",
    worksheet("Planejar a investigação da sombra", "Escolha duas posições da lanterna. Mantenha o mesmo objeto e a mesma superfície e registre a previsão antes de observar.", [
      { label: "Minha pergunta sobre a sombra:", lines: 1 },
      { label: "O que penso que pode acontecer ao mudar a posição da lanterna:", lines: 2 },
      { label: "O que vamos manter igual nas duas observações:", lines: 2 },
      { label: "Como vamos identificar as posições A e B da lanterna:", lines: 2 },
    ]),
    table("Registro das duas posições", "Desenhe ou descreva a sombra em cada posição. A medida é opcional e só deve ser comparada se tiver sido realizada do mesmo modo.", ["Posição da lanterna", "Sombra que observei", "Medida, se realizada"], [["A", "", ""], ["B", "", ""]]),
    worksheet("Observação, explicação e dúvida", "Separe o que foi observado da explicação inicial. Um resultado deste teste não precisa valer para toda situação.", [
      { label: "Diferenças ou permanências entre as sombras:", lines: 2 },
      { label: "Uma explicação inicial que podemos discutir:", lines: 2 },
      { label: "O que ainda não podemos concluir:", lines: 2 },
      { label: "Uma nova pergunta ou teste:", lines: 2 },
    ])),
  pack(10, "Uma afirmação e duas fontes",
    worksheet("Uma pergunta, uma afirmação e a fonte A", "Escolha a pergunta com o estudante e selecione um trecho real de livro ou fonte institucional. Registre a identificação; os espaços não são uma citação pronta.", [
      { label: "Pergunta de investigação:", lines: 1 },
      { label: "Afirmação que vamos conferir:", lines: 1 },
      { label: "Fonte A — autor ou instituição, título e data (ou sem data):", lines: 2 },
      { label: "Onde encontrar a fonte A: endereço ou livro e página:", lines: 1 },
      { label: "Trecho selecionado da fonte A:", lines: 3 },
    ]),
    worksheet("Identificar e ler a fonte B", "Selecione outra fonte real e registre apenas o trecho necessário para a pergunta. A leitura pode acontecer em texto ampliado ou em áudio.", [
      { label: "Fonte B — autor ou instituição:", lines: 1 },
      { label: "Título e data da fonte B (ou sem data):", lines: 1 },
      { label: "Onde encontrar: endereço ou livro e página:", lines: 1 },
      { label: "Trecho selecionado da fonte B:", lines: 3 },
    ]),
    table("Relacionar afirmação e evidência", "Consulte os dois trechos. Um dado pode sustentar, limitar ou não responder à afirmação; registre também a dúvida que permanece.", ["Fonte", "Dado ou trecho relevante", "O que sustenta, limita ou deixa em dúvida"], [["A", "", ""], ["B", "", ""], ["Pergunta que permanece", "", ""]])),
  pack(10, "Uma pergunta observável perto de mim",
    worksheet("Papel plano e papel dobrado: planejar", "Compare dois pedaços do mesmo papel sobre duas bases baixas. Mantenha a distância das bases e altere apenas a dobra; não acrescente pesos.", [
      { label: "O que queremos descobrir sobre a forma do papel:", lines: 1 },
      { label: "Minha previsão para o papel plano e para o dobrado:", lines: 2 },
      { label: "Tipo de papel e distância das bases que vamos manter iguais:", lines: 2 },
    ]),
    table("Duas formas do mesmo papel", "Registre se o papel se mantém, se curva ou apresenta outra característica observável. Uma descrição ditada também serve como registro.", ["Arranjo", "Desenho ou descrição do que observei", "O que mantivemos igual"], [["Papel plano", "", ""], ["Papel dobrado em sanfona", "", ""]]),
    worksheet("Uma conclusão sobre este teste", "Compare somente os dois arranjos observados. Não é necessário repetir até obter um resultado esperado.", [
      { label: "O que mudou entre as duas montagens:", lines: 2 },
      { label: "O que consigo concluir sobre estes dois arranjos:", lines: 2 },
      { label: "O que ainda precisaria testar ou perguntar:", lines: 2 },
    ])),

  pack(11, "Que barreira queremos discutir?",
    cards("Situações fictícias para iniciar o projeto", "Escolha uma situação ou preencha outra. Discuta a participação sem identificar colegas ou pedir relatos pessoais.", [
      { ...book(), label: "Localizar livros na biblioteca" },
      { label: "Entender onde começa uma atividade" },
      frame("Outra situação da escola", "Descreva uma situação que o grupo queira melhorar, sem identificar pessoas."),
    ]),
    table("Da situação à ideia", "Registre contribuições confirmadas pelo grupo. Escrita, fala, CAA, olhar e seleção mediada são possibilidades de participação.", ["Situação escolhida", "Barreira percebida", "Uma ideia possível"], [["", "", ""], ["", "", ""], ["", "", ""]]),
    worksheet("A pergunta do nosso projeto", "A proposta começa pela escuta. O grupo pode registrar opiniões diferentes antes de escolher um próximo passo.", [
      { label: "Pergunta de projeto que queremos investigar:", lines: 2 },
      { label: "Quem precisa ser ouvido?", lines: 2 },
      { label: "Como desejo participar ou contribuir:", lines: 1 },
      { label: "Um próximo passo possível:", lines: 2 },
    ])),
  pack(11, "Prototipar uma informação mais clara",
    cards("Elementos para um protótipo de sinalização", "Escolha apenas as palavras necessárias à proposta do grupo. A foto do livro pode ser um elemento de uma sinalização de biblioteca, com descrição e texto.", [
      { ...book(), label: "BIBLIOTECA" },
      ...words("ENTRADA", "SAÍDA", "LIVROS", "INFORMAÇÕES"),
      frame("Outra informação", "Escreva a palavra ou desenhe o elemento escolhido pelo grupo."),
    ]),
    worksheet("Uma primeira versão para testar", "Desenhe, escreva ou dite a organização do protótipo. Ele é uma versão de estudo e pode mudar depois da leitura por outra pessoa.", [
      { label: "Qual informação a sinalização precisa comunicar?", lines: 1 },
      { label: "Nosso protótipo: texto, imagem ou posição dos elementos:", lines: 3 },
      { label: "Critério do teste: qual informação o leitor deve localizar?", lines: 2 },
    ]),
    worksheet("Devolutiva do leitor e revisão do autor", "Uma pessoa convidada lê o protótipo pelo modo de acesso escolhido. Registre o comentário sem atribuir nota ao autor.", [
      { label: "O que o leitor compreendeu:", lines: 2 },
      { label: "O que o leitor perguntou ou teve dificuldade de localizar:", lines: 2 },
      { label: "O que o autor escolheu manter ou revisar:", lines: 2 },
      { label: "Como ficou a informação depois da revisão:", lines: 2 },
    ])),
  pack(11, "Uma devolutiva para revisar o projeto",
    text("Devolutiva fictícia para estudo", "Este exemplo foi criado para a atividade e não é uma fala atribuída à escola ou a um profissional. Use uma devolutiva real autorizada no lugar dele, quando houver.", [
      "A palavra principal do protótipo pode ser lida, mas ainda não está claro a qual lugar a indicação se refere.",
      "O grupo pode testar outra organização do texto em sala. Antes de instalar uma placa permanente, precisa consultar a equipe escolar sobre o local e as condições de uso.",
      "Que comentário ajuda a revisar o protótipo? Que informação ainda precisamos pedir?",
    ]),
    table("Organizar os próximos passos", "Relacione os comentários à proposta. Um mesmo comentário pode exigir uma revisão em sala e também uma pergunta à equipe.", ["Podemos testar em sala", "Precisa de autorização", "Precisamos de mais informação"], [["", "", ""], ["", "", ""], ["", "", ""]]),
    worksheet("A decisão depois da devolutiva", "Registre a decisão confirmada pelo grupo e mantenha visíveis alternativas e dúvidas. Participar também pode incluir discordar ou pedir explicação.", [
      { label: "Comentário que escolhemos discutir:", lines: 2 },
      { label: "Parte da proposta à qual o comentário se refere:", lines: 1 },
      { label: "O próximo passo que combinamos:", lines: 2 },
      { label: "Ideia diferente ou dúvida que queremos manter registrada:", lines: 2 },
    ])),
];
