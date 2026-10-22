// Formação em pílulas (item 9 do plano), pura para teste com node --test
// (src/lib/learning-pills.test.mjs): textos curtos, de até 2 minutos, ao lado
// do passo em que a dúvida aparece. Versão 1: rascunho da plataforma para a
// equipe pedagógica revisar. Textos próprios, sem trechos copiados.

export type Pill = {
  slug: string;
  title: string;
  summary: string;
  why: string;
  steps: string[];
  example: string;
  avoid: string[];
  where: { text: string; href: string };
  norm?: string;
};

export const PILLS_VERSION = "pilulas-2026-10-v1";

export const PILLS: Pill[] = [
  {
    slug: "estudo-de-caso",
    title: "Estudo de caso em quatro etapas",
    summary: "O ponto de partida do AEE: olhar as barreiras e os apoios, não o diagnóstico.",
    why: "O estudo de caso é a etapa inicial do AEE e fundamenta o PAEE e o PEI. Ele não depende de laudo: a pergunta é o que impede o estudante de participar e aprender e o que a escola pode mudar.",
    steps: [
      "Identifique as demandas e as barreiras: quem encaminhou, por quê e o que já foi tentado.",
      "Analise o contexto: observe o estudante na sala, no recreio e em outros espaços, e registre as barreiras que aparecem.",
      "Reconheça as potencialidades e as demandas de apoio: do que gosta, como aprende melhor, o que já faz sozinho.",
      "Defina as estratégias e os recursos de acessibilidade que a escola vai usar para tirar as barreiras.",
    ],
    example: "Uma estudante não participa das atividades escritas. Na observação, a equipe vê que ela participa quando o enunciado é lido em voz alta e tem imagens. A barreira está no material, e o estudo indica enunciado lido e apoio visual.",
    avoid: [
      "Começar pelo diagnóstico ou esperar um laudo.",
      "Preencher sem ouvir a família e o próprio estudante.",
      "Registrar só o que o estudante ainda não faz.",
    ],
    where: { text: "Em Estudantes, escolha o estudante e abra a aba Estudo de caso.", href: "/estudantes" },
    norm: "Decreto nº 12.686/2025, art. 11",
  },
  {
    slug: "comunicacao-alternativa",
    title: "Comunicação alternativa no dia a dia",
    summary: "Uma prancha à mão, usada por todos, abre espaço para o estudante participar.",
    why: "Sem um jeito de se comunicar, o estudante não participa nem mostra o que sabe. A comunicação alternativa e aumentativa (CAA) amplia a comunicação e não atrapalha a fala; as pesquisas indicam que pode até ajudar.",
    steps: [
      "Descubra como o estudante já se comunica: olhar, gestos, apontar, sons.",
      "Comece com poucos símbolos de uso frequente, como quero, não quero, ajuda, banheiro e acabou.",
      "Use a prancha enquanto fala com o estudante: aponte os símbolos ao conversar.",
      "Deixe a prancha à mão em todos os espaços e combine os mesmos símbolos com a família.",
      "Acrescente aos poucos o vocabulário das aulas.",
    ],
    example: "No lanche, o professor aponta quero e suco na prancha enquanto fala. Em algumas semanas, o estudante passa a apontar sozinho para pedir.",
    avoid: [
      "Guardar a prancha para usar só no AEE.",
      "Exigir que o estudante fale antes de atender o pedido feito pela prancha.",
      "Trocar os símbolos toda semana.",
    ],
    where: { text: "Em Como aprende, registre a forma de comunicação; em Materiais de apoio, prepare as pranchas.", href: "/estudantes" },
    norm: "Portaria MEC nº 421/2026, art. 10, II",
  },
  {
    slug: "objetivo-bncc",
    title: "Objetivo observável ligado à BNCC",
    summary: "Uma frase que diz o que o estudante vai aprender, com que apoio e como saber que aprendeu.",
    why: "Um objetivo claro mostra a toda a equipe o que acompanhar. Ligado a uma habilidade da BNCC, mantém o estudante no currículo da turma, com o apoio de que ele precisa.",
    steps: [
      "Escolha a habilidade da BNCC: a da turma ou a do ano de referência que a sondagem indicou.",
      "Escreva uma ação que dá para ver: apontar, ler, contar, pedir, montar.",
      "Diga a condição: com que apoio, como prancha, material concreto ou modelo.",
      "Defina o critério: em quantas tentativas ou situações.",
      "Marque o prazo, em semanas.",
    ],
    example: "O estudante vai contar coleções de até 10 objetos, usando material concreto, em 4 de 5 tentativas, em 8 semanas (EF01MA02).",
    avoid: [
      "Verbos que não dá para observar, como compreender ou conhecer.",
      "Objetivo sem critério, como melhorar a leitura.",
      "Habilidade muito distante do que o estudante faz hoje.",
    ],
    where: { text: "No Plano de ensino, use Adicionar objetivo: a plataforma sugere habilidades da BNCC.", href: "/estudantes?acao=acompanhar" },
    norm: "Portaria MEC nº 421/2026, art. 11, II e III",
  },
  {
    slug: "dua",
    title: "DUA: planejar para todos desde o início",
    summary: "Mais de um jeito de apresentar, de participar e de mostrar o que aprendeu.",
    why: "O Desenho Universal para a Aprendizagem planeja a aula já com opções. Assim, menos estudantes precisam de adaptação depois e ninguém fica de fora da atividade da turma.",
    steps: [
      "Comece pelo objetivo da aula, o mesmo para todos.",
      "Apresente o conteúdo de mais de um jeito: imagem, fala, objeto, vídeo com legenda.",
      "Ofereça mais de um jeito de participar e de responder: falar, desenhar, apontar, montar, escrever.",
      "Cuide do interesse: dê escolhas, use temas próximos e trabalho em dupla.",
      "Prepare os apoios individuais de quem precisa, dentro da mesma atividade.",
    ],
    example: "Na aula sobre animais, a turma vê fotos e ouve um áudio curto. Depois, cada estudante escolhe como mostrar onde o animal vive: desenhando, escrevendo ou montando com figuras.",
    avoid: [
      "Fazer uma atividade separada para o estudante com deficiência.",
      "Oferecer opções que mudam o objetivo da aula.",
      "Achar que DUA é só usar tecnologia.",
    ],
    where: { text: "Em Planejamento com DUA, crie a atividade da turma e siga as etapas.", href: "/planejamento" },
  },
  {
    slug: "adaptar-prova",
    title: "Adaptar a prova sem mudar o que ela avalia",
    summary: "Tirar a barreira de acesso e manter a pergunta da prova.",
    why: "A adaptação tira a barreira de leitura, escrita, tempo ou organização e mantém o que a questão quer saber. Assim, o resultado mostra o que o estudante aprendeu, e não a barreira.",
    steps: [
      "Para cada questão, anote o que ela avalia.",
      "Simplifique o enunciado: frases curtas, uma ordem por linha, a palavra-chave em destaque.",
      "Mude a forma de responder quando a escrita for a barreira: marcar, ligar, apontar ou responder oralmente.",
      "Organize a página: letra maior, mais espaço, menos questões por folha.",
      "Combine os apoios da aplicação: leitura do enunciado, mais tempo, lugar tranquilo.",
    ],
    example: "A questão pede para circular, num texto longo, os animais que vivem na água. Na versão adaptada, o texto vem em partes curtas, com imagens, e o estudante circula do mesmo jeito: a questão continua avaliando se ele identifica os animais aquáticos.",
    avoid: [
      "Tirar questões sem combinar com o professor da turma.",
      "Trocar o conteúdo avaliado: aí já é outra prova.",
      "Deixar a resposta no próprio enunciado.",
    ],
    where: { text: "Na aba Atividades do estudante, use Adaptar a atividade da turma.", href: "/estudantes?acao=preparar" },
    norm: "Portaria MEC nº 421/2026, art. 11, II",
  },
  {
    slug: "sondagem",
    title: "Sondagem: linha de base e reavaliação",
    summary: "Registrar o apoio de que o estudante precisa hoje, para comparar depois.",
    why: "Sem um ponto de partida, não dá para dizer se o estudante avançou. A sondagem registra, item por item, o apoio de que ele precisa, e a reavaliação mostra se passou a precisar de menos.",
    steps: [
      "Observe em situações reais, na sala e no AEE, ao longo de alguns dias.",
      "Em cada item, marque o menor apoio com que o estudante consegue: de independente a apoio físico total.",
      "Deixe como não observado o que você ainda não teve chance de ver.",
      "Use os itens com mais apoio para escolher os objetivos do plano.",
      "Reaplique a cada revisão do plano, de 12 em 12 semanas, e compare.",
    ],
    example: "Na linha de base, o estudante contava objetos até 10 com modelo. Doze semanas depois, conta com uma instrução verbal: passou a precisar de menos apoio.",
    avoid: [
      "Usar a sondagem como prova ou nota.",
      "Marcar de memória, sem observar.",
      "Comparar estudantes entre si: compare o estudante com ele mesmo.",
    ],
    where: { text: "Na aba Sondagem do estudante, aplique a linha de base.", href: "/estudantes" },
    norm: "Portaria MEC nº 421/2026, art. 7º, § 3º",
  },
];

export const pillBySlug = (slug: string) => PILLS.find((pill) => pill.slug === slug);

// Tempo de leitura em minutos, a 180 palavras por minuto (leitura atenta).
export function readingMinutes(pill: Pill): number {
  const text = [pill.summary, pill.why, ...pill.steps, pill.example, ...pill.avoid, pill.where.text].join(" ");
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 180));
}
