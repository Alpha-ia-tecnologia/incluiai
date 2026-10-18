# Jornada do usuário — IncluiEdu

Documento de análise e orientação da experiência, elaborado em 17 de setembro de 2026 a partir da proposta completa e das telas e ações existentes no projeto. Maria e Dante compõem uma história fictícia para avaliar o desenho da plataforma. As metas de tempo e os critérios abaixo ainda precisam ser validados com usuários reais.

## 1. O que a experiência precisa resolver

A proposta define uma pergunta central: **quem é este estudante, o que já consegue fazer, quais barreiras enfrenta e qual é o próximo passo?** Para quem tem pouca familiaridade com tecnologia, a plataforma deve responder a essa pergunta antes de apresentar gráficos, siglas ou ferramentas avançadas.

A experiência passa a acompanhar o trabalho: **encontrar o estudante → conhecer → planejar → preparar → registrar → acompanhar**. Esse caminho orienta o primeiro uso, mas não obriga a professora a repetir todas as etapas em cada acesso. No cotidiano, ela pode ir diretamente a registrar uma aula ou consultar uma atividade já aprovada.

A sequência traduz os itens 2 a 6 e 17 da proposta. O registro alimenta a revisão do planejamento e a memória da rede descrita no item 18. A decisão pedagógica continua sendo do profissional; uma sugestão não equivale a uma atividade aplicada, nem um indicador equivale a uma avaliação conclusiva.

## 2. Fricções encontradas na versão analisada

Esta é uma inspeção das telas e do código, não uma pesquisa com usuários. A tabela registra a situação encontrada antes da reestruturação; a seção 6 distingue o que foi alterado. A coluna de impacto descreve hipóteses a confirmar no piloto.

| Evidência na interface existente | Possível dificuldade | Direção da reestruturação |
|---|---|---|
| Menu lateral privilegia ícones; rótulos dependem de dicas visuais. | A pessoa precisa adivinhar o significado ou memorizar posições. | Mostrar ícone e nome juntos, mantendo a seção atual identificada. |
| O início apresenta indicadores e acesso à biblioteca antes das principais tarefas. | A professora vê números, mas não sabe por onde começar a aula ou o registro. | Priorizar ações concretas, estudantes e pendências; deixar indicadores como consulta complementar. |
| O planejamento em lote ocupa o início da lista de estudantes, que não tem busca por nome. | Uma tarefa avançada precede a necessidade básica de encontrar uma pessoa. | Buscar e abrir o estudante primeiro; planejamento da turma como opção secundária. |
| As abas usam termos como “PPI” e “Perfil funcional”. | Conhecer o trabalho pedagógico não significa reconhecer a nomenclatura do sistema. | Usar nomes explicativos, com os termos técnicos como apoio: conhecer o estudante, plano individual, registrar aula. |
| As seções do estudante são uma lista horizontal de módulos. | É difícil perceber o que fazer primeiro, principalmente no celular. | Explicar o ciclo e o próximo passo, sem impedir a navegação direta entre etapas. |
| Quando faltam perfil ou objetivo, a tela de atividades descreve o impedimento. | A pessoa pode não saber localizar a tela citada. | Oferecer link direto para preencher o dado necessário e explicar por que ele é solicitado. |
| O diário já permite três seleções principais, mas mostra diversos campos com importância visual semelhante. | Registrar uma aula parece um formulário longo; valores preselecionados podem passar despercebidos. | Separar resultado observado, vínculo com objetivo/atividade e complemento; tornar salvar e conferir o registro explícitos. |
| O texto de voz atribui organização à IA; o componente usa reconhecimento de fala do navegador. | O usuário pode esperar transcrição organizada ou funcionamento em qualquer aparelho. | Descrever “ditar texto”, manter digitação disponível e pedir revisão antes de salvar. |
| Atividades exibem configuração técnica, promessa de menos de três minutos e referência a edição sem botão correspondente. | A interface cria expectativas que o fluxo disponível não assegura. | Explicar o que a pessoa pode fazer agora; tratar três minutos como meta de validação e edição como evolução pendente. |
| Algumas instruções e informações de contexto usam texto muito pequeno. | A pessoa precisa ampliar a tela e pode ignorar orientações essenciais. | Dar prioridade à legibilidade, áreas de toque e rótulos persistentes; conferir em celular e com ampliação. |

