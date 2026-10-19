import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { RESOURCE_CATALOG } from "./resource-catalog.mjs";

const prisma = new PrismaClient();
const j = JSON.stringify;
const hashPassword = (pw) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
};
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function main() {
  // Planejamento com DUA e frequência do AEE: tudo cai em cascata com o
  // planejamento ou o estudante, mas apagamos na ordem das chaves, antes dos estudantes.
  await prisma.duaEvidence.deleteMany();
  await prisma.duaApplication.deleteMany();
  await prisma.duaSuggestion.deleteMany();
  await prisma.duaMaterial.deleteMany();
  await prisma.duaSupport.deleteMany();
  await prisma.duaAuditEvent.deleteMany();
  await prisma.duaPlanningVersion.deleteMany();
  await prisma.duaPlanning.deleteMany();
  await prisma.aeeSession.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.user.deleteMany();
  await prisma.material.deleteMany();
  await prisma.intersectorReport.deleteMany();
  await prisma.accessLog.deleteMany();
  await prisma.familyNote.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.diaryEntry.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.objective.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.functionalProfile.deleteMany();
  await prisma.caseStudy.deleteMany();
  await prisma.student.deleteMany();
  await prisma.school.deleteMany();
  await prisma.resourceActivity.deleteMany();
  await prisma.resource.deleteMany();

  const escola1 = await prisma.school.create({
    data: { name: "EMEF Maria Firmina dos Reis", region: "Zona Norte" },
  });
  const escola2 = await prisma.school.create({
    data: { name: "EMEF Paulo Freire", region: "Centro" },
  });

  await prisma.schoolClass.createMany({
    data: [
      { schoolId: escola1.id, name: "Turma B", gradeYear: "2º ano", shift: "manha" },
      { schoolId: escola1.id, name: "Turma C", gradeYear: "4º ano", shift: "manha" },
      { schoolId: escola2.id, name: "Turma A", gradeYear: "6º ano", shift: "tarde" },
    ],
  });

  // ---- Dante: 7 anos, 2o ano, TEA, CAA por pranchas, dinossauros ----
  const dante = await prisma.student.create({
    data: {
      name: "Dante Oliveira",
      birthDate: new Date("2019-03-12"),
      stage: "anos_iniciais",
      gradeYear: "2º ano",
      className: "Turma B",
      shift: "manha",
      schoolId: escola1.id,
      hasAEE: true,
      aeeFrequency: "2x por semana",
      supportProfessional: true,
      guardianName: "Carla Oliveira",
      guardianPhone: "(11) 98888-0001",
      accessibilityNotes: "Usa prancha de comunicação; fone abafador disponível na escola.",
      avatarHue: 152,
      profile: {
        create: {
          expressiveChannel: "caa_prancha",
          receptiveChannel: "fala",
          commandSteps: 1,
          readingSupport: 3, writingSupport: 4, mathSupport: 3, attentionMinutes: 8,
          peerInteraction: 3, adultInteraction: 2, groupWork: 4,
          feeding: 1, hygiene: 2, mobility: 0, organization: 3,
          sensoryProfile: j({ auditiva: "hiper", visual: "tipica", tatil: "hiper", vestibular: "tipica", proprioceptiva: "hipo" }),
          fineMotor: 2, grossMotor: 1,
          triggers: j(["barulho súbito", "troca de atividade sem aviso", "ambientes lotados"]),
          earlySigns: j(["cobre os ouvidos", "balança o corpo", "afasta o material"]),
          calmingStrategies: j(["canto silencioso", "miniaturas de dinossauro", "pressão profunda nos ombros"]),
          bestShift: "manha",
          taskToleranceMinutes: 8,
          interests: j(["dinossauros", "quebra-cabeças", "vídeos de vulcões"]),
          barriers: j(["comunicacional", "pedagogica"]),
          strengths: "Memória visual excelente; pareia figuras com precisão; interesse intenso sustenta atenção quando o tema é âncora.",
        },
      },
    },
  });

  // Estudo de caso concluído — etapa de diagnóstico que antecede o plano.
  await prisma.caseStudy.create({
    data: {
      studentId: dante.id,
      status: "concluido",
      updatedBy: "Prof.ª Beatriz (AEE)",
      concludedAt: daysAgo(40),
      content: JSON.stringify({
        encaminhadoPor: "Professor(a) da sala comum",
        motivos: "Dificuldade de comunicação; Dificuldade na leitura e na escrita; Dificuldade de interação com os colegas",
        situacao: "Na sala comum, Dante se afasta nas atividades coletivas e tapa os ouvidos quando a turma fica barulhenta.",
        idadeEntrada: "Entre 4 e 5 anos",
        frequencia: "Regular",
        reprovacoes: "Nenhuma",
        jaFrequentou: "Pré-escola",
        apoiosAnteriores: "Comunicação alternativa",
        entrevistados: "Mãe",
        moraCom: "Mãe; Avós",
        andou: "Entre 1 e 2 anos",
        falou: "Ainda não fala",
        saude: "Nenhuma",
        acompanhamentos: "Fonoaudiologia; Terapia ocupacional",
        diagnostico: "Transtorno do espectro autista",
        comunicacaoCasa: "Prancha de comunicação (CAA); Gestos e apontar",
        autonomiaCasa: "Come sem ajuda; Guarda os brinquedos",
        interessesCasa: "Dinossauros; Quebra-cabeças",
        expectativas: "Que se comunique melhor; Que faça amigos",
        formaEscuta: "Prancha de comunicação",
        comoSeSente: "Às vezes desconfortável",
        gostaEscola: "Brincar no recreio; Usar o computador ou tablet",
        achaDificil: "Barulho; Mudanças na rotina",
        espacos: "Sala comum; Recreio; Refeitório",
        participacao: "Participa com apoio",
        comunicacaoEscola: "Prancha de comunicação (CAA); Gestos e apontar",
        interacao: "Interage mais com adultos; Tem um colega de referência",
        comportamento: "Fica agitado(a) com barulho; Precisa de lembretes frequentes",
        barreiras: "Comunicacional; Pedagógica",
        leitura: "Reconhece algumas letras",
        escrita: "Pré-silábica",
        matematica: "Conta até 10 com apoio",
        aprendeMelhor: "Com apoio visual; Com material concreto",
        potencialidades: "Boa memória visual; Interesse intenso sustenta a atenção",
        publicoAlvo: "Sim: transtorno do espectro autista",
        frequenciaAee: "2 vezes por semana",
        necessidades: "Comunicação alternativa e aumentativa; Apoio à autorregulação; Adequação de materiais",
        recursos: "AEE na sala de recursos; Profissional de apoio; Prancha de comunicação",
        encaminhamentos: "Nenhum",
        participantes: "Professor(a) do AEE; Professor(a) da sala comum; Família",
        sintese: "Dante se comunica pela prancha e por gestos e aprende melhor com apoio visual e material concreto, especialmente com o tema dinossauros. Barulho e mudanças sem aviso o desorganizam. Prioridades: ampliar a comunicação funcional, antecipar a rotina e iniciar o reconhecimento do próprio nome.",
        reavaliacao: "Em 6 meses",
      }),
    },
  });

  const planDante = await prisma.plan.create({
    data: {
      studentId: dante.id,
      status: "ativo",
      initialSituation:
        "Dante reconhece algumas letras isoladas e pareia figuras idênticas. Comunica-se pela prancha com apoio. Participa da rotina com mediação constante.",
      commonRoomStrategies: "Antecipação visual da rotina; chamada sem sino; colega mediador nas atividades em dupla.",
      aeeStrategies: "Blocos curtos com pausa sensorial; pareamento nome-foto; ampliação da prancha de comunicação.",
      accessibilityResources: "Prancha de comunicação, fone abafador, rotina visual, cartões-nome.",
      reviewDate: daysAhead(30),
      createdAt: daysAgo(60),
    },
  });

  const objDante = await prisma.objective.create({
    data: {
      planId: planDante.id,
      action: "identificará seu nome entre 5 opções",
      condition: "com pista visual",
      criterion: "4 de 5 tentativas",
      deadlineWeeks: 6,
      description: "Dante identificará seu nome entre 5 opções, com pista visual (VERB), em 4 de 5 tentativas, ao longo de 6 semanas.",
      bnccCode: "EF01LP04",
      dimension: "leitura",
      currentSupport: 2, targetSupport: 1,
      createdAt: daysAgo(45),
    },
  });

  const objDante2 = await prisma.objective.create({
    data: {
      planId: planDante.id,
      action: "comunicará três necessidades da rotina escolar",
      condition: "usando prancha de comunicação",
      criterion: "3 situações diferentes",
      deadlineWeeks: 8,
      description: "Dante comunicará três necessidades da rotina escolar, usando prancha de comunicação (VERB), em 3 situações diferentes, ao longo de 8 semanas.",
      dimension: "comunicacao",
      currentSupport: 2, targetSupport: 1,
      createdAt: daysAgo(45),
    },
  });

  await prisma.diaryEntry.createMany({
    data: [
      { studentId: dante.id, objectiveId: objDante.id, date: daysAgo(21), participation: "parcial", supportLevel: 3, criterionMet: "parcial", note: "Identificou o nome entre 3 opções com destaque de cor.", whatWorked: "Cartões com tema de dinossauros", recommendation: "Aumentar para 4 opções mantendo a cor.", authorRole: "professor_aee" },
      { studentId: dante.id, objectiveId: objDante.id, date: daysAgo(14), participation: "total", supportLevel: 2, criterionMet: "parcial", note: "4 opções com pista visual. Acertou 3 de 5.", whatWorked: "Bloco de 4 minutos com pausa", recommendation: "Manter 4 opções mais uma semana.", authorRole: "professor_aee" },
      { studentId: dante.id, objectiveId: objDante.id, date: daysAgo(7), participation: "total", supportLevel: 2, criterionMet: "sim", note: "5 opções, pista de cor apenas na inicial. 4 de 5.", whatWorked: "Ninho de dinossauros na chamada", recommendation: "Tentar retirar a pista de cor.", authorRole: "professor_sala" },
      { studentId: dante.id, objectiveId: objDante2.id, date: daysAgo(5), participation: "parcial", supportLevel: 2, criterionMet: "parcial", note: "Pediu pausa pela prancha uma vez, com lembrete.", whatWorked: "Prancha ao alcance na mesa", recommendation: "Modelar pedido de ajuda na próxima sessão.", authorRole: "professor_aee" },
    ],
  });

  await prisma.timelineEvent.createMany({
    data: [
      { studentId: dante.id, date: daysAgo(90), type: "avaliacao", title: "Avaliação pedagógica inicial", description: "Perfil funcional registrado com a equipe e a família." },
      { studentId: dante.id, date: daysAgo(60), type: "plano", title: "PPI elaborado", description: "Plano individual criado em reunião colaborativa." },
      { studentId: dante.id, date: daysAgo(40), type: "reuniao", title: "Reunião com a família", description: "Alinhamento das estratégias de comunicação em casa." },
      { studentId: dante.id, date: daysAgo(30), type: "recurso", title: "Fone abafador disponibilizado", description: "Recurso de acessibilidade entregue à escola." },
      { studentId: dante.id, date: daysAgo(7), type: "conquista", title: "Identificou o nome entre 5 opções", description: "Critério do objetivo atingido pela primeira vez." },
    ],
  });

  await prisma.familyNote.createMany({
    data: [
      { studentId: dante.id, date: daysAgo(10), note: "Dante apontou o nome dele na caixa de brinquedos sem ajuda!", author: "Carla (mãe)" },
      { studentId: dante.id, date: daysAgo(3), note: "Usou a prancha para pedir água durante o jantar.", author: "Carla (mãe)" },
    ],
  });

  // ---- Lívia: 12 anos, 6o ano, paralisia cerebral, acionador ----
  const livia = await prisma.student.create({
    data: {
      name: "Lívia Santos",
      birthDate: new Date("2014-07-02"),
      stage: "anos_finais",
      gradeYear: "6º ano",
      className: "Turma A",
      shift: "tarde",
      schoolId: escola2.id,
      hasAEE: true,
      aeeFrequency: "3x por semana",
      supportProfessional: true,
      guardianName: "Rodrigo Santos",
      guardianPhone: "(11) 98888-0002",
      accessibilityNotes: "Cadeira de rodas; acionador; necessita mesa adaptada e leitor de tela.",
      avatarHue: 268,
      profile: {
        create: {
          expressiveChannel: "olhar_acionador",
          receptiveChannel: "fala",
          commandSteps: 3,
          readingSupport: 1, writingSupport: 4, mathSupport: 1, attentionMinutes: 30,
          peerInteraction: 2, adultInteraction: 1, groupWork: 2,
          feeding: 4, hygiene: 5, mobility: 4, organization: 3,
          sensoryProfile: j({ auditiva: "tipica", visual: "tipica", tatil: "tipica", vestibular: "tipica", proprioceptiva: "tipica" }),
          fineMotor: 5, grossMotor: 4,
          usesWheelchairOrOrthosis: true,
          triggers: j(["pressa nas transições", "atividades sem via de resposta acessível"]),
          earlySigns: j(["desvia o olhar", "tensão corporal"]),
          calmingStrategies: j(["tempo extra anunciado", "música instrumental"]),
          bestShift: "tarde",
          taskToleranceMinutes: 30,
          interests: j(["astronomia", "séries de mistério", "histórias em quadrinhos"]),
          barriers: j(["fisica", "tecnologica", "pedagogica"]),
          strengths: "Cognitivo preservado; interpretação de texto excelente quando a via de resposta é acessível.",
        },
      },
    },
  });

  const planLivia = await prisma.plan.create({
    data: {
      studentId: livia.id,
      status: "ativo",
      initialSituation:
        "Lívia acompanha o currículo do 6º ano. A barreira é de acesso: precisa de via de resposta por acionador e materiais digitais acessíveis.",
      commonRoomStrategies: "Textos digitais com leitor de tela; múltipla escolha varrida por acionador; mesmo conteúdo cognitivo da turma.",
      aeeStrategies: "Treino de velocidade de varredura; banco de respostas frequentes na prancha digital.",
      accessibilityResources: "Acionador, leitor de tela, mesa adaptada, plano inclinado.",
      reviewDate: daysAgo(5),
      createdAt: daysAgo(75),
    },
  });

  const objLivia = await prisma.objective.create({
    data: {
      planId: planLivia.id,
      action: "responderá questões de interpretação textual",
      condition: "usando acionador",
      criterion: "80% das aulas de Língua Portuguesa",
      deadlineWeeks: 10,
      description: "Lívia responderá questões de interpretação textual, usando acionador (SUP), em 80% das aulas de Língua Portuguesa, ao longo de 10 semanas.",
      bnccCode: "EF67LP28",
      dimension: "leitura",
      currentSupport: 1, targetSupport: 0,
      createdAt: daysAgo(70),
    },
  });

  await prisma.diaryEntry.createMany({
    data: [
      { studentId: livia.id, objectiveId: objLivia.id, date: daysAgo(30), participation: "total", supportLevel: 1, criterionMet: "sim", note: "Respondeu todas as questões da aula com varredura.", whatWorked: "Múltipla escolha com 4 alternativas", recommendation: "Reduzir tempo de varredura por item.", authorRole: "professor_sala" },
      { studentId: livia.id, objectiveId: objLivia.id, date: daysAgo(18), participation: "total", supportLevel: 1, criterionMet: "sim", note: "Boa velocidade; pediu para aumentar dificuldade.", whatWorked: "Texto sobre astronomia", recommendation: "Usar textos do interesse dela como corpus.", authorRole: "professor_aee" },
    ],
  });

  await prisma.timelineEvent.createMany({
    data: [
      { studentId: livia.id, date: daysAgo(120), type: "transferencia", title: "Transferência recebida", description: "Chegou da rede vizinha com relatório de acompanhamento." },
      { studentId: livia.id, date: daysAgo(75), type: "plano", title: "PPI elaborado", description: "Foco em adaptação de acesso, não de currículo." },
      { studentId: livia.id, date: daysAgo(45), type: "recurso", title: "Acionador instalado", description: "Configurado no notebook da sala com apoio do AEE." },
      { studentId: livia.id, date: daysAgo(2), type: "alerta", title: "Plano vencido", description: "Data de revisão do PPI ultrapassada." },
    ],
  });

  await prisma.familyNote.createMany({
    data: [
      { studentId: livia.id, date: daysAgo(8), note: "Lívia terminou um livro digital sozinha usando o leitor de tela.", author: "Rodrigo (pai)" },
    ],
  });

  // ---- Ravi: 9 anos, 4o ano, deficiência intelectual, futebol ----
  const ravi = await prisma.student.create({
    data: {
      name: "Ravi Almeida",
      birthDate: new Date("2017-01-25"),
      stage: "anos_iniciais",
      gradeYear: "4º ano",
      className: "Turma C",
      shift: "manha",
      schoolId: escola1.id,
      hasAEE: true,
      aeeFrequency: "2x por semana",
      guardianName: "Juliana Almeida",
      guardianPhone: "(11) 98888-0003",
      avatarHue: 28,
      profile: {
        create: {
          expressiveChannel: "fala",
          receptiveChannel: "fala",
          commandSteps: 2,
          readingSupport: 3, writingSupport: 3, mathSupport: 2, attentionMinutes: 15,
          peerInteraction: 1, adultInteraction: 1, groupWork: 2,
          feeding: 0, hygiene: 0, mobility: 0, organization: 2,
          sensoryProfile: j({ auditiva: "tipica", visual: "tipica", tatil: "tipica", vestibular: "tipica", proprioceptiva: "tipica" }),
          fineMotor: 1, grossMotor: 0,
          triggers: j(["tarefas longas de cópia", "comparação com colegas"]),
          earlySigns: j(["dispersa", "levanta da cadeira"]),
          calmingStrategies: j(["função de ajudante", "pausa de movimento"]),
          bestShift: "manha",
          taskToleranceMinutes: 15,
          interests: j(["futebol", "videogame", "animais"]),
          barriers: j(["pedagogica", "atitudinal"]),
          strengths: "Ótima oralidade; liderança nos jogos; aprende com material concreto.",
        },
      },
    },
  });

  const planRavi = await prisma.plan.create({
    data: {
      studentId: ravi.id,
      status: "ativo",
      initialSituation: "Ravi lê palavras com sílabas simples com modelo. Escrita em nível silábico-alfabético. Muito participativo oralmente.",
      commonRoomStrategies: "Mesma tarefa da turma com corpus do futebol; tempo igual; listas reduzidas.",
      aeeStrategies: "Fichas silábicas; montagem de escalação; ditado de placar.",
      accessibilityResources: "Fichas silábicas, alfabeto móvel, apoio visual de rotina.",
      reviewDate: daysAhead(15),
      createdAt: daysAgo(50),
    },
  });

  const objRavi = await prisma.objective.create({
    data: {
      planId: planRavi.id,
      action: "lerá e escreverá palavras com sílabas simples do campo semântico do futebol",
      condition: "com pista de modelo",
      criterion: "4 de 5 tentativas",
      deadlineWeeks: 8,
      description: "Ravi lerá e escreverá palavras com sílabas simples do campo semântico do futebol, com pista de modelo (MOD), em 4 de 5 tentativas, ao longo de 8 semanas.",
      bnccCode: "EF02LP04",
      dimension: "escrita",
      currentSupport: 3, targetSupport: 2,
      createdAt: daysAgo(40),
    },
  });

  await prisma.diaryEntry.createMany({
    data: [
      { studentId: ravi.id, objectiveId: objRavi.id, date: daysAgo(25), participation: "total", supportLevel: 3, criterionMet: "parcial", note: "Escreveu BOLA e GOL com modelo. TIME com ajuda.", whatWorked: "Lista do vocabulário do futebol", recommendation: "Acrescentar CAMPO e JOGO.", authorRole: "professor_sala" },
      { studentId: ravi.id, objectiveId: objRavi.id, date: daysAgo(15), participation: "total", supportLevel: 3, criterionMet: "parcial", note: "Montou a escalação com fichas silábicas.", whatWorked: "Formato de escalação de time", recommendation: "Reduzir o modelo para pista verbal.", authorRole: "professor_aee" },
      { studentId: ravi.id, objectiveId: objRavi.id, date: daysAgo(6), participation: "total", supportLevel: 2, criterionMet: "sim", note: "Escreveu o placar do fim de semana só com pista verbal!", whatWorked: "Placar do jogo como contexto real", recommendation: "Generalizar para outros temas.", authorRole: "professor_aee" },
    ],
  });

  await prisma.timelineEvent.createMany({
    data: [
      { studentId: ravi.id, date: daysAgo(80), type: "avaliacao", title: "Avaliação pedagógica inicial" },
      { studentId: ravi.id, date: daysAgo(50), type: "plano", title: "PPI elaborado" },
      { studentId: ravi.id, date: daysAgo(6), type: "conquista", title: "Redução do nível de apoio", description: "De modelo (MOD) para pista verbal (VERB) na escrita." },
    ],
  });

  // ---- Banco municipal de recursos ----
  for (const entry of RESOURCE_CATALOG) {
    const { activities, ...resource } = entry;
    await prisma.resource.create({
      data: {
        ...resource,
        activities: {
          create: activities.map((item, position) => ({ ...item, position })),
        },
      },
    });
  }

  // ---- Autorizações das famílias (seções 12 e 14) ----
  // Dante: IA e terapeuta autorizados; Lívia: só IA; Ravi: ainda sem decisão
  // (mostra o aviso para a equipe e o portal pedindo a autorização).
  await prisma.consent.createMany({
    data: [
      { studentId: dante.id, aiUse: true, therapistLink: true, updatedBy: "Carla (mãe de Dante)" },
      { studentId: livia.id, aiUse: true, therapistLink: false, updatedBy: "Responsável por Lívia" },
    ],
  });

  // ---- Usuários com perfis de acesso (senha: demo123) ----
  const contas = [
    { name: "Secretaria de Educação", email: "secretaria@municipio.gov.br", role: "secretaria" },
    { name: "Ana Coordenadora", email: "coordenacao@escola.edu.br", role: "coordenacao", schoolId: escola1.id },
    { name: "Prof. Marcos (sala comum)", email: "professor@escola.edu.br", role: "professor_sala", schoolId: escola1.id },
    { name: "Prof.ª Beatriz (AEE)", email: "aee@escola.edu.br", role: "professor_aee", schoolId: escola1.id },
    { name: "Dra. Helena (terapeuta de Dante)", email: "terapeuta@clinica.com.br", role: "terapeuta", studentId: dante.id },
    { name: "Carla (mãe de Dante)", email: "familia@email.com", role: "familia", studentId: dante.id },
  ];
  for (const c of contas) {
    await prisma.user.create({
      data: { ...c, passwordHash: hashPassword("demo123"), schoolId: c.schoolId ?? null, studentId: c.studentId ?? null },
    });
  }

  console.log("Seed concluído:");
  console.log("- 2 escolas, 3 estudantes (Dante, Lívia, Ravi)");
  console.log("- perfis funcionais, PPIs, objetivos, diário, linha do tempo, recursos");
  console.log(`- ${contas.length} usuários com perfis de acesso (senha: demo123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
