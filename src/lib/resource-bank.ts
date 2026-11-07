export const RESOURCE_TYPES: Record<string, string> = {
  plano_de_aula: "Plano de aula",
  atividade: "Atividade",
  caa: "Comunicação alternativa",
  tecnologia_assistiva: "Tecnologia assistiva",
  video_formacao: "Vídeo de formação",
  experiencia_exitosa: "Experiência exitosa",
};

export const COMPLEXITY_LABELS: Record<string, string> = {
  baixa: "Preparação simples",
  media: "Preparação intermediária",
  alta: "Preparação com apoio especializado",
};

export type ResourcePresentation = {
  image: string;
  imageAlt: string;
  preparation: string[];
  extension: string;
  model: { title: string; instruction: string; items: string[] };
  supportLevels: { label: string; description: string }[];
};

const SUPPORT_OPTIONS = [
  { label: "Explorar com um modelo", description: "Apresente os materiais, demonstre uma possibilidade e confira a compreensão sem exigir imitação." },
  { label: "Escolher com mediação", description: "Ofereça alternativas e tempo de resposta. Aceite fala, olhar, apontar, comunicação alternativa ou varredura por parceiro." },
  { label: "Ampliar a participação", description: "Convide a explicar, revisar ou criar outra possibilidade, mantendo os apoios de acesso que o estudante utiliza." },
];

// As capas são compartilhadas; a descrição corresponde à fotografia, não ao título do recurso.
const IMAGE_ALTS: Record<string, string> = {
  communication: "Prancha com fotografias de um copo de água, uma mão aberta e uma poltrona, ao lado de um copo e um envelope.",
  routine: "Mochila, caderno e estojo sobre uma mesa, com cartões de mochila, lavagem das mãos e caderno.",
  literacy: "Letras móveis formando BOLA ao lado de uma bola vermelha e um livro com desenho de bola.",
  counting: "Cartões de 1 a 5 com um, dois, três, quatro e cinco contadores, respectivamente.",
  patterns: "Sequência alternada de círculos vermelhos e quadrados azuis, com peças separadas em bandejas.",
  nature: "Folhas em uma bandeja, sementes e pedras em recipientes, com lupa, papel e lápis.",
  art: "Colagem de uma casa e um sol com formas de papel, ao lado de cola e tesoura de ponta arredondada.",
  tactile: "Bandeja com quatro amostras de textura: feltro, tecido azul, madeira lisa e papelão ondulado.",
  access: "Notebook com fotografias de maçã e bola na tela e um acionador azul grande conectado por cabo.",
  stories: "Livro ilustrado e três cartões mostrando uma semente na terra, a rega e uma planta crescida.",
  "daily-life": "Sacola, embalagens sem marca de arroz e feijão, caixa, maçã e uma lista com fotografias dos produtos.",
  collaboration: "Dois pares de mãos adultas compartilhando a construção de uma ponte baixa com blocos de madeira.",
};

function presentation(
  imageKey: string,
  imageAlt: string,
  preparation: string[],
  extension: string,
  model: ResourcePresentation["model"],
): ResourcePresentation {
  return { image: `/images/activities/${imageKey}.webp`, imageAlt: IMAGE_ALTS[imageKey] ?? imageAlt, preparation, extension, model, supportLevels: SUPPORT_OPTIONS };
}