Fontes principais: `src/components/shell.tsx`, `src/components/student-tabs.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/estudantes/page.tsx`, telas de plano, atividades e diário, e `src/components/voice-note.tsx`.

## 3. Arquitetura por tarefas

### Navegação principal

| Destino | Pergunta que responde | Prioridade |
|---|---|---|
| Início | “O que preciso fazer agora?” | Ações do dia e pendências com destino claro. |
| Estudantes | “Quem vou acompanhar?” | Busca por nome, identificação por turma/escola e acesso ao acompanhamento. |
| Atividades e recursos | “O que pode ajudar nesta aula?” | Biblioteca complementar ao planejamento individual. |
| Painel de indicadores / Escolas e turmas | “Como está o acompanhamento e onde é preciso apoiar?” | Indicadores da própria escola para a equipe escolar e da rede (ou de uma escola) para a gestão, com filtro de período. Para a gestão, painel e cadastros ficam agrupados em Gestão da rede. |
| Acompanhar meu filho | “O que está acontecendo com meu filho e o que posso contar à escola?” | Entrada própria para o estudante vinculado. |
| Orientações para a escola | “Que informação funcional posso compartilhar?” | Entrada própria do terapeuta para o estudante vinculado. |
| Minha jornada | “Onde estou na história e qual é o próximo passo?” | A história do perfil em capítulos, marcados a partir dos dados salvos, com evidências, impacto e conquistas. |
| Ajuda e primeiros passos | “Como faço esta tarefa?” | Instruções curtas por perfil e links para funções disponíveis. |

Os nomes acompanham a navegação implementada. As rotas existentes continuam válidas e a ajuda passa a ter o endereço `/ajuda`. A reorganização visual não concede novas permissões nem altera os vínculos entre usuários e estudantes. No celular, professores têm quatro destinos visíveis; perfis de gestão encontram as opções adicionais em Menu. Família e terapeuta têm somente os destinos do próprio acompanhamento e a ajuda.

### Dentro do acompanhamento de um estudante

| Etapa | Conteúdo e ação esperada | Destino existente |
|---|---|---|
| Resumo | Identidade, próximo passo, objetivos atuais e o que já funcionou. | `/estudantes/[id]` |
| 1. Conhecer — Como aprende | Comunicação, interesses, potencialidades, barreiras e apoio necessário. | `/estudantes/[id]/perfil` |
| 2. Planejar | Plano de ensino (PPI), objetivos observáveis e data de revisão. | `/estudantes/[id]/ppi` |
| 3. Preparar | Preparar uma atividade: escolher objetivo e conteúdo da turma, avaliar sugestões e preparar recursos. | `/estudantes/[id]/atividades` e `/materiais` |
| 4. Registrar — Registrar aula | Informar o que foi trabalhado, participação, apoio e resultado; complementar com observações. | `/estudantes/[id]/diario` |
| 5. Acompanhar — Resumo e Evolução | Conferir registros, evolução dos objetivos e eventos do histórico para decidir o próximo passo. | Resumo, diário e `/linha-do-tempo` |

**Regras de experiência:** manter o nome do estudante visível; oferecer volta para a lista; apresentar uma ação principal por bloco; acompanhar cores e ícones com texto; explicar o que falta em estados vazios; permitir voltar e consultar etapas sem reiniciar o trabalho. Materiais e histórico são apoio ao ciclo, não pré-requisitos para registrar.

O próximo passo implementado usa dados salvos: sem perfil, conhecer; sem plano ou objetivo ativo, planejar; sem atividade aceita ou aplicada, preparar; com atividade preparada, registrar. Quando já há registros, continua oferecendo registrar a próxima aula. Acompanhar e revisar ficam disponíveis no resumo e nas seções do estudante; não há decisão automática de encerrar um ciclo. A pessoa pode registrar uma observação mesmo sem atividade gerada. As seções ficam numa linha de abas que rola de lado, no celular e no computador.

### Entradas por perfil e tarefa

- Professor, AEE, apoio e coordenação: Registrar uma aula; Preparar uma atividade; Acompanhar um estudante. Cada entrada leva à lista com a intenção preservada (`acao=registrar`, `preparar` ou `acompanhar`).
- Secretaria e gestão: Acompanhar a rede; Consultar um estudante; Organizar escolas e turmas.
- Família: acompanhamento do estudante vinculado. Terapeuta: orientações para a escola. Quando o vínculo ainda não existe, o início orienta pedir a conferência do cadastro à escola.
- Preparar uma atividade leva primeiro ao perfil ou plano quando falta um pré-requisito. Registrar uma aula continua disponível sem exigir a geração de uma atividade.

