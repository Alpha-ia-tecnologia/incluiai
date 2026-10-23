# IncluiEdu — Sistema Municipal de Inteligência para a Educação Inclusiva

Plataforma de acompanhamento do Atendimento Educacional Especializado (AEE) e gestão da política municipal de educação inclusiva, implementada a partir da proposta em [`plataforma-educacao-inclusiva-proposta-completa.md`](./plataforma-educacao-inclusiva-proposta-completa.md).

> **Quem é este estudante, quais barreiras ele enfrenta, o que já foi realizado, o que funcionou e qual deve ser o próximo passo?**

## Stack

- **Next.js 16** (App Router, Server Components e Server Actions) + TypeScript
- **Tailwind CSS 4** com o **tema visual IncluiEdu**, no padrão da apresentação da plataforma (azul-marinho nos textos, azul para marca e ações, superfícies azul-claras, a faixa azul-claro, amarelo e verde, cores semânticas para estado — verde, âmbar, coral — e cinco cores suaves para categorias — céu, verde-água, pêssego, sálvia, rosa —, todas com contraste ≥ 4.5:1; tipografia Noto Sans + JetBrains Mono, navegação lateral compacta e adaptação para celular) — tokens em `src/app/globals.css`
- **Prisma 6**: SQLite no desenvolvimento e nos testes, PostgreSQL em produção (veja [Banco de dados em produção](#banco-de-dados-em-produção-postgresql))
- **Autenticação** própria: sessão guardada no servidor (o cookie httpOnly leva só um código aleatório; vale 8 h, cai após 2 h sem uso e é apagada ao sair), senha com scrypt e limite de 5 tentativas erradas por e-mail em 15 minutos, e verificação em duas etapas por aplicativo autenticador (TOTP, RFC 6238, com códigos de recuperação), obrigatória para a equipe com `REQUIRE_2FA=1`
- **Agentes de IA opcionais** orquestrados com **LangGraph** (`@langchain/langgraph`), chamando o Claude pelo SDK oficial (`@anthropic-ai/sdk`) com saída estruturada (Zod) — geram propostas de plano (PPI) e atividades. Sem chave, o motor de regras determinísticas + templates assume

## Como rodar

```bash
npm install
npm run db:setup         # banco SQLite (prisma/dev.db) + 6 usuários de demonstração (senha: demo123)
npm run dev              # http://localhost:3000
```

Testes: `npm run test:unit` (regras puras), `BASE=http://127.0.0.1:3214 node e2e-test.mjs` (jornadas no navegador) e `BASE=… node visual-check.mjs [pasta]` (todas as telas: acessibilidade com axe, sem rolagem horizontal a 320 px, um único h1 e sem erro de cliente; `TEXT_SCALE=3` repete tudo com o texto no tamanho maior). Os dois últimos rodam contra um build (`next build` + `next start`) com um banco de demonstração.

Opcional — IA (todas as chaves no `.env`, comentadas como exemplo):
- `ANTHROPIC_API_KEY` liga os agentes de IA (modelo padrão `claude-opus-5-5`; troque com `ANTHROPIC_MODEL`).
- **Autorizações da família** (`/familia/[id]`, cartão Autorizações): a IA só recebe dados de um estudante cuja família autorizou o uso (sem isso, plano, atividades, materiais e apoios do DUA saem pelas regras da plataforma e o assistente não consulta o estudante), e o terapeuta só vê o estudante e envia orientações com a conexão autorizada. A família pode retirar as autorizações a qualquer momento; cada decisão fica no histórico de acessos.
- `SESSION_COOKIE_SECURE`: em produção o cookie da sessão só trafega por HTTPS. Para testar o build de produção em `http://` fora do `localhost`/`127.0.0.1`, use `SESSION_COOKIE_SECURE=0`.
- `REQUIRE_2FA=1` (recomendado em produção): a equipe da escola e a da rede só entram com a verificação em duas etapas; quem ainda não ligou liga logo depois da senha, em `/login/duas-etapas`. Sem a variável, cada pessoa liga quando quiser em **Segurança da conta** (`/conta/seguranca`, no menu com o nome). Família e terapeuta podem ligar, sem obrigação.
- `DEEPSEEK_API_KEY` **com** `DEEPSEEK_ENABLED=1` liga o DeepSeek como fallback quando o Claude falha (sem a ligação explícita, a chave sozinha não basta) (modelo padrão `deepseek-flash`; troque com `DEEPSEEK_MODEL`). **LGPD:** a DeepSeek processa e armazena dados na China; cada uso fica registrado no histórico de acessos visto pela família.
- `OPENAI_API_KEY` liga as imagens de apoio das atividades (pictogramas), pela OpenAI (modelo padrão `gpt-image-2.5-flare`; troque com `OPENAI_IMAGE_MODEL`).
- `SMTP_URL` (ex.: `smtps://usuario:senha@smtp.prefeitura.gov.br`) **com** `EMAIL_FROM` ligam o e-mail dos avisos, para quem escolher recebê-lo. `APP_URL` é o endereço da plataforma que vai no link do e-mail.

### Contas de demonstração (senha `demo123`)

| Perfil | E-mail | O que vê |
|---|---|---|
| Secretaria | `secretaria@municipio.gov.br` | Rede inteira + painel de indicadores |
| Coordenação | `coordenacao@escola.edu.br` | Estudantes + painel |
| Professor(a) sala comum | `professor@escola.edu.br` | Estudantes da sua escola |
| Professor(a) do AEE | `aee@escola.edu.br` | Estudantes da sua escola |
| Terapeuta | `terapeuta@clinica.com.br` | Apenas perfil funcional + articulação do seu paciente |
| Família | `familia@email.com` | Apenas o próprio filho(a) |

## Banco de dados em produção (PostgreSQL)

O desenvolvimento e os testes usam SQLite; a produção, PostgreSQL. O schema de referência continua em `prisma/schema.prisma`. O do PostgreSQL (`prisma/postgresql/schema.prisma`) é gerado a partir dele, porque o Prisma não troca o tipo de banco por variável de ambiente, e as migrações ficam em `prisma/postgresql/migrations`.

1. No `.env`, preencha `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD`. A senha vai **entre aspas**: sem elas, o que vem depois de um `#` é lido como comentário. `POSTGRES_SSL=sim` exige conexão criptografada; use `nao` só com o banco na mesma máquina. Quem já tem o endereço completo pode colá-lo no `DATABASE_URL` (`postgresql://usuario:senha@host:5432/banco`) e deixar os campos vazios.
2. `npm run db:configurar` testa a conexão, troca o `DATABASE_URL` do `.env` pelo do PostgreSQL (o do SQLite fica comentado, para voltar), cria as tabelas e carrega o catálogo de atividades e recursos. Avisa quando a conexão com um servidor de fora vai sem criptografia (`sslmode=disable`).
3. `npm run db:admin -- --nome "Seu nome" --email voce@municipio.gov.br` cria a primeira conta da Secretaria. A senha temporária aparece uma vez só e é trocada no primeiro acesso; as outras contas se criam na plataforma, em Pessoas e acessos.
4. `npm run build && npm start`.

- **Mudou o schema?** Edite `prisma/schema.prisma`, gere a migração com `npm run db:migracao -- nome-da-mudanca` (compara com a última, sem precisar de banco) e aplique em cada servidor com `npm run db:tabelas`.
- `node prisma/seed.mjs` apaga todos os dados. Num PostgreSQL, só roda com `SEED_DEMO_OK=1`, para um banco de testes.
- O cliente do Prisma é gerado para o banco do `DATABASE_URL` antes de `npm run dev`, `npm run build` e depois do `npm install`. O `DATABASE_URL` da linha de comando vence o do `.env`: é assim que os testes usam o SQLite.
- No PostgreSQL, a busca de texto vai com `mode: "insensitive"` (`src/lib/db-text.ts`), para não diferenciar maiúsculas, como no SQLite.

## Mapa de funcionalidades → proposta

| Rota | Funcionalidade | Item |
|---|---|---|
| `/login` | Autenticação por e-mail e senha | 14 |
| `/` | Painel da escola (escopo por perfil) + perguntas para reunião | 10, 9 |
| `/estudantes` · `/novo` | Prontuário + **geração em lote por turma** | 2, 17.8 |
| `/estudantes/[id]` | Visão geral: evolução, estratégias, **perguntas para reunião**, articulação intersetorial | 6, 9 |
| `/estudantes/[id]/estudo-de-caso` | **Estudo de caso** (diagnóstico pedagógico): motivo, histórico escolar, entrevista com a família, escuta do estudante, observação, avaliação pedagógica e síntese; rascunho, conclusão e relatório imprimível. Não exige laudo | — |
| `/estudantes/[id]/perfil` | Perfil funcional codificado (escala 0–5, interesses âncora) | 3, 17.2 |
| `/estudantes/[id]/ppi` | Plano individual + gerador de objetivo observável. Só com o **estudo de caso concluído**, também na proposta da IA ou das regras. **Revisão do plano** (decisão da equipe, próxima data e se saiu no prazo), **encerramento com motivo** e **planos anteriores**; um plano ativo por vez | 4, 6, 17.3-B, 17.9 |
| `/estudantes/[id]/atividades` | Motor de 3 cartões + **versão imprimível** | 17.3–17.8 |
| `/estudantes/[id]/materiais` | **Rotinas visuais, histórias sociais e pranchas de CAA** (imprimíveis) | 17.10 |
| `/estudantes/[id]/diario` | Registro em 3 toques + **entrada por voz** | 5, 17.6 |
| `/estudantes/[id]/dua` | **Atividades com DUA** do estudante: planejar a participação numa atividade, apoios, evidências e próximos passos | DUA |
| `/estudantes/[id]/atendimentos-aee` | **Atendimentos AEE**: frequência (realizado, falta, cancelamento), separada da aprendizagem | DUA |
| `/estudantes/[id]/linha-do-tempo` | Linha do tempo do estudante | 6 |
| `/terapeuta` | **Relatório de Articulação Intersetorial** (perfil terapeuta) | 8 |
| `/assistente` (+ popup em todas as telas) | **Assistente com agente**: tira dúvidas sobre a plataforma e o acompanhamento, consulta estudantes, propõe planos e atividades (agentes), traz os próximos passos das atividades com DUA, cria materiais, registra aulas, decide atividades, marca objetivos, consulta recursos, painel e calendário; família conta conquistas e terapeuta envia orientações. Tudo o que altera o acompanhamento passa por um **cartão de confirmação**. Os dados chegam ao modelo com pseudônimos ([ESTUDANTE 1], [ESCOLA 1]) e os nomes voltam só na tela | 17.9 |
| `/planejamento` · `/planejamento/[id]` | **Planejamento com DUA**: atividade da turma em quatro etapas (objetivo e evidência, contexto e barreiras, opções e apoios, revisão para aplicação), com salvamento automático, sugestões para revisão (IA ou regras), validação para aplicação, versões, apoios individuais, aplicação e evidências, materiais e histórico. Detalhes em [`docs/dua.md`](./docs/dua.md) | DUA |
| `/jornada` | **Minha jornada**: a história de cada perfil em capítulos (professora: a história de um estudante; coordenação e gestão: a da escola; Secretaria: a da rede; família e terapeuta: a própria contribuição), marcados a partir dos dados reais, com evidências, próximo passo, impacto e conquistas com data. Boas-vindas no primeiro acesso | HU01–HU10 |
| `/painel` | **Painel de indicadores**: medidor em destaque com abas (jornada, participação e critério de sucesso, com a variação em pontos sobre o período anterior), cartões de situação, etapas da jornada, tabela de estudantes por avisos, nível de apoio, participação, meses com registro, uso da IA, objetivos, aulas, atividades e adesão, perfil agregado, **banco de práticas por perfil**, **uso e documentação do planejamento com DUA** (sem nota), família, recursos e acessos (LGPD). Filtros de período e de escola; o endereço antigo `/painel-municipal` redireciona | 10, 11, 17.6, 17.9 |
| `/recursos` | Banco municipal com recursos, atividades correspondentes, filtros e evidências de aplicação | 13 |
| `/calendario` | **Calendário inclusivo**: datas comemorativas do público do AEE (autismo, Libras, braille…), com referência legal e ideia de atividade para a turma | — |
| `/familia/[id]` | Portal da família + **atividades de casa** + log de acessos | 12, 14 |

## Planejamento com DUA

Planejamento da atividade **da turma** com o Desenho Universal para a Aprendizagem (engajamento, representação e ação e expressão). Não exige estudo de caso, diagnóstico nem laudo; os apoios individuais entram depois, com acesso restrito ao recorte do estudante.

- Quem planeja: professores, profissional de apoio (não valida), coordenação e gestão. A secretaria vê só os indicadores. Família e terapeuta não acessam.
- A versão validada não muda: editar abre a versão seguinte. Aceitar uma sugestão não valida o planejamento.
- Sugestões com IA (Claude e DeepSeek) saem com o contexto anonimizado e conferido de novo; sem chave, as regras da plataforma sugerem, com a mesma revisão por bloco.
- Banco existente: `npm run db:tabelas` (só tabelas novas) e reinicie o `npm run dev`.
- Testes: `npm run test:unit` (regras puras) e `npm run test:e2e` (seção 8).

O que foi feito, onde está e como cada requisito é conferido: [`docs/dua.md`](./docs/dua.md).

## Adaptar a atividade ou a prova da turma

Na aba **Atividades** do estudante, **Adaptar a atividade da turma**:

1. **Enviar:** o professor envia a foto ou o PDF da folha (até 10 MB) ou cola o texto, e diz se é atividade ou prova.
2. **Ler o arquivo:** a IA transcreve o texto (o Claude lê imagem e PDF; nomes de pessoas viram [nome]). O professor confere o texto antes de seguir.
3. **Adaptar:** a plataforma adapta a apresentação ao perfil "Como aprende" do estudante. As opções são linguagem simples, uma ordem por linha, comando em destaque, ícone da forma de responder, resposta por escolha, menos questões por página e letra ampliada.
4. **Revisar:** o original e a versão adaptada aparecem lado a lado. O professor ajusta cada questão e aprova.
5. **Usar:** a folha sai para imprimir ou salvar em PDF, sem o apoio do professor, ou em **Word** (.docx).

**Regra da prova:** adaptar a forma, não o que é avaliado. A habilidade da BNCC do objetivo acompanha a versão adaptada.

**Salvaguardas:**
- Ler foto ou PDF e adaptar com IA só acontece com a autorização da família. Sem ela, o professor cola o texto e a plataforma aplica as regras que não precisam de IA: questões separadas, uma ordem por linha, comando em destaque e a forma de responder de cada questão.
- O arquivo não é guardado.
- Cada envio à IA entra no histórico de acessos que a família vê.

## A mesma atividade em três níveis (DUA)

No planejamento com DUA, a aba **Níveis** gera, a partir da atividade da turma (texto, foto ou PDF), três versões: **com mais apoio**, **padrão** e **com desafio**.

- As três têm o mesmo tema, o mesmo objetivo e a mesma habilidade da BNCC.
- Sem IA, a plataforma gera os níveis por regras: o padrão é a atividade organizada; com mais apoio, uma ordem por linha e o apoio de cada questão; com desafio, explicar ou criar uma pergunta parecida.
- Cada nível é ajustado, aprovado e impresso à parte, e a folha não diz o nível.
- Regras puras em `src/lib/task-adaptation.ts`, com testes.

## Sondagem com linha de base e reavaliação

Na aba **Sondagem** do estudante, a equipe registra 51 itens observáveis em seis áreas:

- comunicação e linguagem;
- leitura e escrita;
- matemática;
- autonomia e autocuidado;
- interação e autorregulação;
- motor e sensorial.

Cada item recebe o nível de apoio da escala única da plataforma, de 0 (independente) a 5 (apoio físico total), ou fica como não observado. Avançar é precisar de menos apoio no mesmo item.

- **Quando:** a primeira aplicação é a linha de base. A reavaliação acontece a cada revisão do plano (12 semanas) e começa com as respostas anteriores.
- **Resultado:**
    - o apoio médio por área, na linha de base e agora;
    - em leitura, escrita e matemática, o ano de referência na BNCC para planejar: o maior ano em que todos os itens observados até ele saem com até instrução verbal;
    - sugestões de objetivo, com os itens que ainda pedem modelo ou mais apoio, com a habilidade da BNCC.
- **O que não faz:** não classifica o estudante por diagnóstico.
- **Relatório e painel:** o relatório do período mostra a sondagem do período. O painel mostra quantos estudantes têm a sondagem em dia e, por área, quantos precisam de menos apoio que na linha de base, com "menos de 5" para números pequenos.
- **Instrumento:** a versão 1 (`src/lib/assessment.ts`, com testes que conferem os códigos da BNCC na base oficial) é um rascunho para a equipe pedagógica revisar. Os itens são próprios, e nenhum foi copiado de instrumentos com direitos autorais.

## Relatório do período (devolutiva à família)

A Portaria MEC nº 421/2026 (art. 11, IV) pede que o PEI registre as devolutivas às famílias. Na aba **Relatórios** do estudante:

1. **Montar:** a equipe escolhe o período (o semestre atual por padrão). A plataforma junta os registros do período:
    - os objetivos do plano, com o apoio no começo e no fim do período e a habilidade da BNCC;
    - os atendimentos do AEE (realizados, faltas e cancelamentos);
    - o que mais funcionou, as atividades registradas em aula e os materiais aprovados;
    - as observações da família e as orientações do terapeuta, estas só com a conexão autorizada.
2. **Rascunho do parecer:** a plataforma escreve um rascunho por regras, sem IA. Do estudo de caso entra só a parte pedagógica (síntese e apoios necessários); diagnóstico, saúde e dados da família ficam de fora.
3. **Validar:** a equipe revisa e completa o parecer. Quem valida é o professor do AEE ou a coordenação, e só com o trecho entre colchetes completado.
4. **Depois de validado:** o relatório não muda mais, porque guarda os registros como estavam. Ele aparece no portal da família, entra na linha do tempo e no histórico de acessos, e tem versão para imprimir ou salvar em PDF.

O painel conta os estudantes com relatório validado nos últimos 6 meses. Regras puras em `src/lib/period-report.ts`, com testes.

## Contato ativo com a família

O sino no topo de cada tela leva a **Avisos** e mostra quantos avisos são novos. Abrir a página marca os avisos como lidos.

- **A família é avisada quando:**
    - um material de apoio é aprovado;
    - o plano de ensino é revisado;
    - o relatório do período é validado.
- **A equipe (AEE e coordenação da escola) é avisada quando:**
    - a família responde a pergunta da semana;
    - o terapeuta envia uma orientação.
- **Pergunta da semana:** no portal, a família marca como foi a semana em casa (dormiu bem, teve uma conquista, teve um dia difícil…) e pode escrever mais. A resposta entra na linha do tempo e aparece no diário, para quem vai registrar a aula. Até domingo, a família pode mudar a resposta. Em **Avisos**, a família pode desligar a pergunta.
- **E-mail, opcional:** só sai com `SMTP_URL` e `EMAIL_FROM` configurados e para quem escolheu recebê-lo em **Avisos**. O e-mail diz apenas que há novidade e leva o link: nunca o nome, a escola ou o assunto do estudante. O aviso no portal vale mesmo quando o e-mail falha.
- **WhatsApp:** fica para depois, quando houver conta oficial da rede.

Regras puras em `src/lib/family-contact.ts`, com testes.

## Dossiê de evidências

A aba **Dossiê** do estudante mostra, item por item, o que o Decreto nº 12.686/2025 (com a redação do Decreto nº 12.773/2025) e a Portaria MEC nº 421/2026 pedem. Para cada item, diz se o registro está na plataforma e leva até ele. Cada item recebe uma situação:

- **Em dia:** o registro existe.
- **Para conferir:** o registro está incompleto ou o prazo venceu.
- **Pendente:** o registro ainda não existe.

Os itens são agrupados assim:

- **Estudo de caso** (Decreto, art. 11):
    - estudo concluído;
    - as quatro etapas do § 1º;
    - a participação da família e a do estudante (§ 3º);
    - a nota de que nenhuma etapa exige laudo (§ 7º).
- **Plano: PAEE e PEI.** O plano de ensino é o documento único que a Portaria permite (art. 7º, § 2º). Os itens são:
    - o plano a partir do estudo de caso;
    - a revisão anual (art. 7º, § 3º);
    - o conteúdo mínimo do PAEE (art. 10) e do PEI (art. 11);
    - a devolutiva à família, que é o relatório do período validado.
- **Atendimento e acompanhamento:**
    - os atendimentos do AEE nos últimos 30 dias;
    - a sondagem em dia;
    - as autorizações da família.

Há também uma versão para imprimir ou salvar em PDF. Cada impressão fica no histórico de acessos que a família vê.

Em **Dossiê de evidências**, no menu:

- **Coordenação e AEE:** veem os estudantes da escola e o que falta em cada um. Podem filtrar só os que têm pendências.
- **Secretaria:** vê a rede em números por escola, sem nomes, com "menos de 5" para números pequenos.

O dossiê aponta onde está o registro e não substitui a análise da equipe nem um parecer jurídico. Regras puras em `src/lib/evidence.ts`, com testes.

## Formação em pílulas

Seis textos curtos, de até 2 minutos:

- estudo de caso em quatro etapas;
- comunicação alternativa no dia a dia;
- objetivo observável ligado à BNCC;
- DUA;
- adaptar a prova sem mudar o que ela avalia;
- sondagem.

Cada pílula tem:

- por que importa;
- como fazer;
- um exemplo;
- o que evitar;
- onde fazer na plataforma.

As pílulas ficam em **Ajuda** e no **Saiba mais** ao lado do passo correspondente: estudo de caso, Como aprende, plano de ensino, planejamento com DUA, adaptação e sondagem. Também podem ser ouvidas. São para a equipe da escola e da rede.

A versão 1 (`src/lib/learning-pills.ts`) é um rascunho para a equipe pedagógica revisar. Os textos são próprios.

## Censo Escolar (Educacenso)

O INEP não tem API pública. A troca oficial é o **arquivo de migração** (TXT com campos separados por `|`, em ISO-8859-1), que a escola exporta do Educacenso ou do sistema de gestão. Em **Censo Escolar**, no menu:

- **Importação:**
    - A coordenação ou a gestão da escola envia o arquivo. A plataforma lê os registros 00 (escola), 20 (turma), 30 (pessoa física) e 60 (matrícula).
    - O leiaute é o de 2025 ou o de 2026, reconhecido pelo número de campos de cada registro. As posições foram conferidas nas planilhas oficiais do INEP ("Layout de Importação e Exportação do Educacenso" 2025, versão 2, e 2026) e ficam em `LAYOUT`, em `src/lib/educacenso.ts`.
- **Prévia e conciliação:**
    - Cada aluno do público da educação especial ou com matrícula no AEE é conciliado com o cadastro da escola. A ordem é: ID INEP, CPF, nome com nascimento e, por fim, nome único.
    - A prévia mostra quem será cadastrado, o que muda (nome, nascimento, ID INEP, CPF, AEE) e quem está com AEE na plataforma mas fora do arquivo.
    - Homônimos, nascimento inválido e alguém igual em outra escola da rede (possível transferência) vão para revisão. A equipe escolhe vincular, cadastrar ou ignorar com motivo.
    - Nada é gravado até **Aplicar**. A aplicação roda numa transação e entra no histórico de acessos. Quem é cadastrado pelo arquivo entra com a etapa estimada pela idade e com ano, turno e responsável "A informar".
- **Dupla matrícula:** para cada estudante com AEE na plataforma, a referência da escola diz se ele está no Censo:
    - com classe comum e AEE (a dupla matrícula que conta no Fundeb);
    - sem matrícula no AEE;
    - só no AEE, sem classe comum (classe especial não conta como comum);
    - sem a marcação de educação especial;
    - fora do arquivo.
  A escola pode informar o ID INEP de quem não foi encontrado.
- **Conferências do vínculo de AEE**, na prévia e na verificação:
    - vínculo sem nenhum tipo de atendimento marcado, que faz o Educacenso recusar o arquivo da escola;
    - mais de 4 vínculos em AEE ou atividade complementar, caso em que a pessoa não é importada;
    - AEE no mesmo horário da classe comum, comparando os dias e horários das turmas (registro 20, campos 7 a 13). É só alerta: desde 2025, a NT Conjunta nº 12/2025 conta a dupla matrícula mesmo assim, mas o Educacenso pode recusar horários coincidentes;
    - mais de um vínculo no AEE, que conta uma vez só;
    - classe comum semipresencial ou a distância, que não vale para a dupla matrícula.
- **Escola pública:** a dependência administrativa (registro 00, campo 21) e o convênio com a Secretaria Municipal (campo 34) dizem o que conta no Fundeb:
    - escola municipal: o AEE conta para a rede municipal;
    - escola estadual: o AEE conta para o estado;
    - escola federal ou privada sem convênio: nada conta;
    - instituição conveniada: o AEE conta se ela atuar só em educação especial.
- **Dupla matrícula entre escolas:** a classe comum presencial pode estar no arquivo de outra escola pública da rede, e a verificação procura lá.
- **Conciliação das contagens:**
    - Por escola e na rede: educação especial no Censo, matrículas no AEE, dupla matrícula (por etapa agregada), AEE sem classe comum, educação especial sem AEE e estudantes com AEE na plataforma.
    - A estimativa do AEE que o FNDE deve considerar segue as regras da NT Conjunta nº 12/2025:
        - aluno com deficiência, TEA ou altas habilidades;
        - vínculo aceito pelo Educacenso em escola municipal;
        - classe comum presencial em escola pública;
        - cada aluno contado uma vez.
      A tela mostra quantos ficam de fora e por quê: sem classe comum nos arquivos da rede, vínculo recusado, repetido, AEE estadual ou AEE em conveniada.
    - A Secretaria informa quantas matrículas de AEE o FNDE considerou no Fundeb, e a plataforma compara com essa estimativa. A diferença pede conferência e não comprova perda.
- **Verificação na janela do Censo:**
    - O monitor confere todas as escolas nos horários configurados, por padrão às 8h e às 16h de Brasília, dentro da janela. A janela padrão vai de 26/05/2027 a 31/08/2027, e a Secretaria a ajusta.
    - O agendador sobe com o servidor (`src/instrumentation.ts`) e usa uma trava no banco, para duas instâncias não verificarem juntas. Se o servidor estava parado no horário, ele verifica ao voltar. `CENSUS_MONITOR=0` desliga.
    - Quando a pendência de uma escola muda, a coordenação e a gestão recebem um aviso.
- **Quem vê o quê:** a coordenação e a gestão veem os nomes da própria escola. A Secretaria vê só números (com "menos de 5" nas pendências) e configura a janela e o número do FNDE.
- **Dados:**
    - O arquivo não fica guardado. A referência da escola guarda só os alunos do público do AEE (nome, ID INEP, CPF, nascimento, matrículas e etapa).
    - Os tipos de deficiência não são guardados: a plataforma não precisa deles.
    - Ao aplicar ou descartar, a prévia perde os dados das pessoas.

Regras puras em `src/lib/educacenso.ts` e `src/lib/census-rules.ts`, com testes.

## Habilidades da BNCC

O objetivo do Plano de ensino e o planejamento com DUA ligam-se a habilidades da BNCC escolhidas na base oficial (`prisma/data/bncc.json`, 1.580 códigos de educação infantil, fundamental e médio), e não digitadas à mão:

- **Busca:** por código (EF01LP) ou palavra (letras, contar). As habilidades do ano do estudante aparecem primeiro: no infantil, pela faixa etária; no fundamental, pelo ano.
- **Sugestão pelo texto do objetivo:** por palavras em comum, pesando mais as raras e o componente da área escolhida (leitura e escrita → Língua Portuguesa; matemática → Matemática). É feita por regras, sem IA, e nada sai da plataforma.
- **Conferência:** código que não existe na base não é gravado, nem quando vem de uma proposta da IA.
- **Onde aparece:** o plano mostra o código com o componente e o texto oficial, e o painel de indicadores conta os objetivos por componente.
- **Fonte:** o texto é o do PDF homologado pelo MEC, conferido código a código. A estrutura dos dados vem do projeto [bncc-dados](https://github.com/bncc-dev/bncc-dados) (CC BY 4.0). Detalhes em `prisma/data/README.md`.

## Acessibilidade de leitura

- **Ouvir:** os materiais de apoio e o portal da família têm um botão que lê o conteúdo em voz alta, com três velocidades. Usa a voz do próprio navegador e prefere uma que roda no aparelho; se só houver voz pela internet (o texto iria ao serviço do navegador), pede confirmação antes, como no ditado. Regras puras em `src/lib/speech-text.ts`.
- **Tamanho do texto:** padrão, grande (112,5%) ou maior (125%), no menu com o nome e no portal da família. Fica guardado no navegador e vale na tela e na impressão; com o texto ampliado, palavras longas quebram para nada passar da largura do celular. As cores e os tokens não mudam.

## Tradução para Libras (VLibras)

Todas as telas têm o botão de Libras do VLibras, o tradutor do governo federal, de código aberto (LGPL-3.0). O botão fica no meio da lateral direita e, com um clique num texto, o avatar traduz.

- **Endereço oficial:** o widget vem de `vlibras.gov.br/app`. O avatar roda numa página HTML que só o servidor do governo entrega como página: o jsDelivr a entrega como texto, e o avatar não abre. A versão conferida é a 7.12.2, e o E2E avisa quando o governo trocar a versão, para conferir de novo como o texto é enviado.
- **Dados pessoais trocados antes do envio:**
    - O widget manda o texto ao tradutor (`traducao2.vlibras.gov.br`) com um `fetch`. A plataforma intercepta esse pedido (`src/components/vlibras.tsx`).
    - O texto passa por `/api/libras/anonimizar`, que troca nomes, documentos, datas e contatos por termos como "o estudante" e "um familiar". São as regras do anonimizador da IA.
    - Só o texto trocado segue para o governo. Se a troca falhar, nada é enviado.
- **Cada pessoa, os seus nomes:** a troca usa só os nomes que a pessoa já pode ver:
    - família e terapeuta: os estudantes vinculados;
    - equipe: a própria escola;
    - rede: todos.

  Assim a troca não revela quem está cadastrado. Sem sessão, como na tela de entrada, troca só documentos, datas e contatos.
- **Fechado por padrão:** qualquer envio de dados (POST, PUT) para fora da plataforma que não seja o pedido de tradução é bloqueado. Isso inclui a estatística de uso do widget (PostHog, nos Estados Unidos) e a revisão de tradução. Uma mudança no widget não abre caminho sem a troca. A plataforma envia `Referrer-Policy: strict-origin-when-cross-origin`: outros sites recebem só o domínio, nunca o caminho da página.
- **Limite:** nomes que a plataforma não conhece em texto livre (um vizinho, um médico citado à mão) podem passar. Por isso o portal da família avisa, no cartão "Autorizações", o que vai para o governo ao traduzir.
- **Instalação sem internet:** `NEXT_PUBLIC_VLIBRAS=0` desliga o botão.

## Controle de acesso (necessidade de saber — item 7)

`src/lib/auth.ts` centraliza sessão e permissões (as regras puras da sessão ficam em `src/lib/session-core.ts`). Cada rota valida o perfil: a família e o terapeuta só alcançam os estudantes vinculados à conta (`canAccessStudent`; tabela `StudentLink`, com mais de um estudante por conta: irmãos, ou um terapeuta com vários pacientes, que trocam de estudante no próprio portal) e não abrem a ficha da equipe (`/estudantes/[id]`): cada um usa o seu portal (`/familia/[id]` e `/terapeuta`), a **Secretaria vê a rede em números** (painel com avisos por escola, sem nomes; a lista de estudantes só mostra resultados a partir de uma busca de 3 letras) e abre a ficha de um estudante **só para leitura, informando o motivo** (`/acesso-nominal/[id]`: vale 8 horas e aparece no histórico que a família consulta), os **dados clínicos** do estudo de caso (diagnóstico informado, saúde, acompanhamentos externos e com quem mora) ficam com o AEE e a coordenação, o painel de indicadores mostra a rede inteira só a perfis de rede (a equipe escolar vê a própria escola, e as listas com nomes trazem apenas estudantes que a pessoa já acessa), e o terapeuta não vê diário pedagógico nem dados administrativos. O `AccessLog` (exposto à família, com nome, papel, ação e data) registra cada aba da ficha aberta (uma vez a cada 30 minutos por pessoa e aba, `src/lib/access-log.ts`), os registros de aula, as decisões sobre atividades (que também guardam quem decidiu), as mudanças de objetivo, as revisões e o encerramento do plano, além das ações do assistente. O diário guarda o autor real (da sessão) além do papel declarado.

## Pessoas e acessos (gestão de contas)

Em **Pessoas e acessos** (`/usuarios`), a gestão cuida das contas sem depender de quem administra o banco:

- **Quem gerencia quem** (`src/lib/user-admin.ts`, com testes): a Secretaria cuida da equipe das escolas e da rede (não das famílias: ela vê a rede em números); a gestão e a coordenação cuidam da equipe da própria escola, das famílias e dos terapeutas dos estudantes dela. Ninguém altera a própria conta por aqui.
- **Criar:** nome, e-mail, perfil e escola (equipe) ou estudantes vinculados (família e terapeuta, um ou mais). A plataforma gera uma **senha temporária**, mostrada uma vez para a gestão entregar; no primeiro acesso, a pessoa cria a própria senha (`/login/nova-senha`) antes de entrar.
- **Alterar:** perfil, escola e vínculos (a escola só mexe nos vínculos com estudantes dela). Mudou o acesso, as sessões da pessoa são encerradas.
- **Senha esquecida:** nova senha temporária, com as sessões encerradas. **Celular perdido:** a gestão desliga as duas etapas, e a pessoa liga de novo no próximo acesso.
- **Desativar:** a pessoa deixa de entrar na hora; o histórico dos registros fica, e a conta pode ser reativada.
- **Histórico da conta** (`AccountEvent`): quem criou, alterou, redefiniu, desativou; a própria pessoa vê as mudanças na conta dela em **Segurança da conta**, onde também troca a senha (mínimo de 10 caracteres, sem nome nem e-mail; as outras sessões são encerradas).

### Importar estudantes por planilha

Em **Estudantes › Importar planilha** (`/estudantes/importar`), a gestão e a coordenação da escola (e a Secretaria, escolhendo a escola) cadastram uma turma inteira a partir de um CSV salvo pelo Excel ou pelo LibreOffice (ponto e vírgula ou vírgula, UTF-8 ou Windows-1252). As colunas são reconhecidas pelo nome, em qualquer ordem (há um modelo para baixar). A importação tem duas fases: **conferir**, que não grava nada e mostra as linhas prontas, as já cadastradas (mesmo nome e nascimento na escola), as com problema (com o motivo) e os nomes iguais com outro nascimento (para conferir); e **importar**, que lê a planilha de novo no servidor e grava só as linhas prontas, com o registro na linha do tempo e no histórico de acessos. Até 500 estudantes por vez. Regras puras em `src/lib/student-import.ts`, com testes. O cadastro individual também fica restrito à escola de quem cadastra.

## Arquitetura de domínio (`src/lib`)

- `scale.ts` — escala única de apoio (0 IND → 5 FIS-T), canais, dimensões, barreiras
- `rules.ts` — motor de regras determinísticas versionado; cada adaptação aponta para a regra que a originou
- `objective.ts` — gerador da frase de objetivo observável
- `activity-engine.ts` — geração dos 3 cartões pelo motor de regras (usada sem IA ou quando a IA falha)
- `assistant/` — assistente com agente (laço de ferramentas do SDK da Anthropic, com transmissão): `prompt.ts` (instruções estáveis por perfil), `tools.ts` (ferramentas com permissão conferida no servidor), `privacy.ts` (pseudônimos por conversa, restaurados só na tela), `agent.ts` (um turno: histórico só com acréscimos, para os blocos de raciocínio continuarem válidos), `store.ts` (conversas e execução das ações confirmadas). Rotas em `app/api/assistente/`
- `user-journey.ts` — jornada por perfil: capítulos calculados dos dados (estudo de caso, perfil, plano, atividade, registro, revisão; painel, planos, revisões, registros, família e saúde; atividades de casa e conquistas; orientações e leitura pela escola) e marcos de visita em `JourneyMark`
- `dashboard.ts` — indicadores do painel: escopo por perfil, períodos (30 e 90 dias, ano, histórico) e contagens a partir dos registros, sem inferência sobre o estudante; os gráficos ficam em `components/charts.tsx`, sem biblioteca (medidor e rosca listrados, barras com textura, escala de apoio e grade de meses), com os sinais lima, amarelo e laranja definidos em `globals.css`
- `agents/` — agentes de IA orquestrados com LangGraph:
  - `plan-graph.ts` — **plano (PPI)**: Analista do caso → Planejador → Revisor pedagógico (até 2 rodadas de correção) → finalização determinística. A proposta fica em `PlanDraft` até o professor revisar, escolher os objetivos e ativar
  - `activity-graph.ts` — **atividades**: agentes da sala comum, do AEE e da família em paralelo → Revisor (Claude + checagens das regras) → refaz só as reprovadas (1 rodada); pendências restantes aparecem no cartão
  - `model.ts` — cadeia de provedores: `claude.ts` (SDK oficial, saída estruturada, raciocínio adaptativo, fallback de recusa `fallbacks: "default"`) → `deepseek.ts` (opcional, modo JSON validado com o mesmo Zod) → erro, que leva ao motor de regras. Os grafos recebem o modelo por parâmetro e podem ser testados sem a API
  - `context.ts` — monta o contexto com minimização de dados: sem nome, nascimento, responsável, escola, diagnóstico ou saúde
  - `anonymize.ts` — **anonimização** de tudo o que vai para Claude, DeepSeek e OpenAI: nomes do estudante, de colegas, familiares, profissionais e da escola citados nos textos livres viram papéis ([ESTUDANTE], [COLEGA]…); e-mail, telefone, CPF, CEP, datas e links viram marcadores. Os marcadores que voltarem nas respostas viram linguagem natural, e a trilha da proposta informa o que foi substituído. Limite: nomes que não estão cadastrados na plataforma não são reconhecidos
  - `plan-rules.ts` — proposta de plano pelo motor de regras (sem IA)
- `images/` — imagens de apoio das atividades pela OpenAI (sequência visual dos passos, ilustração ou cartões de escolha), geradas sob pedido ou junto com as atividades. O pedido não leva nome nem dados pessoais; a imagem fica no banco e é servida por `/api/atividades/[id]/imagem` só para quem tem acesso ao estudante
- `dua/` — planejamento com DUA: `domain.ts` (modelo, validação, evidências, próximos passos, materiais), `access.ts` (quem lê, edita, valida e compartilha), `checks.ts` (preparação do contexto, sugestões por regras e verificações), e a camada de dados (`plannings.ts`, `suggestions.ts`, `supports.ts`, `applications.ts`, `materials.ts`, `indicators.ts`). Testes com `node --test` ao lado (`*.test.mjs`)
- `materials.ts` — perguntas para reunião
- `material-content.ts` (puro, com testes) — os 6 tipos de material de apoio, o conteúdo (cartões com descrição do pictograma, como usar, atividades para aplicar, porquê de cada adaptação), as verificações e o motor de regras; `material-generate.ts` — geração pela IA (`agents/material-agent.ts`) ou pelas regras, aprovação, imagens por cartão (`images/material-images.ts`) e "levar para Atividades"
- `insights.ts` — tendências por objetivo, alertas, estratégias que funcionaram
- `auth.ts` — sessão, hash e controle de acesso por perfil
- `bncc-core.ts` (puro, com testes) e `bncc.ts` — base da BNCC: recorte pelo estudante, busca e sugestão de habilidades
- `user-admin.ts` (puro, com testes) e `accounts.ts` — gestão de contas: escopo de quem gerencia, vínculos, senha temporária e histórico
- `totp.ts` (puro, com testes dos vetores da RFC 6238) e `two-factor.ts` — verificação em duas etapas: código do aplicativo, QR code desenhado no servidor (biblioteca `qrcode`, nada sai para serviço externo) e códigos de recuperação

## Salvaguardas (itens 14 e 17.7)

- Nenhuma atividade/material é aplicado sem decisão humana (fluxo sugerida → aceita → aplicada / rejeitada com motivo)
- Aviso obrigatório em toda sugestão da IA
- Regra antissegregação nos cartões de sala comum
- Log de auditoria exibido à família; painel de indicadores e banco de práticas com dados agregados; nomes só para quem já tem acesso ao estudante
- Autenticação por e-mail e senha, verificação em duas etapas e acesso por necessidade de saber. Na segunda etapa, a sessão fica pendente (10 minutos, só abre `/login/duas-etapas`); o código certo troca a sessão por uma nova. O mesmo código do aplicativo não entra duas vezes, cada código de recuperação vale uma vez (o banco guarda só o resumo SHA-256), e os códigos errados contam no mesmo limite do login. Ligar as duas etapas encerra as outras sessões da conta, e **Segurança da conta** mostra onde a conta está aberta e encerra as outras sessões

## Próximos passos para produção

- Provedor de identidade gerenciado e criptografia em repouso
- Transcrição de voz por IA no servidor (hoje via Web Speech API do navegador)
- Hospedagem segura, RIPD e DPO
- Integração com o sistema de gestão escolar e o Educacenso
