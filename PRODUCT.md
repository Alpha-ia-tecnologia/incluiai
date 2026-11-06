# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Professora ou professor da sala comum**: acompanha estudantes com deficiência, TEA ou altas habilidades na turma regular, com pouco tempo e, em geral, sem formação em educação especial. Registra aulas, prepara atividades com a turma e consulta o que funciona. Contribui para o estudo de caso, mas não o conduz.
- **Professora ou professor do AEE** (Atendimento Educacional Especializado): conduz o estudo de caso, o perfil funcional ("Como aprende") e o plano individual; prepara materiais e acompanha a evolução.
- **Coordenação pedagógica e gestão escolar**: acompanham a escola, organizam turmas e cadastros, apoiam a equipe.
- **Secretaria Municipal de Educação**: gere a política de educação inclusiva da rede; acompanha indicadores agregados por escola. É quem decide adotar a plataforma.
- **Profissional de apoio**: participa do dia a dia do estudante na escola.
- **Família**: acompanha o próprio filho ou filha pelo celular, registra conquistas de casa, vê quem acessou os dados. Pode ter pouca familiaridade com termos escolares.
- **Terapeuta da rede de saúde**: envia à escola orientações funcionais sobre um estudante vinculado; não vê diário pedagógico nem dados administrativos.

## Product Purpose

Plataforma municipal de acompanhamento do AEE e de gestão da política de educação inclusiva. Responde, para cada estudante e todos os dias: quem é este estudante, quais barreiras enfrenta, o que já foi feito, o que funcionou e qual é o próximo passo. Transforma registros dispersos (cadernos, laudos, relatórios, arquivos individuais) em acompanhamento contínuo, planejamento colaborativo e decisões mais precisas. As quatro dimensões da política nacional organizam dados e indicadores: acesso, participação, permanência e aprendizagem.

Sucesso: cada estudante do AEE com estudo de caso, plano individual com objetivo observável e registros de aula frequentes; a professora sabe o próximo passo sem procurar; a Secretaria enxerga onde a rede precisa de apoio.

## Positioning

Produto oferecido a várias redes municipais (não feito sob medida para um município). O diferencial não é "ter IA": é um **ciclo municipal de evidências** (observar → registrar → planejar → intervir → avaliar → ajustar → compartilhar) apoiado por uma **escala única de nível de apoio** (0 a 5), que mede avanço como redução de apoio na mesma tarefa, sem nota. A IA é opcional e assistiva: sugere planos e atividades, a pessoa decide, e tudo que altera o acompanhamento passa por confirmação. Os dados chegam aos modelos sem nomes (pseudônimos).

## Operating Context

- Escolas públicas municipais, muitas vezes com computadores e redes lentas; professoras usam também o celular.
- Registro rápido logo depois da aula ("registro em 3 toques", com ditado por voz).
- Materiais impressos para a sala: rotinas visuais, histórias sociais, pranchas de comunicação alternativa (CAA), atividades.
- Reuniões de equipe e com a família apoiadas por "perguntas para a reunião" e pela linha do tempo do estudante.
- Implantação planejada em piloto: 3 a 5 escolas, 50 a 100 estudantes, um semestre (proposta em `plataforma-educacao-inclusiva-proposta-completa.md`).

## Capabilities and Constraints

- Funções: cadastro de estudantes (inclusive em lote por turma), estudo de caso, perfil funcional, plano individual com objetivo observável, atividades (3 sugestões: sala comum, AEE, casa), materiais acessíveis, diário de aula, linha do tempo, painel de indicadores por escola e rede, banco de recursos, calendário inclusivo, portal da família, orientações do terapeuta, assistente com agente.
- Acesso por necessidade de saber: família e terapeuta só alcançam o estudante vinculado; toda consulta ou alteração é registrada e mostrada à família.
- O AEE é pedagógico e **não depende de laudo** (Nota Técnica MEC/SECADI/DPEE nº 04/2014).
- Terminologia definida: "Plano individual" é o nome do plano em toda a interface ("PPI" só como nome formal na Ajuda); níveis de apoio aparecem pelo nome ("Instrução verbal"), nunca pelo código interno (VERB, SUP).
- Dados sensíveis de crianças (saúde, diagnóstico informado pela família): LGPD. Uso do provedor de IA reserva (DeepSeek, que processa dados na China) fica registrado no histórico de acessos da família.
- Stack existente: Next.js 16, Tailwind CSS 4, Prisma (SQLite em desenvolvimento; PostgreSQL previsto em produção).
- Em aberto: recuperação de senha pela plataforma (hoje a família ou a professora pede à coordenação); limite de tentativas de login.

## Brand Commitments

- Nome: **IncluiEdu**.
- **Personagens ilustrados** (`public/illustrations/characters/`: planning, care, learning, ideas, resources), adaptados de uma referência fornecida pelo dono do produto: ficam no redesenho.
- Direção pedida pelo dono do produto (nov/2026): visual **mais sóbrio e institucional**, pensando nas Secretarias Municipais como quem decide a adoção.
- Textos de assinatura existentes, não declarados como fixos: "Inteligência Municipal para Educação Inclusiva" e "Cada pessoa, uma possibilidade."

## Evidence on Hand

- Proposta técnica e pedagógica completa: `plataforma-educacao-inclusiva-proposta-completa.md`.
- Dados apenas de demonstração (seed em `prisma/seed.mjs`), com estudantes e escolas fictícios.
- Não há municípios clientes, piloto realizado, depoimentos, números de impacto ou certificações. Nada disso pode ser inventado em telas ou materiais.

## Product Principles

1. **O próximo passo antes do relatório**: cada tela responde o que fazer agora com aquele estudante.
2. **Linguagem de quem usa**: sem siglas e códigos internos; a família e a sala comum entendem sem glossário.
3. **Pedagógico, não clínico**: descreve barreiras e apoios, não diagnósticos; nunca exige laudo.
4. **A pessoa decide**: IA e regras sugerem; a professora escolhe, e mudanças no acompanhamento pedem confirmação ou podem ser desfeitas.
5. **Transparência com a família**: quem acessou, o quê e quando, em palavras simples.

## Accessibility & Inclusion

- Padrão exigido: **eMAG (Modelo de Acessibilidade em Governo Eletrônico) e WCAG 2.1 nível AA**, requisito de compras públicas e da Lei Brasileira de Inclusão.
- Pessoas usuárias podem ter deficiência (professoras, famílias); baixa visão, uso só de teclado e leitor de tela precisam funcionar.
- Famílias com pouca leitura e uso pelo celular; textos curtos e alvos de toque de 44 px.
- Computadores lentos nas escolas: páginas leves, estados de carregamento visíveis.
- Materiais impressos precisam funcionar em preto e branco.