## 4. A história de Maria e Dante

Maria é professora da sala comum e acompanha Dante, de 7 anos, em parceria com a professora do AEE. Ela usa o celular para mensagens, mas receia “clicar errado” em sistemas com muitos menus. Quer preparar uma aula em que Dante participe junto da turma e registrar o resultado sem reconstruir um relatório inteiro. A persona é uma hipótese de projeto, não o relato de uma entrevistada.

### Primeiro acesso: “Eu preciso encontrar Dante”

A escola já providenciou o acesso de Maria. Ela entra com e-mail e senha. O início a recebe pelo nome e oferece ações reconhecíveis, como encontrar um estudante e registrar uma aula. Maria não precisa escolher um perfil profissional nem cadastrar uma nova conta para começar.

Ela abre Estudantes, busca “Dante” pelo nome e, se necessário, filtra a turma. A busca aceita parte do nome sem exigir acentos. Maria confere turma e escola antes de abrir o acompanhamento. Se não encontrar o nome, a tela explica que não há resultado e permite limpar a busca. A orientação é conferir com a equipe responsável pelo cadastro, evitando duplicar o estudante por engano.

### Conhecer: “O que ajuda Dante a participar?”

No resumo, Maria encontra a ação para conhecer o estudante. Consulta os interesses, a comunicação e as estratégias registradas pela equipe. No exemplo da proposta, Dante gosta de dinossauros, responde apontando e se beneficia de instruções visuais e de um ambiente com menos ruído. Esses dados ajudam a planejar; o diagnóstico não substitui a observação pedagógica.

Se o perfil ainda não existir, o caminho orienta seu preenchimento. Maria registra o que conhece e pede apoio à equipe quando necessário. Ela não deve inventar informações apenas para concluir uma tela.

### Planejar: “Qual avanço vamos observar?”

Maria abre o plano individual e combina com o AEE um objetivo observável: Dante identificar o próprio nome entre cinco opções, com pista visual, em quatro de cinco tentativas, ao longo de seis semanas. Ela confere situação inicial, recursos e data de revisão.

Quando já existe um objetivo ativo adequado, Maria o reutiliza. A plataforma não deve induzir a criação de outro plano a cada aula. “Planejar” significa definir e consultar o próximo passo, não preencher o cadastro novamente.

### Preparar: “Como fazer isso na aula da turma?”

Em atividades, Maria escolhe o objetivo e informa que a aula terá a chamada da turma. Recebe sugestões para sala comum, AEE e casa. Lê materiais, passos, forma de resposta e adaptações; confere como Dante participa com os colegas.

Ela aprova a sugestão apropriada em “Usar esta atividade”. A atividade aceita oferece o atalho “Registrar como foi a aula”, que leva ao diário com a atividade e seu objetivo selecionados quando disponíveis. Se ela não servir, pode rejeitar e explicar o motivo. A história não pressupõe edição completa do cartão, agenda automática ou envio por mensagem: esses fluxos não estão comprovados na versão analisada. A impressão disponível pode apoiar a aplicação em sala.

### Registrar: “Quero guardar o que aconteceu”

Após a aula, Maria usa “Registrar uma aula” no início e escolhe Dante, mantendo a tarefa durante a busca, ou abre o atalho da atividade aceita. O diário organiza o preenchimento em três partes: o que foi trabalhado, como o estudante participou e o que aconteceu. Maria confere o objetivo e a atividade e escolhe participação, apoio necessário e resultado observado; essas observações não vêm preenchidas por padrão. Acrescenta: “Identificou o nome entre três opções com pista visual. A atividade com dinossauros ajudou a manter o interesse.”

Maria registra o desempenho real, mesmo quando ele fica aquém do objetivo de cinco opções. Em “próximo encontro”, sugere retomar três opções antes de aumentar a dificuldade. Pode digitar ou usar o ditado se o navegador oferecer o recurso; em ambos os casos, confere o texto e aciona salvar. O fluxo não depende de gravação ou transcrição por IA no servidor.

