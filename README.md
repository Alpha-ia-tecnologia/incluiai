# IncluiEdu — Sistema Municipal de Inteligência para a Educação Inclusiva

Plataforma de acompanhamento do Atendimento Educacional Especializado (AEE) e gestão da política municipal de educação inclusiva, implementada a partir da proposta em [`plataforma-educacao-inclusiva-proposta-completa.md`](./plataforma-educacao-inclusiva-proposta-completa.md).

> **Quem é este estudante, quais barreiras ele enfrenta, o que já foi realizado, o que funcionou e qual deve ser o próximo passo?**

## Stack

- **Next.js 16** (App Router, Server Components e Server Actions) + TypeScript
- **Tailwind CSS 4** com o **tema visual IncluiEdu** (lilás para marca e ações, superfícies em neutros quentes, cores semânticas para estado — verde, âmbar, coral — e cinco cores suaves para categorias — céu, verde-água, pêssego, sálvia, rosa —, todas com contraste ≥ 4.5:1; tipografia Inter + JetBrains Mono, navegação lateral compacta e adaptação para celular) — tokens em `src/app/globals.css`
- **Prisma 6 + SQLite** (troque o datasource para PostgreSQL em produção)
- **Autenticação** própria: sessão guardada no servidor (o cookie httpOnly leva só um código aleatório; vale 8 h, cai após 2 h sem uso e é apagada ao sair), senha com scrypt e limite de 5 tentativas erradas por e-mail em 15 minutos
- **Agentes de IA opcionais** orquestrados com **LangGraph** (`@langchain/langgraph`), chamando o Claude pelo SDK oficial (`@anthropic-ai/sdk`) com saída estruturada (Zod) — geram propostas de plano (PPI) e atividades. Sem chave, o motor de regras determinísticas + templates assume

## Como rodar

```bash
npm install
npx prisma db push       # cria o banco SQLite (prisma/dev.db)
node prisma/seed.mjs     # dados + 6 usuários de demonstração (senha: demo123)
npm run dev              # http://localhost:3000
```

Opcional — IA (todas as chaves no `.env`, comentadas como exemplo):
- `ANTHROPIC_API_KEY` liga os agentes de IA (modelo padrão `claude-opus-5-5`; troque com `ANTHROPIC_MODEL`).
- `SESSION_COOKIE_SECURE`: em produção o cookie da sessão só trafega por HTTPS. Para testar o build de produção em `http://` fora do `localhost`/`127.0.0.1`, use `SESSION_COOKIE_SECURE=0`.
- `DEEPSEEK_API_KEY` **com** `DEEPSEEK_ENABLED=1` liga o DeepSeek como fallback quando o Claude falha (sem a ligação explícita, a chave sozinha não basta) (modelo padrão `deepseek-flash`; troque com `DEEPSEEK_MODEL`). **LGPD:** a DeepSeek processa e armazena dados na China; cada uso fica registrado no histórico de acessos visto pela família.
- `OPENAI_API_KEY` liga as imagens de apoio das atividades (pictogramas), pela OpenAI (modelo padrão `gpt-image-2.5-flare`; troque com `OPENAI_IMAGE_MODEL`).

### Contas de demonstração (senha `demo123`)

| Perfil | E-mail | O que vê |
|---|---|---|
| Secretaria | `secretaria@municipio.gov.br` | Rede inteira + painel de indicadores |
| Coordenação | `coordenacao@escola.edu.br` | Estudantes + painel |
| Professor(a) sala comum | `professor@escola.edu.br` | Estudantes da sua escola |
| Professor(a) do AEE | `aee@escola.edu.br` | Estudantes da sua escola |
| Terapeuta | `terapeuta@clinica.com.br` | Apenas perfil funcional + articulação do seu paciente |
| Família | `familia@email.com` | Apenas o próprio filho(a) |

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
- Banco existente: `npx prisma db push` (só tabelas novas) e reinicie o `npm run dev`.
- Testes: `npm run test:unit` (regras puras) e `npm run test:e2e` (seção 8).

O que foi feito, onde está e como cada requisito é conferido: [`docs/dua.md`](./docs/dua.md).

## Controle de acesso (necessidade de saber — item 7)

`src/lib/auth.ts` centraliza sessão e permissões (as regras puras da sessão ficam em `src/lib/session-core.ts`). Cada rota valida o perfil: a família e o terapeuta só alcançam o estudante vinculado (`canAccessStudent`) e não abrem a ficha da equipe (`/estudantes/[id]`): cada um usa o seu portal (`/familia/[id]` e `/terapeuta`), a **Secretaria vê a rede em números** (painel com avisos por escola, sem nomes; a lista de estudantes só mostra resultados a partir de uma busca de 3 letras) e abre a ficha de um estudante **só para leitura, informando o motivo** (`/acesso-nominal/[id]`: vale 8 horas e aparece no histórico que a família consulta), os **dados clínicos** do estudo de caso (diagnóstico informado, saúde, acompanhamentos externos e com quem mora) ficam com o AEE e a coordenação, o painel de indicadores mostra a rede inteira só a perfis de rede (a equipe escolar vê a própria escola, e as listas com nomes trazem apenas estudantes que a pessoa já acessa), e o terapeuta não vê diário pedagógico nem dados administrativos. O `AccessLog` (exposto à família, com nome, papel, ação e data) registra cada aba da ficha aberta (uma vez a cada 30 minutos por pessoa e aba, `src/lib/access-log.ts`), os registros de aula, as decisões sobre atividades (que também guardam quem decidiu), as mudanças de objetivo, as revisões e o encerramento do plano, além das ações do assistente. O diário guarda o autor real (da sessão) além do papel declarado.

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

## Salvaguardas (itens 14 e 17.7)

- Nenhuma atividade/material é aplicado sem decisão humana (fluxo sugerida → aceita → aplicada / rejeitada com motivo)
- Aviso obrigatório em toda sugestão da IA
- Regra antissegregação nos cartões de sala comum
- Log de auditoria exibido à família; painel de indicadores e banco de práticas com dados agregados; nomes só para quem já tem acesso ao estudante
- Autenticação por e-mail e senha e acesso por necessidade de saber

## Próximos passos para produção

- Provedor de identidade gerenciado e criptografia em repouso
- Transcrição de voz por IA no servidor (hoje via Web Speech API do navegador)
- Migração para PostgreSQL, hospedagem segura, RIPD e DPO
- Integração com o sistema de gestão escolar e o Educacenso
