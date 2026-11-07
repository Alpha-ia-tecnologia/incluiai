import type { ActivityPrintPack, PrintableCard, PrintableSheet } from "./resource-print-types";

const GAME = "/images/games/";
const LEGACY = `${GAME}legacy/`;
const SCENE = "/images/activities/cards/";

const photo = (label: string, image: string, alt: string): PrintableCard => ({ label, image, alt });
const words = (...labels: string[]): PrintableCard[] => labels.map((label) => ({ label }));
const blank = (label: string, instruction: string): PrintableCard => ({ label, blank: instruction });
const copies = (card: PrintableCard, count: number): PrintableCard[] => Array.from({ length: count }, () => ({ ...card }));
const numbers = (last = 5): PrintableCard[] => Array.from({ length: last + 1 }, (_, index) => ({ label: String(index) }));
const dots = (last = 5): PrintableCard[] => Array.from({ length: last }, (_, index) => ({ label: "QUANTIDADE", quantity: index + 1 }));
const cards = (title: string, instruction: string, items: PrintableCard[], columns: 2 | 3 | 4 = 3): PrintableSheet => ({ kind: "cards", title, instruction, cards: items, columns });
const worksheet = (title: string, instruction: string, labels: string[], lines: 1 | 2 | 3 = 2): PrintableSheet => ({ kind: "worksheet", title, instruction, fields: labels.map((label) => ({ label, lines })) });
const table = (title: string, instruction: string, columns: string[], rows: string[][]): PrintableSheet => ({ kind: "table", title, instruction, columns, rows });
const text = (title: string, instruction: string, paragraphs: string[]): PrintableSheet => ({ kind: "text", title, instruction, paragraphs });
const pack = (resourceTitle: string, activityTitle: string, ...sheets: PrintableSheet[]): ActivityPrintPack => ({ resourceTitle, activityTitle, sheets });

const backpack = photo("MOCHILA", `${GAME}backpack.webp`, "Uma mochila escolar.");
const book = photo("LIVRO", `${GAME}book.webp`, "Um livro.");
const ball = photo("BOLA", `${GAME}ball.webp`, "Uma bola.");
const apple = photo("MAÇÃ", `${GAME}apple.webp`, "Uma maçã.");
const pencil = photo("LÁPIS", `${LEGACY}lapis.webp`, "Um lápis para escrever e desenhar.");
const ruler = photo("RÉGUA", `${LEGACY}regua.webp`, "Uma régua.");
const agenda = photo("AGENDA", `${LEGACY}agenda.webp`, "Uma agenda escolar.");
const chair = photo("CADEIRA", `${LEGACY}sentar.webp`, "Uma cadeira escolar.");
const help = photo("PRECISO DE AJUDA", `${LEGACY}pedir.webp`, "Uma pessoa levantando a mão.");
const water = photo("QUERO ÁGUA", `${SCENE}agua.webp`, "Um copo de água.");
const bathroom = photo("PRECISO IR AO BANHEIRO", `${LEGACY}vaso.webp`, "Um vaso sanitário.");
const plant = photo("COLOCAR A SEMENTE", `${SCENE}plantar.webp`, "Cena de colocar uma semente na terra.");
const watering = photo("REGAR A TERRA", `${SCENE}regar.webp`, "Cena de regar a terra de um vaso.");
const sprout = photo("OBSERVAR O BROTO", `${SCENE}brotar.webp`, "Um broto que nasceu na terra.");

const routineCards = [
  { ...backpack, label: "GUARDAR A MOCHILA" },
  { ...agenda, label: "ENTREGAR A AGENDA" },
  { ...chair, label: "ESCOLHER MEU LUGAR" },
  { ...pencil, label: "CONHECER A PRIMEIRA ATIVIDADE" },
];
const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").concat(["Á", "À", "Â", "Ã", "É", "Ê", "Í", "Ó", "Ô", "Õ", "Ú", "Ç"]).map((label) => ({ label }));
const seedStory = [
  "Uma pessoa colocou uma semente na terra de um vaso.",
  "Ela regou a terra com um pouco de água.",
  "Nos dias seguintes, observou o vaso e cuidou para que a terra não ficasse seca.",
  "Um broto apareceu. A pessoa levou o vaso para um lugar com luz.",
  "Depois, continuou observando o que mudava e quis registrar a descoberta.",
];
const routineTitle = "Rotina visual de chegada";
const communicationTitle = "Prancha de comunicação: rotina escolar";
const writingTitle = "Ditado com corpus de interesse";
const accessTitle = "Configuração de varredura por acionador";
const changeTitle = "História social: troca de professor";
const transitionsTitle = "Transições sem sino: avisos visuais";
const nameTitle = "Explorar letras do próprio nome";
const readingTitle = "Leitura compartilhada com escolhas";
const narrativeTitle = "Sequências de imagens e reconto";
const countingTitle = "Coleções para contar e registrar";
const comparisonTitle = "Comparar quantidades no mercadinho";
const subtractionTitle = "Subtração com objetos e histórias";