Ao salvar, Maria vê o estado de salvamento e a confirmação com acesso ao histórico. O botão fica indisponível durante o envio, evitando o segundo clique na mesma operação. Se não for possível confirmar o salvamento, as respostas ficam no formulário e a mensagem orienta a conferir o histórico antes de tentar novamente. Saber que a ação terminou é parte essencial da experiência. Não se pressupõe salvamento automático: sair de um formulário sem salvar ainda requer cuidado e deve ser tratado nas evoluções do produto.

### Acompanhar: “O que mudou e o que vamos tentar?”

Nos dias seguintes, Maria e a professora do AEE consultam os registros e o resumo dos objetivos. Comparam participação e apoio necessário em tarefas semelhantes, sem concluir que uma única tentativa representa toda a aprendizagem de Dante.

A família pode registrar uma observação de casa, que aparece no acompanhamento. O terapeuta vinculado pode enviar orientações funcionais para a escola no espaço próprio. Nenhum deles precisa navegar no diário completo do professor para contribuir.

Na revisão, a equipe usa as evidências para manter uma estratégia, marcar um objetivo como alcançado ou colocá-lo em revisão e formular um próximo passo. A data ajuda a lembrar a revisão. Em Revisão do plano, a equipe registra o que decidiu e a próxima data, e a plataforma guarda se a revisão saiu no prazo. Para recomeçar, a equipe encerra o plano com um motivo: ele fica em Planos anteriores, e só então um novo plano pode ser criado. Editar integralmente um plano ativo continua sendo uma evolução a definir. O ciclo recomeça a partir do que Dante já realizou, preservando a memória do acompanhamento.

## 5. Histórias de usuário e critérios de aceitação

Os critérios são requisitos para conferir a experiência pretendida. Eles não significam que todas as condições já foram implementadas ou testadas.

### HU01 — Professor da sala comum ou AEE: encontrar o estudante

**Como** profissional da escola, **quero** encontrar um estudante pelo nome e reconhecer sua turma, **para** iniciar o acompanhamento da pessoa certa.

- A busca mantém um rótulo visível e pode ser enviada pelo teclado.
- O resultado mostra nome e contexto escolar; não depende apenas de foto ou cor.
- Sem resultado, a tela informa o ocorrido e oferece limpar a busca, preservando o escopo de acesso autorizado.

### HU02 — Professor da sala comum ou AEE: entender o próximo passo

**Como** profissional que acessa a plataforma pela primeira vez, **quero** saber o que falta no acompanhamento, **para** continuar sem decorar siglas ou a ordem dos menus.

- O resumo mantém o nome do estudante e apresenta uma ação coerente com os dados existentes.
- Faltando perfil, plano ou objetivo, o texto explica o motivo e leva à etapa correspondente.
- Etapas disponíveis continuam acessíveis; a orientação não bloqueia o registro de observações.

### HU03 — Professor da sala comum ou AEE: preparar uma atividade

**Como** professor, **quero** usar um objetivo ativo e o conteúdo da aula da turma, **para** preparar uma atividade inclusiva adequada ao estudante.

- A geração exige os dados pedagógicos necessários e oferece caminho para completar o que falta.
- A sugestão identifica contexto, passos, materiais, resposta aceita, critério de sucesso e adaptações.
- Aprovar ou rejeitar é uma decisão explícita do profissional; a tela distingue sugestão, atividade aceita e atividade aplicada.

### HU04 — Professor da sala comum ou AEE: registrar a aula

**Como** professor com pouco tempo após a aula, **quero** registrar o resultado observado, **para** orientar o próximo encontro sem escrever um relatório longo.

- Participação, apoio necessário e resultado têm rótulos compreensíveis; campos adicionais são identificados como complemento quando opcionais.
- O usuário pode vincular objetivo/atividade e revisar qualquer texto ditado antes de salvar.
- Salvar produz um resultado perceptível e o registro pode ser localizado na lista; falhas não podem parecer sucesso. O feedback de envio e bloqueio de duplo clique fazem parte do formulário; precisam ser conferidos na verificação funcional e no teste com usuários.

### HU05 — Professor do AEE: acompanhar e revisar

**Como** professor do AEE, **quero** consultar registros, estratégias e objetivos, **para** discutir com a sala comum se o próximo passo precisa mudar.

- O resumo diferencia ausência de registros de ausência de progresso.
- Os níveis de apoio aparecem com descrição, sem exigir memorização de códigos.
- Marcar um objetivo como alcançado ou em revisão continua sendo uma ação humana. O histórico não deve ser apresentado como se reunisse automaticamente todo evento ainda não integrado.