export const RESOURCE_PRESENTATIONS: Record<string, ResourcePresentation> = {
  "Rotina visual de chegada": presentation("routine", "Materiais escolares organizados com cartões de uma rotina visual.",
    ["Fotografe os materiais e lugares reais, sem expor pessoas sem autorização.", "Confirme a ordem da chegada e deixe ajuda e pausa disponíveis.", "Separe uma base e um envelope para marcar as etapas realizadas."],
    "Depois de usar a chegada, escolha com a turma outra rotina e construa sua sequência com os mesmos apoios.",
    { title: "Cartões de chegada", instruction: "Use estas legendas com fotografias ou objetos da rotina real. A ordem pode ser alterada junto ao estudante.", items: ["Guardar a mochila", "Entregar a agenda", "Escolher meu lugar", "Conhecer a primeira atividade", "Preciso de ajuda", "Quero uma pausa"] }),
  "Prancha de comunicação: rotina escolar": presentation("communication", "Prancha de comunicação com fotografias e cartões de escolha sobre uma mesa.",
    ["Mantenha o vocabulário e a organização da prancha já utilizada pelo estudante.", "Confira posição, contraste e forma de seleção com o usuário.", "Escolha situações reais em que um pedido, comentário ou recusa será acolhido."],
    "Convide o estudante a acrescentar comentários e perguntas sobre o tema da turma, sem restringir a prancha a pedidos.",
    { title: "Mensagens para começar", instruction: "São exemplos para selecionar com o estudante; não substituem sua prancha completa nem precisam ocupar posições novas.", items: ["Quero participar", "Não quero agora", "Preciso de ajuda", "Quero uma pausa", "Tenho uma pergunta", "Gostei disso", "Quero outra opção", "Terminei"] }),
  "Ditado com corpus de interesse": presentation("literacy", "Letras móveis, caderno e cartões com palavras para atividades de escrita.",
    ["Selecione palavras ligadas ao conteúdo comum e aos interesses do estudante.", "Ofereça escrita manual, teclado, letras móveis ou um escriba.", "Prepare palavras de referência para a revisão, sem mostrá-las antes de toda tentativa."],
    "Reúna produções de diferentes dias e convide o autor a comentar uma mudança, sem ranking de acertos.",
    { title: "Banco de palavras: horta", instruction: "Exemplo para uma turma que estuda plantas; substitua pelo tema curricular e pelos interesses do estudante.", items: ["SEMENTE", "TERRA", "ÁGUA", "FOLHA", "RAIZ", "SOL", "Legenda: A planta precisa de ___."] }),
  "Configuração de varredura por acionador": presentation("access", "Equipamento de acesso com acionador e opções ampliadas de escolha.",
    ["Confirme quais equipamentos e recursos de varredura a escola já possui.", "Combine sinais de confirmação, repetição, mudança e pausa.", "Teste os materiais com o estudante e registre sua preferência de acesso."],
    "Leve a configuração escolhida a uma produção de texto ou pesquisa do currículo e confira novamente o conforto de uso.",
    { title: "Roteiro para conferir o acesso", instruction: "Use como registro pedagógico de preferências; não é prescrição de posicionamento ou configuração clínica.", items: ["Como confirmo uma escolha?", "Quero ouvir ou ver de novo", "Quero trocar a opção", "Este tempo está confortável?", "Quero uma pausa", "Mensagem escolhida: ___"] }),
  "História social: troca de professor": presentation("stories", "Livro aberto e fotografias organizadas para antecipar uma mudança na rotina escolar.",
    ["Confirme quem estará na turma e em qual data antes de escrever.", "Use fatos, nomes autorizados e frases literais, sem prometer sentimentos.", "Disponibilize um canal para dúvidas e uma pessoa de referência."],
    "Após a mudança, convide o estudante a revisar o roteiro com fatos do primeiro dia e perguntas que ainda permanecem.",
    { title: "Roteiro informativo editável", instruction: "Preencha apenas com informações confirmadas e revise com o estudante. Ele pode escolher não conversar naquele momento.", items: ["No dia ___, nossa turma estará com ___.", "A atividade acontecerá em ___.", "O que permanece na rotina: ___.", "Posso pedir ajuda a ___.", "Posso comunicar que preciso de pausa por ___.", "Minha pergunta é: ___."] }),
  "Transições sem sino: avisos visuais": presentation("access", "Materiais de apoio visual e recursos de acesso para combinar avisos da rotina.",
    ["Apresente esta escola como exemplo fictício de demonstração.", "Consulte a turma sobre barreiras e formas preferidas de receber avisos.", "Combine alternativas que mantenham a informação acessível por mais de um canal."],
    "Compare os comentários antes e depois de um aviso combinado e ajuste o ambiente; não teste tolerância a sons.",
    { title: "Combinado de transição", instruction: "Preencha com a turma e teste somente os avisos escolhidos, sem produzir sons desconfortáveis para avaliação.", items: ["Agora estamos em: ___.", "Depois faremos: ___.", "O aviso será apresentado por: ___.", "Posso pedir mais tempo por: ___.", "Preciso de ajuda para: ___.", "O que desejo mudar no aviso: ___."] }),
  "Explorar letras do próprio nome": presentation("literacy", "Letras móveis e cartões de identificação para explorar nomes e escritas.",
    ["Confirme o nome que o estudante deseja usar e sua escrita de referência.", "Separe letras grandes, uma base e duas ou três opções por vez.", "Inclua recursos táteis ou leitura oral para quem não acessa o impresso."],
    "Compare nomes escolhidos pela turma e investigue letras em comum, sem ordenar estudantes por desempenho.",
    { title: "Cartão do meu nome", instruction: "Substitua os espaços pelo nome usado pelo estudante e proponha uma descoberta por vez.", items: ["Meu nome de uso: ___", "Primeira letra: ___", "Uma letra que se repete: ___", "Outra palavra com uma letra do meu nome: ___", "Esta é a etiqueta que escolho para meu material."] }),
  "Leitura compartilhada com escolhas": presentation("stories", "Livro infantil aberto acompanhado de imagens para escolhas durante a leitura.",
    ["Escolha uma narrativa curta adequada à idade e aos interesses.", "Descreva as imagens e prepare duas opções para momentos da história.", "Combine como cada leitor pode comentar, perguntar ou pedir nova leitura."],
    "Releia a história com outra pessoa narrando e aceite mudanças propostas pelos leitores para um final alternativo.",
    { title: "Perguntas durante a leitura", instruction: "Escolha três perguntas e permita consultar o livro; não transforme toda página em teste.", items: ["Quem apareceu nesta parte?", "Onde a personagem está?", "O que já aconteceu?", "O que pode acontecer depois?", "Quero ouvir de novo esta parte.", "Eu mudaria ___ no final."] }),
  "Sequências de imagens e reconto": presentation("stories", "Imagens de uma narrativa dispostas para organizar começo, meio e fim.",
    ["Selecione três ou quatro imagens de um mesmo acontecimento.", "Descreva cada cena e aceite mais de uma ordem quando houver sentido.", "Ofereça marcadores de tempo e um modo de registrar a narrativa."],
    "Produza uma sequência autoral com desenhos ou fotografias autorizadas de uma experiência da turma.",
    { title: "Uma semente no vaso", instruction: "Represente estas cenas com desenho, objetos ou descrição e organize uma narrativa com o estudante.", items: ["Separar vaso, terra e semente", "Colocar a semente na terra", "Regar na quantidade combinada", "Observar o broto dias depois", "Primeiro...", "Depois...", "Por fim..."] }),
  "Coleções para contar e registrar": presentation("counting", "Objetos grandes organizados em pequenas coleções com cartões numéricos.",
    ["Use objetos grandes e seguros que não sejam levados à boca.", "Escolha uma faixa de quantidades a partir do que será investigado.", "Separe uma base com lugares marcados para acompanhar a contagem."],
    "Junte duas coleções da turma e explore diferentes maneiras de representar a quantidade total.",
    { title: "Coleções de um a cinco", instruction: "Comece com duas quantidades e amplie conforme a proposta, permitindo mover, olhar ou indicar os objetos.", items: ["Uma bola", "Duas colheres", "Três blocos", "Quatro tampas grandes", "Cinco cartões", "Quantos objetos contamos?", "Como podemos registrar essa quantidade?"] }),
  "Comparar quantidades no mercadinho": presentation("counting", "Cestas e objetos de um mercadinho pedagógico para comparar quantidades.",
    ["Monte duas coleções de objetos que possam ser alinhados em pares.", "Prepare cartões mais, menos, mesma quantidade e não sei.", "Diferencie tamanho do objeto e quantidade com exemplos claros."],
    "Modifique a disposição espacial mantendo os objetos e investigue se a quantidade mudou.",
    { title: "Desafios de comparação", instruction: "Monte as situações com objetos reais ou cartões e aceite explicar por pareamento, desenho, fala ou CAA.", items: ["Cesta A: três maçãs de brinquedo", "Cesta B: cinco maçãs de brinquedo", "Qual cesta tem mais?", "Como deixar as duas com a mesma quantidade?", "Quatro objetos espalhados e quatro alinhados: mudou a quantidade?", "Quero conferir formando pares."] }),
  "Subtração com objetos e histórias": presentation("counting", "Coleção de objetos com uma parte separada para representar situações de subtração.",
    ["Separe até dez objetos grandes e duas bases de cores distintas.", "Escolha problemas de retirar, completar e comparar com números acessíveis.", "Disponibilize registro por desenho, número, objetos ou seleção mediada."],
    "Peça ao estudante que crie uma nova história com os mesmos objetos e convide a turma a resolvê-la.",
    { title: "Histórias para representar", instruction: "Leia uma história por vez e convide a representar antes de apresentar a operação escrita.", items: ["Havia cinco blocos. Dois foram para outra mesa. Quantos ficaram?", "A caixa tinha seis cartões. Agora tem quatro. Quantos saíram?", "Temos três copos para cinco pessoas. Quantos faltam?", "Uma cesta tem sete objetos e outra tem cinco. Qual é a diferença?", "Mostre como conferiu a resposta."] }),
  "Padrões e sequências investigativas": presentation("patterns", "Peças grandes formando sequências de formas e cores sobre uma mesa.",
    ["Escolha peças que variem por forma, tamanho ou textura, além da cor.", "Monte sequências com uma unidade de repetição visível.", "Prepare uma base que mantenha as peças na ordem durante a exploração."],
    "Investigue padrões numéricos ou de movimentos escolhidos pela turma, mantendo alternativas para quem não deseja se movimentar.",
    { title: "Sequências para descobrir", instruction: "Represente com peças ou descrição. Pergunte qual trecho se repete antes de pedir para continuar.", items: ["Círculo, quadrado, círculo, quadrado...", "Grande, pequeno, pequeno, grande, pequeno, pequeno...", "Um bloco, dois blocos, um bloco, dois blocos...", "Qual parte se repete?", "O que poderia vir depois?", "Crie um padrão para outra pessoa continuar."] }),
  "Classificação e pistas lógicas": presentation("patterns", "Peças de diferentes formas organizadas em conjuntos para investigar critérios.",
    ["Separe objetos que compartilhem e diferenciem características observáveis.", "Descreva critérios com palavras, relevo ou exemplos, sem depender só de cor.", "Aceite agrupamentos diferentes quando o estudante explica sua regra."],
    "Crie uma investigação em que um mesmo objeto pode pertencer a dois grupos e discuta por quê.",
    { title: "Cartões de pistas", instruction: "Escolha um objeto conhecido entre quatro opções e use pistas observáveis que todos possam acessar.", items: ["Tem formato redondo", "É maior que a peça pequena", "Não tem quinas", "Pode entrar em mais de um grupo?", "Que pista ajuda a eliminar uma opção?", "Qual foi a sua regra para agrupar?"] }),
  "Conversas com escolhas e comentários": presentation("communication", "Objetos e cartões de comunicação preparados para conversar e fazer escolhas.",
    ["Escolha objetos ou temas que despertem interesse sem pressupor preferências.", "Prepare mensagens para comentar, recusar, perguntar e mudar de ideia.", "Combine com os parceiros como esperar e confirmar a comunicação."],
    "Acrescente perguntas sugeridas pelo estudante e mantenha o vocabulário disponível em outras conversas.",
    { title: "Mensagens para conversar", instruction: "Modele o uso em uma conversa real, acolhendo outras formas de comunicação sem exigir repetição.", items: ["Eu escolho este", "Quero conhecer o outro", "Não quero nenhum", "Gostei porque ___", "Tenho outra ideia", "E você?", "Quero mudar minha escolha", "Quero encerrar"] }),
  "Planejar o lanche com autonomia": presentation("daily-life", "Utensílios e objetos do cotidiano organizados para planejar um lanche.",
    ["Use apenas opções autorizadas pela escola e pela família, respeitando restrições e escolhas.", "A proposta pode usar embalagens limpas e objetos; não exige comer ou provar.", "Prepare uma sequência de organização sem etapas com calor ou utensílios cortantes."],
    "Planeje a organização de uma mesa coletiva distribuindo funções escolhidas e revendo o que faltou.",
    { title: "Planejamento do lanche", instruction: "Use como cartões de decisão; o estudante pode participar apenas planejando ou orientando um parceiro.", items: ["O que escolho entre as opções disponíveis?", "Qual utensílio será necessário?", "Onde quero organizar os materiais?", "Preciso de ajuda para ___", "O que falta nesta mesa?", "Onde guardamos cada objeto ao terminar?"] }),
  "Brincadeiras de turnos e colaboração": presentation("collaboration", "Materiais de uma brincadeira coletiva organizados para escolhas e turnos compartilhados.",
    ["Escolha uma brincadeira sem eliminação e ofereça papéis diferentes.", "Prepare cartões minha vez, sua vez, ajuda e parar.", "Combine que observar, recusar ou sair da brincadeira são possibilidades."],
    "Peça ao grupo que altere uma regra para que mais pessoas possam participar e teste a nova versão.",
    { title: "Combinados de participação", instruction: "Apresente antes da brincadeira e revise com o grupo. Nenhuma função exige fala ou execução motora independente.", items: ["Quero escolher uma peça", "Quero orientar um parceiro", "Quero observar primeiro", "Minha vez / sua vez", "Podemos fazer juntos", "Preciso de ajuda", "Quero trocar de função", "Quero parar"] }),
  "Diário de observação da natureza": presentation("nature", "Folhas, sementes e materiais de registro para observar elementos da natureza.",
    ["Escolha um local acessível ou traga imagens e materiais seguros para a sala.", "Não utilize plantas desconhecidas, alergênicas ou que exijam coleta.", "Prepare uma ficha que aceite descrição oral, desenho, fotografia autorizada ou escrita."],
    "Compare registros de dias diferentes e formule uma nova pergunta sem apresentar a observação como prova de causa.",
    { title: "Ficha de observação", instruction: "Escolha uma planta, folha ou imagem e registre o que foi observado. Tocar é opcional.", items: ["Data e lugar: ___", "O que escolhi observar: ___", "Forma ou tamanho percebido: ___", "O que mudou desde o último registro: ___", "Uma pergunta que surgiu: ___", "Como observei: olhar, descrição, toque opcional ou outro recurso."] }),
  "Ateliê de marcas e texturas": presentation("art", "Papéis e instrumentos de pintura organizados para explorar marcas artísticas.",
    ["Use materiais atóxicos adequados à faixa etária e sem peças pequenas soltas.", "Ofereça instrumentos que evitem contato direto com tinta ou textura.", "Disponibilize base estável, espaço livre e escolha entre participar, observar ou parar."],
    "Monte uma exposição com títulos escolhidos pelos autores e descrição das marcas para quem não acessa as imagens.",
    { title: "Convites para criar", instruction: "Apresente duas opções por vez. Explorar não exige tocar nem produzir uma figura reconhecível.", items: ["Marcas largas com esponja presa a um suporte", "Linhas com rolo ou pincel de cabo grosso", "Composição com papéis grandes", "Escolha de posição das marcas por um parceiro", "Título que quero dar à criação: ___", "O que desejo manter ou mudar: ___"] }),
  "Mapas táteis e leitura do espaço": presentation("tactile", "Mapa com caminhos em relevo e marcadores de lugares para exploração espacial.",
    ["Escolha um percurso escolar já conhecido e confirme suas condições de acesso.", "Prepare uma legenda com poucos elementos distinguíveis por textura e descrição.", "A exploração do mapa pode ser visual, tátil ou oral, conforme a escolha do estudante."],
    "Revise o mapa após uma mudança real no espaço e discuta quais informações precisam ser atualizadas.",
    { title: "Legenda de um percurso", instruction: "Substitua os lugares pelo trajeto escolhido e combine o significado de cada marca com seus leitores.", items: ["Ponto de partida: sala", "Caminho contínuo: corredor", "Primeira referência: porta da biblioteca", "Ponto de chegada: pátio", "Lugar em que posso pedir informação: ___", "Uma barreira que precisamos sinalizar: ___"] }),
  "Textos do cotidiano: avisos e trajetos": presentation("literacy", "Textos e placas do cotidiano organizados para leitura funcional de jovens e adultos.",
    ["Utilize textos públicos ou exemplos fictícios sem dados pessoais.", "Escolha temas de interesse dos estudantes da EJA, com linguagem adequada à idade.", "Ofereça texto ampliado, leitura oral e tempo para consultar a informação."],
    "Convide a turma a reescrever um aviso pouco claro e conferir se outras pessoas localizam sua informação principal.",
    { title: "Aviso fictício para leitura", instruction: "Use este exemplo como texto de estudo, sem apresentá-lo como informação real sobre um serviço.", items: ["OFICINA DE LEITURA", "Dia: quarta-feira, 14 de maio", "Horário: das 18h às 19h", "Local: biblioteca da escola", "Leve um texto que queira compartilhar", "Qual é a atividade? Quando e onde acontece?", "Que informação ainda falta neste aviso?"] }),
  "Orçamento e compras com dinheiro fictício": presentation("daily-life", "Dinheiro de brinquedo e etiquetas de preços usados em uma simulação de compras.",
    ["Marque claramente cédulas e etiquetas como material fictício.", "Escolha valores inteiros inicialmente e itens adequados aos interesses da EJA.", "Disponibilize calculadora, tabela e objetos para representar os valores."],
    "Compare dois orçamentos fictícios e discuta critérios de escolha sem solicitar informações financeiras das famílias.",
    { title: "Mercado de simulação", instruction: "Valores inventados exclusivamente para a atividade; não representam preços atuais. Use dinheiro fictício.", items: ["Arroz: R$ 8", "Feijão: R$ 7", "Sabão: R$ 4", "Fruta: R$ 3", "Orçamento fictício: R$ 20", "Escolha dois itens e calcule o total", "Quanto sobra? Há outra combinação possível?"] }),
  "Laboratório de perguntas e investigação": presentation("nature", "Instrumentos simples e registros preparados para uma investigação sobre a natureza.",
    ["Parta de uma pergunta do estudante e combine um recorte que caiba no tempo disponível.", "Escolha fontes identificáveis e uma observação segura, sem produtos perigosos.", "Planeje como registrar hipóteses, dados e dúvidas sem exigir uma resposta prévia."],
    "Convide estudantes interessados em aprofundamento, incluindo altas habilidades, a propor novas variáveis e comparar explicações com fontes.",
    { title: "Roteiro de investigação", instruction: "Exemplo de pergunta: como a posição da fonte de luz muda a sombra de um objeto? Use lanterna comum sem apontar para os olhos.", items: ["Minha pergunta: ___", "O que penso que pode acontecer: ___", "O que vou manter igual: ___", "O que vou mudar: ___", "Como vou registrar: ___", "O que observei e o que ainda não posso concluir: ___", "Fonte consultada e nova pergunta: ___"] }),
  "Projeto coletivo: ideias para a escola": presentation("collaboration", "Cartões, anotações e materiais de construção de um projeto coletivo para a escola.",
    ["Escolha uma situação escolar que possa ser discutida sem expor pessoas.", "Defina com o grupo formas acessíveis de opinar e papéis voluntários.", "Explique quais decisões dependem da escola antes de prometer execução."],
    "Apresente o protótipo à equipe escolar, recolha uma devolutiva e revise o projeto com os autores.",
    { title: "Ficha de uma proposta coletiva", instruction: "Use exemplos como melhorar a sinalização da biblioteca; o grupo decide o tema e pode rever sua escolha.", items: ["O que queremos melhorar?", "Quem precisa ser ouvido?", "Quais barreiras percebemos?", "Duas ideias possíveis: ___ e ___", "Como vamos representar a proposta?", "Qual função desejo assumir?", "O que depende da autorização da escola?", "O que mudaremos após a devolutiva?"] }),
};

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
}

export function resourceTypeLabel(type: string): string {
  return Object.hasOwn(RESOURCE_TYPES, type) ? RESOURCE_TYPES[type] : type.replaceAll("_", " ");
}

export function resourcePresentation(resource: { title: string; skillArea: string; resourceType: string }): ResourcePresentation {
  return Object.hasOwn(RESOURCE_PRESENTATIONS, resource.title) ? RESOURCE_PRESENTATIONS[resource.title] : presentation("collaboration", "Materiais organizados para uma atividade pedagógica compartilhada.",
    ["Leia o objetivo e selecione os materiais disponíveis na escola.", "Combine formas de participação, comunicação e pausa com o estudante."],
    "Retome a proposta em outro contexto e compare os apoios que favoreceram a participação.",
    { title: "Planejamento adaptável", instruction: "Preencha de acordo com a atividade e com as escolhas do estudante.", items: [`Área de trabalho: ${resource.skillArea}`, "O que vamos investigar?", "Como desejo participar?", "De que apoio preciso?", "O que observamos ao final?"] });
}