export const PRINT_CATALOG_A: ActivityPrintPack[] = [
  pack(routineTitle, "Cheguei e organizei",
    cards("Cartões da chegada", "Recorte os cartões e organize a ordem com o estudante. As fotografias representam objetos; substitua-as por imagens do material real se isso facilitar o reconhecimento.", [...routineCards, help, ...words("QUERO UMA PAUSA")], 2),
    cards("Base para acompanhar a chegada", "Mantenha esta folha inteira. Coloque o cartão da etapa em AGORA, reserve os seguintes em DEPOIS e mova os realizados para CONCLUÍDO.", [blank("AGORA", "Coloque aqui o cartão da etapa atual."), blank("DEPOIS", "Coloque aqui os próximos cartões."), blank("CONCLUÍDO", "Guarde aqui os cartões realizados.")]),
  ),
  pack(routineTitle, "Monitor da rotina da turma",
    cards("Avisos que os monitores podem apresentar", "Recorte e amplie se necessário. A dupla escolhe e apresenta o aviso da etapa combinada, sem precisar falar.", [...routineCards, help, ...words("QUERO UMA PAUSA")], 2),
    cards("Papéis da dupla e etapa atual", "Preencha os papéis com quem deseja participar. Os nomes ficam apenas no material utilizado pela turma.", [blank("QUEM SELECIONA", "Escreva o nome de uso, desenhe uma marca ou cole uma foto autorizada."), blank("QUEM APRESENTA", "Escreva o nome de uso, desenhe uma marca ou cole uma foto autorizada."), blank("ETAPA ATUAL", "Coloque o aviso escolhido pela dupla.")]),
  ),
  pack(routineTitle, "Mochila para o próximo dia",
    cards("Exemplo de materiais para conferir", "Este exemplo usa livro, lápis e régua. Confira a solicitação da escola e substitua os itens antes de usar a lista.", [book, pencil, ruler, help, ...words("ESTÁ FALTANDO", "JÁ CONFERI")], 3),
    table("Minha lista para o próximo dia", "Assinale, aponte ou dite a conferência. O familiar pode movimentar os materiais conforme as escolhas.", ["Material solicitado", "Separei", "Falta ou preciso de ajuda"], [["Livro", "", ""], ["Lápis", "", ""], ["Régua", "", ""]]),
  ),
  pack(communicationTitle, "Pedidos funcionais durante a aula",
    cards("Mensagens disponíveis durante a aula", "Use como cartões de apoio e mantenha a organização da prancha já familiar. Inclua outras mensagens escolhidas pelo estudante; a folha não substitui seu vocabulário completo.", [water, bathroom, help, ...words("QUERO UMA PAUSA", "GOSTEI DISSO", "NÃO QUERO AGORA", "TENHO UMA PERGUNTA", "TERMINEI")], 2),
    table("Duas oportunidades de comunicação", "Registre o sentido comunicado, inclusive comentário ou recusa, e como o parceiro respondeu. Não é uma lista de acertos.", ["Situação", "Mensagem e forma de comunicar", "Resposta do parceiro / apoio"], [["1ª oportunidade", "", ""], ["2ª oportunidade", "", ""]]),
  ),
  pack(communicationTitle, "Repórter das escolhas",
    cards("Escolhas e comentários para uma votação", "O exemplo permite escolher leitura ou brincadeira com bola. Troque as fotografias pelas duas opções reais da turma antes da votação.", [{ ...book, label: "LEITURA" }, { ...ball, label: "BRINCADEIRA COM BOLA" }, ...words("SIM", "NÃO", "NÃO SEI", "QUERO SABER MAIS", "NÃO QUERO ESCOLHER", "QUERO APRESENTAR O RESULTADO")], 2),
    table("Quadro da escolha coletiva", "Faça uma marca para cada escolha, sem registrar nomes. Conte as marcas junto com a turma.", ["Opção oferecida", "Marcas da turma", "Quantidade conferida"], [["Leitura", "", ""], ["Brincadeira com bola", "", ""], ["Outra resposta ou recusa", "", ""]]),
    worksheet("Uma informação que quero apresentar", "O repórter pode selecionar, ditar ou apontar. Um parceiro pode ler a mensagem confirmada.", ["A informação que escolhi foi:", "Como desejo apresentar essa informação:"]),
  ),
  pack(communicationTitle, "Minha prancha acompanha a brincadeira",
    cards("Escolher uma brincadeira", "Use as fotografias para oferecer uma escolha real ou acrescente outra opção conhecida.", [ball, photo("CARRINHO", `${LEGACY}pegar.webp`, "Uma mão pegando um carrinho de brinquedo."), blank("OUTRA BRINCADEIRA", "Desenhe, escreva ou cole uma fotografia da opção escolhida.")]),
    cards("Mensagens durante a brincadeira", "Recorte apenas as mensagens que complementam a prancha familiar. Confirme e acolha continuar, mudar ou encerrar.", [...words("QUERO MAIS", "QUERO OUTRO", "QUERO PARAR", "GOSTEI", "NÃO GOSTEI"), help], 2),
  ),
  pack(writingTitle, "Ditado temático graduado",
    cards("Banco de palavras: plantas", "Exemplo de tema curricular: plantas. Leia e explore os significados. Durante a primeira escrita, deixe a referência virada para baixo se esse for o combinado; depois use-a na revisão.", [photo("FLOR", `${LEGACY}flor.webp`, "Uma flor."), photo("FOLHA", `${LEGACY}folha.webp`, "Uma folha de planta."), photo("ÁRVORE", `${LEGACY}arvore.webp`, "Uma árvore."), photo("SOL", `${LEGACY}sol.webp`, "O sol no céu."), { ...water, label: "ÁGUA" }, { ...plant, label: "SEMENTE" }], 3),
    table("Minha escrita e minha revisão", "O estudante pode escrever, montar letras, usar teclado ou ditar a um escriba. Leia a referência somente no momento combinado.", ["Palavra ditada pelo parceiro", "Primeiro registro", "O que confirmei ou mudei"], Array.from({ length: 6 }, (_, index) => [`${index + 1}ª palavra`, "", ""])),
  ),
  pack(writingTitle, "Legenda colaborativa",
    cards("Imagens para criar uma legenda", "Escolha uma fotografia e converse sobre a legenda que os autores desejam escrever. Os cartões são pistas de significado, sem impor uma frase única.", [plant, watering, sprout]),
    cards("Palavras e pontuação para combinar", "Recorte e selecione as palavras necessárias. Acrescente outras ditadas pelos autores e permita alterar a ordem.", words("A", "UMA", "PESSOA", "SEMENTE", "ÁGUA", "BROTO", "COLOCOU", "REGOU", "OBSERVOU", "NA TERRA", ".", "?"), 4),
    worksheet("Nossa legenda", "Registre a frase escolhida, releia para os autores e anote a versão confirmada.", ["Fotografia escolhida:", "Primeira legenda:", "Legenda após a releitura:"], 2),
  ),
  pack(writingTitle, "Lista para uma escolha real",
    cards("Materiais para uma escolha", "O exemplo é preparar uma leitura com desenho. O estudante pode escolher outra atividade e substituir as imagens.", [book, pencil, agenda, blank("OUTRO MATERIAL", "Escreva, desenhe ou cole a fotografia de um material necessário.")], 2),
    table("Lista que vamos usar", "Escolha três itens ligados à atividade. Complete por escrita, seleção de cartões ou ditado e use a lista para localizar os materiais.", ["Item escolhido", "Como ficou escrito ou representado", "Localizei / preciso de ajuda"], [["1º item", "", ""], ["2º item", "", ""], ["3º item", "", ""]]),
  ),
  pack(accessTitle, "Calibrar tempo de varredura",
    cards("Quatro opções para ensaiar a seleção", "Apresente as quatro opções na mesma ordem do recurso de varredura. Os cartões permitem conferir a escolha; o ajuste de tempo é feito no equipamento utilizado pelo estudante.", [apple, ball, book, backpack], 2),
    table("Registro de dois tempos de apresentação", "Combine dois tempos de teste e registre o conforto e a intenção confirmada. Uma seleção diferente não deve ser tratada como erro antes da confirmação.", ["Tempo / tentativa", "Opção pretendida e opção selecionada", "Conforto e ajuste pedido"], [["Tempo A: ___ / tentativa 1", "", ""], ["Tempo A: ___ / tentativa 2", "", ""], ["Tempo B: ___ / tentativa 1", "", ""], ["Tempo B: ___ / tentativa 2", "", ""]]),
    cards("Como foi selecionar?", "Ofereça estas mensagens para o estudante avaliar o ensaio e escolher se deseja continuar.", words("ESTÁ CONFORTÁVEL", "QUERO MAIS TEMPO", "QUERO MENOS TEMPO", "QUERO REPETIR", "QUERO PARAR", "PRECISO DE OUTRO AJUSTE"), 2),
  ),
  pack(accessTitle, "Quiz acessível da turma",
    cards("Pergunta 1: qual objeto é usado para ler uma história?", "Exemplo de conteúdo sobre objetos e seus usos. Apresente as quatro alternativas por varredura e confirme a escolha; substitua a pergunta pelo conteúdo da turma quando necessário.", [book, ball, apple, backpack], 2),
    cards("Pergunta 2: qual objeto deixa marcas de grafite no papel?", "Leia a pergunta e percorra as quatro opções na ordem combinada. O estudante pode pedir repetição ou encerrar.", [ruler, pencil, ball, apple], 2),
    cards("Pergunta 3: qual objeto ajuda a medir um comprimento?", "Apresente todas as alternativas sem destacar uma resposta. Registre a comunicação e os apoios no registro da aplicação.", [backpack, apple, ruler, book], 2),
  ),
  pack(accessTitle, "Escolher e revisar uma mensagem",
    cards("Palavras para compor uma mensagem", "Exemplo de banco para comentar uma leitura ou escolher uma brincadeira. Use somente palavras relevantes ao tema e ao vocabulário do estudante.", [...words("EU", "QUERO", "GOSTEI", "NÃO QUERO"), { ...book, label: "LER" }, { ...ball, label: "BRINCAR" }, ...words("DE NOVO", "OUTRA OPÇÃO", "COM VOCÊ", "AGORA", "DEPOIS", "TERMINAR")], 4),
    cards("Ações de revisão", "Mantenha estas opções disponíveis durante a composição, por varredura ou seleção direta.", words("OUVIR A MENSAGEM", "APAGAR A ÚLTIMA ESCOLHA", "TROCAR UMA PALAVRA", "ACRESCENTAR", "ESTÁ COMO EU QUERO", "TERMINAR"), 2),
    worksheet("Mensagem confirmada pelo autor", "O parceiro registra as escolhas e relê sem completar a intenção por conta própria.", ["Primeira mensagem escolhida:", "O que pedi para revisar:", "Versão que confirmei:"], 2),
  ),
  pack(changeTitle, "Conhecer a mudança com antecedência",
    text("Minha história sobre a mudança", "Complete os espaços apenas com informações confirmadas pela escola. Leia junto ao estudante e aceite alterações no texto.", ["No dia __________, haverá uma mudança: ____________________.", "A pessoa que vai acompanhar a turma se chama ____________________.", "Na rotina, continuará assim: ____________________.", "O que será diferente é: ____________________.", "Posso perguntar, pedir ajuda ou combinar uma pausa. Minha forma de avisar é ____________________.", "Se uma informação ainda não estiver confirmada, vamos perguntar à escola."]),
    cards("Pessoas e lugares da minha rotina", "Personalize com imagens reais autorizadas. Não use uma fotografia genérica de outra pessoa como se fosse o professor do estudante.", [blank("QUEM VAI ME ACOMPANHAR", "Escreva o nome e cole uma fotografia REAL autorizada, ou registre uma descrição."), blank("NOSSO LUGAR", "Cole uma fotografia do espaço real ou faça uma representação combinada."), blank("UM APOIO QUE POSSO PEDIR", "Registre o apoio escolhido pelo estudante.")]),
    worksheet("O que ficou combinado", "Confirme as informações com a escola antes da leitura da história.", ["Quando acontece:", "O que permanece:", "Uma pergunta que ainda tenho:"]),
  ),
  pack(changeTitle, "Mapa de apoio para o primeiro dia",
    { kind: "map", title: "Modelo para marcar meus pontos de referência", instruction: "Este é um modelo para completar com a sala real. Indique posições e caminhos conhecidos; não use o desenho como uma planta pronta do espaço.", places: ["Entrada", "Lugar escolhido", "Pessoa de referência"], route: ["Da entrada ao meu lugar", "Do meu lugar até o apoio combinado"] },
    cards("Como posso pedir apoio", "Combine o sentido de cada cartão e mantenha o acesso às mensagens depois do primeiro dia.", [help, ...words("QUERO UMA PAUSA", "QUERO SABER ONDE FICA", "PODE REPETIR?"), blank("MINHA PESSOA DE REFERÊNCIA", "Escreva o nome ou cole uma fotografia REAL autorizada da pessoa combinada."), blank("LUGAR DE PAUSA COMBINADO", "Registre o espaço real e como chegar até ele.")], 2),
  ),
  pack(changeTitle, "Perguntas que seguem para a escola",
    cards("Palavras para escolher uma pergunta", "Apresente uma pergunta por vez e registre a intenção confirmada. É possível acrescentar outra pergunta.", [{ ...help, label: "QUERO PERGUNTAR" }, ...words("QUEM VAI ACOMPANHAR?", "QUANDO VAI MUDAR?", "ONDE VAMOS FICAR?", "COMO POSSO PEDIR AJUDA?", "O QUE CONTINUA IGUAL?", "TENHO OUTRA PERGUNTA")], 2),
    table("Pergunta enviada e resposta recebida", "A resposta fica em branco até ser confirmada pela escola. Leia a devolutiva ao estudante e ofereça pedir esclarecimento.", ["Minha pergunta", "Resposta confirmada", "Quero perguntar mais alguma coisa?"], [["", "", ""], ["", "", ""]]),
    worksheet("Como quero enviar e receber a pergunta", "Use o canal já combinado com a família e a escola, sem exigir gravação ou fotografia.", ["A pergunta pode seguir por:", "Quero receber a resposta por:"]),
  ),
  pack(transitionsTitle, "Transição com contagem visual",
    cards("Avisos do tempo combinado", "Os pontos representam minutos de referência. Combine o sentido dos avisos e use um temporizador real para acompanhar o tempo; os cartões não fazem a contagem sozinhos.", [{ label: "FALTAM 5 MINUTOS", quantity: 5 }, { label: "FALTAM 2 MINUTOS", quantity: 2 }, { label: "O TEMPO COMBINADO TERMINOU" }, ...words("PRECISO DE MAIS TEMPO", "PRECISO DE AJUDA", "QUERO UMA PAUSA")], 2),
    cards("Agora e depois", "Mantenha a folha inteira e coloque fotos, desenhos ou os objetos de referência das duas atividades reais.", [blank("AGORA", "Represente o que estamos fazendo."), blank("DEPOIS", "Represente a próxima proposta."), blank("APOIO QUE ESCOLHI", "Coloque o aviso ou apoio escolhido pelo estudante.")]),
  ),
  pack(transitionsTitle, "Auditoria sensorial da rotina",
    cards("Exemplos de fontes de som", "As imagens servem para localizar fontes possíveis. Pergunte como cada participante percebe o som; a fotografia não informa sua intensidade.", [photo("CAIXA DE SOM", `${LEGACY}barulho.webp`, "Uma caixa de som."), photo("TORNEIRA", `${LEGACY}torneira.webp`, "Uma torneira."), blank("OUTRA FONTE DE SOM", "Desenhe, escreva ou cole uma fotografia de uma fonte observada.")]),
    table("Escuta dos participantes", "Percorra os locais combinados sem produzir ruídos para testar reações. Registre percepções e alternativas propostas pelos participantes.", ["Som / lugar / momento", "Como foi percebido", "Alternativa combinada"], [["", "", ""], ["", "", ""], ["", "", ""], ["", "", ""]]),
    cards("Como quero comentar o ambiente", "Use as mensagens como opções, sem atribuir um nível de desconforto a outra pessoa.", words("ESTÁ CONFORTÁVEL", "ESTÁ ME INCOMODANDO", "QUERO MAIS SILÊNCIO", "QUERO MUDAR DE LUGAR", "QUERO PROPOR OUTRO AVISO", "PREFIRO NÃO RESPONDER"), 2),
  ),
  pack(transitionsTitle, "Avisos combinados em família",
    cards("Exemplo de duas atividades", "Leitura e brincadeira são exemplos. A família e o estudante escolhem quais momentos reais desejam representar.", [{ ...book, label: "LEITURA" }, { ...ball, label: "BRINCADEIRA" }, blank("OUTRO MOMENTO", "Desenhe, escreva ou cole a imagem escolhida para a rotina.")]),
    cards("Avisos e pedidos para a transição", "Combine quais mensagens serão usadas, respeitando pedido de ajuda, de tempo e de encerramento.", [...words("AGORA", "DEPOIS", "QUERO MAIS TEMPO", "QUERO PARAR", "PODE REPETIR O AVISO?"), help], 2),
    worksheet("Nosso aviso combinado", "O registro pode ser ditado e ficar apenas com a família.", ["O que faremos agora e o que virá depois:", "Como será o aviso e como posso responder:"]),
  ),
  pack(nameTitle, "Meu nome entre outras escritas",
    cards("Nome de uso e outras palavras", "Escreva o nome de uso escolhido no primeiro cartão. Apresente-o junto a duas outras escritas, sem exigir que o estudante leia todas as palavras.", [blank("MEU NOME DE USO", "Escreva aqui o nome de uso escolhido pelo estudante."), book, ball]),
    worksheet("Uma pista que percebi", "O estudante pode apontar uma letra, reconhecer o formato, comparar o tamanho ou comunicar outra pista.", ["Cartão que escolhi:", "O que me ajudou a reconhecer:"]),
  ),
  pack(nameTitle, "Montar e conferir meu nome",
    cards("Alfabeto destacável", "Recorte as letras necessárias ao nome de uso. Imprima novamente letras repetidas; os acentos fazem parte da escrita e podem ser selecionados com apoio.", alphabet, 4),
    cards("Referência e montagem do nome", "Mantenha esta base inteira ou amplie. Escreva a referência e use o espaço de montagem sem impor um número fixo de letras.", [blank("REFERÊNCIA DO NOME DE USO", "Escreva o nome escolhido como referência."), blank("MINHA MONTAGEM", "Organize aqui as letras; use mais espaço ou outra linha se precisar.")], 2),
    worksheet("Conferência com o autor", "Compare a montagem com a referência e deixe o estudante decidir o que confirma ou deseja mudar.", ["Uma parte que confirmei:", "Uma mudança que escolhi fazer:"]),
  ),
  pack(nameTitle, "Etiqueta para um objeto escolhido",
    cards("Objetos que podem receber uma etiqueta", "Escolha um objeto real ou acrescente outra opção. As fotografias ajudam a comunicar a escolha.", [backpack, book, ball, blank("OUTRO OBJETO", "Desenhe ou escreva qual objeto o estudante escolheu.")], 2),
    cards("Etiquetas para personalizar", "Escreva o nome de uso, digite ou cole uma escrita escolhida pelo estudante. Recorte apenas a etiqueta desejada.", [blank("NOME DE USO", "Preencha com o nome escolhido."), blank("NOME DE USO", "Preencha com o nome escolhido."), blank("NOME DE USO", "Preencha com o nome escolhido.")]),
    worksheet("Minha decisão sobre a etiqueta", "Confirme antes de fixar. O estudante pode preferir guardar a etiqueta sem colar.", ["Objeto que escolhi:", "Onde quero colocar ou guardar a etiqueta:"]),
  ),
  pack(readingTitle, "Paradas para conversar sobre a história",
    text("Leitura: a semente no vaso", "Texto original de apoio para leitura compartilhada. Leia em voz alta e faça pausas escolhidas pelos participantes; também é possível utilizar o livro da turma.", seedStory),
    cards("Cenas e mensagens para conversar", "As três cenas ajudam a retomar acontecimentos. As demais mensagens permitem pedir releitura, comentar ou encerrar sem responder a perguntas de memória.", [plant, watering, sprout, ...words("DE NOVO", "TENHO UMA PERGUNTA", "QUERO COMENTAR", "QUERO TERMINAR")], 3),
    worksheet("Uma conversa sobre a leitura", "O parceiro registra o comentário confirmado, aceitando fala, seleção de imagens, olhar ou CAA.", ["A cena ou passagem que escolhi:", "O que quero comentar ou perguntar:"]),
  ),
  pack(readingTitle, "Dois caminhos para a personagem",
    text("Duas possibilidades depois da descoberta", "Leia este trecho e deixe a continuação em aberto. As escolhas não precisam formar uma única resposta esperada.", [...seedStory, "Depois de ver o broto, a pessoa poderia desenhar o vaso ou contar a descoberta a alguém. Que continuação você quer criar? Que parte do texto ajuda a explicar sua escolha?"]),
    cards("Possibilidades e apoio para justificar", "O lápis representa desenhar; o cartão de mensagem permite escolher contar a alguém. Acrescente outra ideia se o autor desejar.", [{ ...pencil, label: "DESENHAR O VASO" }, { label: "CONTAR A DESCOBERTA A ALGUÉM" }, ...words("PORQUE…", "TENHO OUTRA IDEIA", "NÃO SEI AINDA")], 2),
    worksheet("Minha continuação", "O estudante pode selecionar uma opção, ditar ou orientar o registro de um parceiro.", ["A continuação que escolhi:", "Uma informação do texto que usei:", "Outra ideia que gostaria de acrescentar:"]),
  ),
  pack(readingTitle, "Releitura escolhida em família",
    text("Uma história para ouvir de novo", "Este texto original pode ser lido por um familiar. O estudante escolhe um trecho para repetir ou pode encerrar; não é necessário enviar registro à escola.", seedStory),
    cards("Escolhas durante a releitura", "Use as cenas para indicar o trecho e as mensagens para compartilhar uma impressão.", [plant, watering, sprout, ...words("DE NOVO", "GOSTEI", "NÃO GOSTEI", "QUERO TERMINAR")], 3),
  ),
  pack(narrativeTitle, "Primeiro, depois e por fim",
    cards("Três cenas para ordenar", "Recorte as cenas e apresente fora de ordem. Explore o que cada imagem mostra antes de escolher como organizar a sequência.", [sprout, plant, watering]),
    cards("Base de sequência", "Mantenha a folha inteira. Coloque uma cena em cada espaço e reconte com o apoio dos marcadores temporais.", [blank("PRIMEIRO", "Coloque a cena que inicia o acontecimento."), blank("DEPOIS", "Coloque a cena seguinte."), blank("POR FIM", "Coloque o desfecho escolhido.")]),
    worksheet("Minha relação entre as cenas", "A resposta pode ser comunicada por seleção, fala, olhar, gesto ou ditado.", ["O que acontece antes:", "O que acontece depois e o que mudou:"]),
  ),
  pack(narrativeTitle, "Uma história ditada por dois autores",
    cards("Cenas para uma história compartilhada", "Explore as três cenas conhecidas e crie a quarta com os autores. A nova cena pode ser desenhada, descrita ou representada por outra imagem escolhida.", [plant, watering, sprout, blank("NOSSA NOVA CENA", "Desenhe, dite ou cole uma nova cena escolhida pelos autores.")], 2),
    cards("Banco de palavras para o reconto", "Escolha as palavras úteis à narrativa. Os autores podem acrescentar, trocar ou retirar qualquer elemento.", words("UMA PESSOA", "UMA DUPLA", "SEMENTE", "BROTO", "PLANTOU", "REGOU", "OBSERVOU", "NO JARDIM", "NA ESCOLA", "PRIMEIRO", "DEPOIS", "POR FIM"), 4),
    worksheet("História confirmada pelos dois autores", "O escriba registra e relê sem substituir a intenção dos autores. Use outra folha se a narrativa precisar de mais espaço.", ["Título escolhido:", "Nossa história:", "O que confirmamos ou revisamos:"], 3),
  ),
  pack(narrativeTitle, "Contar um acontecimento do dia",
    cards("Pistas para escolher o que contar", "As imagens são convites para lembrar uma leitura, brincadeira ou chegada. Não é necessário relatar uma situação pessoal nem compartilhar o registro.", [{ ...book, label: "UMA LEITURA" }, { ...ball, label: "UMA BRINCADEIRA" }, { ...backpack, label: "UMA CHEGADA" }, { label: "PREFIRO GUARDAR PARA MIM" }], 2),
    cards("Meu acontecimento em partes", "O autor pode desenhar, ditar, colar uma imagem ou indicar um objeto para cada parte. Use apenas duas partes se preferir.", [blank("ANTES", "Represente o início escolhido pelo autor."), blank("DURANTE", "Represente o que aconteceu em seguida."), blank("DEPOIS", "Represente como terminou.")]),
    worksheet("Como quero compartilhar", "Confirme a ordem e a escolha do autor antes de apresentar a outra pessoa.", ["O que quero manter ou mudar na ordem:", "Quero contar para alguém ou guardar para mim:"]),
  ),
  pack(countingTitle, "Um lugar para cada objeto",
    cards("Fichas com objetos para contar", "Recorte as cinco fotografias para usar como uma pequena coleção. Também é possível substituir as fichas por objetos grandes.", copies(apple, 5), 3),
    cards("Cinco lugares para a coleção", "Mantenha esta folha inteira. Coloque uma ficha ou objeto em cada espaço, sem colocar dois no mesmo lugar.", Array.from({ length: 5 }, (_, index) => blank(`LUGAR ${index + 1}`, "Um objeto ou uma ficha aqui.")), 3),
    cards("Pontos e numerais para representar", "Escolha uma representação para a quantidade contada. Os cartões de pontos e os numerais podem ser apresentados separadamente.", [...dots(5), ...numbers(5).slice(1)], 4),
  ),
  pack(countingTitle, "Duas formas de mostrar o mesmo número",
    cards("Uma coleção para parear", "Recorte as fichas e comece com três ou quatro. Mantenha as demais como reserva, sem pedir aumento da quantidade a cada tentativa.", copies(ball, 5), 3),
    cards("Cartões de pontos e numerais", "Recorte e relacione a coleção aos pontos; em seguida, selecione o numeral correspondente. O parceiro pode mover as peças orientado pelo estudante.", [...dots(5), ...numbers(5).slice(1)], 4),
    table("Duas representações da mesma coleção", "Cole, desenhe ou dite o registro das escolhas. Uma mesma quantidade pode ser retomada em mais de uma linha.", ["Coleção escolhida", "Cartão de pontos", "Numeral escolhido"], [["1ª exploração", "", ""], ["2ª exploração", "", ""]]),
  ),
  pack(countingTitle, "Quantos materiais vamos separar?",
    cards("Materiais em fichas", "Recorte as fotografias de lápis ou use objetos disponíveis. Escolha uma quantidade ligada à atividade real.", copies(pencil, 5), 3),
    cards("Quantidade combinada", "Apresente um cartão de pontos ou um numeral e convide a separar a quantidade de materiais. Não é necessário usar os dois tipos ao mesmo tempo.", [...dots(5), ...numbers(5).slice(1)], 4),
    worksheet("Conferência da separação", "Conte relacionando cada ficha ou objeto a uma marca. O registro pode ficar com a família.", ["Quantos materiais combinamos separar?", "Onde colocamos os materiais separados?", "Na conferência, falta, sobra ou há a quantidade combinada?"], 2),
  ),
  pack(comparisonTitle, "Duas cestas, uma comparação",
    cards("Fichas para as duas cestas", "Recorte oito maçãs. Organize três na cesta A e cinco na cesta B antes de perguntar como as coleções podem ser comparadas.", copies(apple, 8), 4),
    cards("Palavras para comparar", "Permita comparar antes e depois de formar pares. Estes cartões comunicam relações; não precisam ser lidos oralmente.", words("CESTA A", "CESTA B", "TEM MAIS", "TEM MENOS", "MESMA QUANTIDADE", "QUERO CONFERIR"), 3),
    table("Uma linha para cada par", "Coloque ou desenhe uma ficha em cada coluna da linha para formar pares. Os lugares sem par ajudam a conversar sobre mais, menos e como igualar.", ["Par", "Cesta A", "Cesta B"], Array.from({ length: 5 }, (_, index) => [String(index + 1), "", ""])),
  ),
  pack(comparisonTitle, "Espalhar muda a quantidade?",
    cards("Oito fichas para duas coleções", "Recorte oito bolas e forme dois grupos de quatro. Depois, espalhe apenas um grupo sem acrescentar nem retirar fichas.", copies(ball, 8), 4),
    cards("Como podemos comparar e conferir?", "Apresente as opções sem antecipar a conclusão. O estudante pode escolher contar, formar pares ou reorganizar.", words("IGUAL", "TEM MAIS", "TEM MENOS", "CONTAR", "FORMAR PARES", "REORGANIZAR"), 3),
    worksheet("Antes e depois de espalhar", "Registre por desenho, seleção ou ditado o que foi percebido e a estratégia escolhida para conferir.", ["Antes de espalhar, observei:", "Depois de espalhar um dos grupos, observei:", "Escolhi conferir assim:"], 2),
  ),
  pack(comparisonTitle, "Uma peça para cada pessoa",
    cards("Participantes fictícios e peças", "Use as marcas como participantes de uma brincadeira. Distribua um lápis para cada marca; não é preciso registrar nomes de pessoas.", [...Array.from({ length: 4 }, (_, index) => blank(`PARTICIPANTE ${index + 1}`, "Use este espaço como lugar do participante fictício.")), ...copies(pencil, 4)], 4),
    cards("O que aconteceu na distribuição?", "Depois de distribuir, o estudante pode indicar uma relação e propor um ajuste.", words("ESTÁ FALTANDO", "ESTÁ SOBRANDO", "HÁ UM PARA CADA", "QUERO CONFERIR"), 2),
    worksheet("Um ajuste que escolhi", "Use de dois a quatro participantes e varie as peças disponíveis. O estudante pode orientar os movimentos de um parceiro.", ["Como ficou a distribuição:", "O que decidimos mudar e como conferimos:"]),
  ),
  pack(subtractionTitle, "O que ficou na caixa?",
    cards("Cinco fichas para representar a retirada", "Recorte cinco bolas. Coloque-as na base inicial, retire duas para a base lateral e mantenha os dois grupos visíveis durante a conferência.", copies(ball, 5), 3),
    cards("Numerais e sinais para registrar", "Selecione os cartões depois de representar a história. O zero permite explorar uma situação em que nenhuma ficha permanece.", [...numbers(5), ...words("−", "=")], 4),
    worksheet("No começo, saíram e ficaram", "As áreas servem para colocar fichas, desenhar ou ditar quantidades. Não é preciso copiar uma operação para participar.", ["NO COMEÇO — quantidade inicial:", "SAÍRAM — fichas retiradas:", "FICARAM — fichas que permanecem:"], 3),
  ),
  pack(subtractionTitle, "Quantos faltam para completar?",
    cards("Base com cinco lugares", "Mantenha a folha inteira. Coloque três fichas nos espaços e deixe os demais livres para investigar quantas faltam.", Array.from({ length: 5 }, (_, index) => blank(`ESPAÇO ${index + 1}`, "Lugar para uma ficha.")), 3),
    cards("Fichas iniciais e de reserva", "Recorte as cinco maçãs. Coloque três na base e deixe as outras perto do estudante para selecionar ou indicar.", copies(apple, 5), 3),
    worksheet("Total, quantidade presente e o que falta", "Confira preenchendo os espaços, aceitando contagem, desenho, escolha de numeral ou ditado.", ["TOTAL COMBINADO: 5", "QUANTIDADE PRESENTE NO INÍCIO: 3", "QUANTOS ESCOLHI BUSCAR PARA COMPLETAR:", "DEPOIS DE CONFERIR, FALTA OU SOBRA ALGUMA FICHA?"], 1),
  ),
  pack(subtractionTitle, "Inventar uma história de retirar",
    cards("Bolas para uma história inventada", "Recorte até cinco fichas ou substitua por objetos disponíveis. O autor escolhe quantas entram na história e quantas sairão do grupo.", copies(ball, 5), 3),
    cards("Cartões para organizar as quantidades", "Use as palavras como lugares dos grupos e os numerais como registro opcional. Mantenha as fichas retiradas visíveis.", [...words("NO COMEÇO", "SAÍRAM", "FICARAM"), ...numbers(5)], 3),
    worksheet("Minha história de retirar", "Registre a história nas palavras confirmadas pelo autor. Ela pode ser ditada, desenhada ou mantida apenas na conversa.", ["Como minha história começa:", "O que acontece quando algumas fichas saem:", "Como terminou e como conferi a quantidade:"], 2),
  ),
];