### HU06 — Coordenação: organizar prioridades

**Como** coordenadora, **quero** localizar acompanhamentos que precisam de atenção, **para** apoiar a equipe em uma ação concreta.

- Pendências explicam o motivo, identificam o contexto permitido e oferecem destino relacionado.
- Falta de registro é tratada como necessidade de conferir o acompanhamento, não como prova automática de falta de atendimento.
- Orientações de navegação respeitam o perfil atual; a reestruturação não cria acesso a novos estudantes.

### HU07 — Secretaria: usar indicadores da rede

**Como** integrante da Secretaria, **quero** consultar indicadores e demandas consolidadas, **para** planejar recursos e apoio às escolas.

- O painel informa o significado das contagens e diferencia quantidade de registros de resultado pedagógico.
- A navegação separa consulta de indicadores de cadastros administrativos.
- A gestão consulta o painel permitido ao perfil, sem expor novos dados individuais por causa da mudança visual.

### HU08 — Família: participar do acompanhamento

**Como** responsável pelo estudante, **quero** compreender os objetivos e contar uma conquista de casa, **para** contribuir com a equipe escolar.

- O acesso abre o acompanhamento do estudante vinculado e usa linguagem cotidiana.
- Objetivos, atividades de casa aceitas, conquistas e observações da família têm seções reconhecíveis.
- A observação enviada pode ser localizada posteriormente; o texto não promete resposta imediata, chat ou notificação que ainda não existem.

### HU09 — Terapeuta: compartilhar orientações funcionais

**Como** terapeuta vinculado, **quero** enviar orientações aplicáveis à escola, **para** apoiar comunicação, acessibilidade e participação.

- A tela identifica o estudante vinculado e explica a finalidade dos campos.
- Comunicação, recursos e estratégias têm rótulos claros e indicação dos campos obrigatórios.
- O relatório enviado fica consultável no espaço existente; a interface não oferece acesso ao diário pedagógico completo ou prontuário clínico.

### HU10 — Todos os perfis: navegar com confiança

**Como** usuário com pouca familiaridade digital, **quero** reconhecer onde estou e como voltar, **para** realizar a tarefa com autonomia.

- Navegação tem nomes visíveis, estado atual e foco perceptível ao usar teclado.
- Ações essenciais permanecem alcançáveis no celular; zoom e textos maiores não ocultam botões.
- Ajuda apresenta poucas instruções por tarefa e links válidos, sem exigir um tutorial obrigatório para cada acesso.

## 6. O que existe e o que fica como evolução

| Situação | Recursos |
|---|---|
| Base existente inspecionada | Login; cadastro do estudante; perfil estruturado; criação de plano e objetivos; marcação de objetivo alcançado/em revisão; sugestões por regras e IA opcional; aceitar/rejeitar atividades; materiais imprimíveis; diário; resumo de evolução; eventos de linha do tempo; biblioteca; painel municipal; observações da família; relatórios do terapeuta. |
| Reestruturação de experiência desta entrega | Início com tarefas antes dos indicadores; menu com nomes e adaptação ao celular; busca por parte do nome, sem exigir acentos, com filtro de turma; manutenção da tarefa escolhida nos filtros; cartões com próximo passo; planejamento da turma recolhido ao fim da lista; ciclo orientado por dados do estudante; seções com nomes simples; ajuda por perfil; plano com exemplo de objetivo; pré-requisitos de atividades com links; atalho da atividade aceita para o diário; diário em três partes, sem respostas de observação preselecionadas, com salvamento explícito e feedback; descrição correta do ditado do navegador. A conferência final deve usar os critérios deste documento. |
| Capacidade com limite explícito | Ditado depende do navegador. A linha do tempo mostra os eventos armazenados nela e não deve ser confundida com uma sincronização completa de todos os registros. A família consulta atividades de casa aceitas/aplicadas; não se pressupõe envio por mensagem. |
| Evoluções a especificar e implementar separadamente | Recuperação de senha guiada; rascunhos e salvamento automático; prevenção de perda ao sair; edição/versionamento completo do plano; edição de cartões de atividade; agenda e lembretes; transcrição organizada por IA no servidor; chat; confirmação de reuniões; envio de documentos; autorizações digitais; integrações externas; novos perfis e permissões. |

O início e a lista agora aplicam o mesmo recorte de escola para profissionais vinculados, enquanto os destinos de gestão mantêm a autorização existente. A análise de UX não substitui uma revisão técnica das permissões nas rotas e ações. Não se considera ocultar um item de menu como verificação de autorização.

### Jornada guiada por perfil (implementada em 16 de outubro de 2026)

A história de Maria e Dante virou uma experiência na plataforma, em `/jornada`, com boas-vindas no primeiro acesso (Início, página da família e página do terapeuta) e um resumo permanente do progresso.

| Perfil | História | Capítulos (marcados pelos dados) |
|---|---|---|
| Professor da sala comum, AEE e apoio | A história de um estudante; começa pelo último aberto e permite trocar | Ouvir a história (estudo de caso) → Conhecer como aprende → Combinar o objetivo → Preparar uma aula com a turma → Registrar → Ver o que mudou e ajustar |
| Coordenação e gestão | A história da escola | Panorama no painel → Plano para cada estudante → Revisões no prazo → Registros das aulas → Família e saúde → Datas inclusivas |
| Secretaria | A história da rede | Painel da rede → Escolas e turmas → Planos → Recursos de comunicação → Banco de práticas → Datas inclusivas |
| Família | A própria participação | Saber o que a escola trabalha → Fazer uma atividade em casa (botão “Fizemos esta atividade”, que avisa a escola) → Contar uma conquista |
| Terapeuta | As orientações à escola | Conhecer o estudante → Enviar orientações → Saber que a escola recebeu → Atualizar |

Regras: os capítulos orientam, não bloqueiam; o capítulo atual acompanha o próximo passo do estudante; capítulos que dependem de outra pessoa aparecem como “Aguardando”; cada capítulo mostra a evidência real (data, objetivo, número de registros) e a ação seguinte. Visitas sem outro rastro (painel, recursos, calendário, cadastros, boas-vindas) ficam em `JourneyMark`. A saudação usa o primeiro nome sem títulos (“Beatriz”, não “Prof.ª”) e “Boas-vindas”, sem presumir gênero.

### Assistente com agente (implementado em 16 de outubro de 2026)

Um chat com agente, em popup em todas as telas e em página própria (`/assistente`), para cada perfil: dúvidas sobre a plataforma e os conceitos (escala de apoio, PPI, 3 toques), consulta ao acompanhamento, propostas de plano e atividades pelos agentes, materiais acessíveis, registro de aula, decisão sobre atividades e objetivos, recursos, painel e calendário. A família conta conquistas e tira dúvidas em linguagem simples; o terapeuta envia orientações funcionais.

Regras: o assistente propõe e a pessoa decide (toda alteração passa por um cartão de confirmação, executado só depois do clique, com a permissão conferida de novo); as ferramentas respeitam o escopo de cada perfil; os dados chegam ao modelo com pseudônimos por conversa e os nomes voltam só na tela de quem tem acesso; cada consulta a um estudante entra no histórico de acessos que a família vê; operações demoradas (plano, atividades) avisam antes e mostram o andamento.

## 7. Roteiro de teste com usuários reais

**Situação: proposto, ainda não realizado.** Fazer uma primeira rodada com 6 a 8 participantes que tenham pouca familiaridade digital: professores da sala comum e AEE, coordenação/Secretaria, familiares e terapeuta. O objetivo é identificar dificuldades, não produzir uma estimativa estatística de toda a rede. Usar dados fictícios, ambiente de teste e o dispositivo habitual da pessoa, incluindo celulares menores.

Cada sessão dura aproximadamente 30 a 40 minutos. O facilitador apresenta a situação e pede que a pessoa diga o que pensa enquanto tenta resolver. Evita apontar o botão correto. Se precisar ajudar, registra quando e por quê. Deixar claro que estamos avaliando a plataforma, não a habilidade da pessoa.

| Tarefa apresentada, sem indicar o caminho | Observar | Sinal de conclusão |
|---|---|---|
| “Você vai acompanhar Dante. Encontre as informações dele.” | Primeira ação, uso da busca e identificação da turma. | Abre o estudante correto sem ajuda. |
| “Descubra o que ajuda Dante a aprender e qual objetivo está em andamento.” | Compreensão dos nomes das etapas e leitura do resumo. | Explica interesse, barreira e objetivo com suas palavras. |
| “Prepare uma atividade para a chamada da turma.” | Encontrar planejamento, reconhecer pré-requisitos e revisar sugestão. | Localiza uma proposta e decide se pode usá-la. |
| “A aula terminou. Dante participou com pista visual e atingiu parte do resultado. Guarde essa informação.” | Valores preselecionados, vínculo correto, salvar e certeza de conclusão. | Salva um registro coerente e consegue encontrá-lo. |
| “Você voltará a trabalhar com ele amanhã. Veja o que funcionou.” | Continuidade entre registro, resumo e planejamento. | Localiza a estratégia registrada e sugere próximo passo. |
| Coordenação/Secretaria: “Identifique um acompanhamento que precisa de atenção e explique o que faria.” | Se entende a pendência e distingue indicador de evidência conclusiva. | Encontra o contexto permitido e uma ação possível. |
| Família: “Veja o que a escola está trabalhando e conte uma conquista que aconteceu em casa.” | Linguagem, localização da observação e entendimento do envio. | Consulta objetivo e localiza a observação salva. |
| Terapeuta: “Compartilhe uma orientação que ajude a escola na comunicação.” | Entendimento de finalidade e dos campos obrigatórios. | Envia relatório funcional e o encontra no histórico disponível. |

Executar também um cenário sem perfil/objetivo, uma busca sem resultado e navegação por teclado. Conferir, em cada perfil, se a ajuda leva a destinos permitidos. Para o teste de voz, permitir a alternativa digitada quando o navegador não oferecer ditado.

**Registrar por tarefa:** conclusão sem ajuda/com ajuda/não concluída; tempo; primeiro clique; retornos desnecessários; erros; termos que geraram dúvida; se a pessoa soube que salvou; nota de facilidade de 1 a 5 e uma frase explicando essa nota.

**Metas iniciais de produto, não resultados medidos:** encontrar o estudante em até 30 segundos; pelo menos 80% de conclusão sem ajuda nas tarefas principais; preparar uma atividade em até 3 minutos quando perfil e objetivo já estiverem preenchidos; completar o registro habitual em até 2 minutos; nenhuma pessoa encerrar acreditando que salvou quando o registro não foi persistido. Cronometrar a espera do sistema separadamente ajuda a distinguir problema de interface de lentidão.

Depois da rodada, priorizar primeiro erros de estudante, perda de informação e falso sucesso; depois bloqueios de tarefa e dificuldade de localização; por fim ajustes visuais. Revisar os pontos encontrados e repetir as tarefas problemáticas com outros participantes. A aprovação técnica do código e a inspeção visual não substituem essa validação.

## 8. Referências do projeto

- [Proposta completa](../plataforma-educacao-inclusiva-proposta-completa.md): itens 2–6, 7–8, 10–14, 16 e 17–18.
- [README](../README.md): mapa de funcionalidades, ambiente de demonstração e limites de implantação.
- Telas e componentes citados na análise: evidência da implementação inspecionada, sujeita às alterações desta reestruturação.



## 9. Verificação técnica desta implementação

Realizada em ambiente local, com a versão de produção e uma cópia separada do banco de dados. Os registros da plataforma não foram usados para os testes de escrita.

- ESLint e compilação de produção, incluindo TypeScript, aprovados.
- Sete cenários do próximo passo conferidos: ausência de perfil, plano ou objetivo; sugestões ainda não aceitas; atividade preparada com e sem registros; cadastro vazio.
- Navegação e ajuda conferidas nos acessos de professor, Secretaria, família e terapeuta.
- Tela inicial conferida em larguras de 320, 390, 768, 1024 e 1440 pixels, sem transbordamento horizontal. Busca, sete seções do estudante e ajuda conferidas em 390 pixels, também sem transbordamento e sem erros JavaScript.
- Busca por estudante e preservação da tarefa escolhida conferidas, inclusive busca sem resultado.
- Oito verificações do registro de aula em banco isolado aprovadas, incluindo vínculo da atividade ao objetivo, ausência de respostas de desempenho automáticas, falha de rede com preservação das respostas e sem inserção, bloqueio de envio duplicado, persistência de exatamente um registro, atualização do histórico e da situação da atividade e limpeza após confirmação.
- Os seletores da suíte E2E existente foram atualizados. A suíte completa, que cria outros dados e aciona geração de atividades, não foi executada nesta revisão.

Essas verificações confirmam o comportamento técnico observado; o roteiro com pessoas de pouca familiaridade digital da seção 7 continua pendente.