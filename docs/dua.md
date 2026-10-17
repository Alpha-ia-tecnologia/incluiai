# Planejamento com DUA no IncluiEdu

O módulo ajuda a equipe a planejar a atividade **da turma** com o Desenho Universal para a Aprendizagem (DUA, Diretrizes 3.0 do CAST): engajamento, representação e ação e expressão. Desde o início, o planejamento considera as diferentes formas de acessar, participar e mostrar o que se aprendeu. Os apoios individuais entram depois, com acesso restrito.

Este documento diz o que foi feito, para quem, onde está e como cada requisito é conferido.

## Para quem

| Perfil | O que faz no DUA |
|---|---|
| Professor(a) da sala comum e do AEE | Planeja, edita, valida para aplicação, aplica e registra evidências. |
| Profissional de apoio | Planeja e colabora, mas **não valida**: validar é uma decisão pedagógica. |
| Coordenação e gestão | Tudo o que o professor faz nos planejamentos da escola. Também compartilha, define colaboradores e vê os indicadores. |
| Secretaria | Só os indicadores do painel. Quem abre `/planejamento` vai para `/painel#dua`. |
| Família e terapeuta | Não acessam o DUA: nem planejamentos, nem apoios, nem evidências. |

Quem lê um planejamento:
- o responsável;
- os colaboradores;
- a coordenação e a gestão da escola;
- a equipe da escola, quando ele está compartilhado (lê e aplica, sem editar).

Fora desse recorte, a resposta é "não encontrado". A permissão é conferida a cada requisição: se o papel ou a escola mudam, vale na hora. Regra de referência: `planningAccess` em `src/lib/dua/access.ts`.

## Onde está

- **Menu "Planejamento com DUA"** (`/planejamento`): lista, busca por título, objetivo, barreira ou opção e "Planejar atividade com DUA". A atividade pode começar do zero ou a partir de outra.
- **Editor em quatro etapas** (`/planejamento/[id]`), com salvamento automático:
  1. Objetivo e evidência.
  2. Contexto e barreiras.
  3. Opções e apoios.
  4. Revisão para aplicação.
- **Abas do planejamento**: Apoios individuais (`/apoios`), Aplicação e evidências (`/aplicacao`), Materiais (`/materiais`) e Versões e histórico (`/historico`, com os colaboradores).
- **No estudante**:
  - aba "Atividades com DUA" (`/estudantes/[id]/dua`): planejar a participação numa atividade, ver apoios, evidências e próximos passos;
  - aba "Atendimentos AEE" (`/estudantes/[id]/atendimentos-aee`): frequência do AEE;
  - a linha do tempo mostra as evidências e a frequência.
- **Painel** (`/painel#dua`): "Planejamento com DUA — uso e documentação", para coordenação, gestão e secretaria.
- **Assistente**: a ferramenta `proximos_passos_dua` traz os próximos passos de um estudante, cada um com a base usada e o que falta observar.

Código: regras puras em `src/lib/dua/domain.ts`, `access.ts` e `checks.ts`. Dados em `src/lib/dua/*.ts`, ações em `src/actions/dua.ts` e telas em `src/components/dua/`.

## Regras que valem para tudo

- **Plano de ensino (PPI) só com estudo de caso concluído (CA02).** Vale para o plano preenchido pela equipe e para a proposta da IA ou das regras (`assertCaseStudyConcluded` em `src/lib/records.ts`). A tela do plano mostra "Conclua o estudo de caso". O DUA da turma **não** exige estudo de caso.
- **Permissão conferida no servidor.** Agora `createPlan`, `createObjective`, `generateMaterial` e `deleteMaterial` também conferem a permissão. Esconder um botão não é controle de acesso.
- **Versão validada não muda.** As gravações são condicionais: estado diferente de validado e mesma revisão. Editar depois de validar abre a versão seguinte. As aplicações ficam presas à versão usada.
- **Edição ao mesmo tempo.** Se outro profissional salvou antes, a tela avisa antes de sobrescrever. A pessoa escolhe entre ficar com a versão salva e gravar a sua por cima.
- **Decisões separadas e registradas.** Aceitar uma sugestão só muda o rascunho. "Validar para aplicação" registra quem validou, quando e qual versão. Compartilhar com a equipe é outra decisão, posterior à validação. Validar não altera matrícula, classificação nem dados do Censo.
- **Evidência: um registro por estudante e aplicação.** Registrar de novo atualiza. Cada critério recebe um destes estados:
  - demonstrou;
  - demonstrou em parte;
  - ainda não demonstrou;
  - não houve oportunidade de observar;
  - ainda não registrado.

  Os dois últimos não viram "não" e não entram em resultado.
- **Frequência do AEE separada.** Realizado, falta ou cancelamento ficam no modelo `AeeSession`. Concluir uma aplicação não cria presença, atendimento nem conclusão sobre aprendizagem.
- **Indicadores sem nota.** Medem uso e documentação, cada um com período, escopo, unidade e denominador. Sem denominador, a tela mostra "sem base para cálculo no período", nunca 0%. Não existe nota, selo nem "conformidade DUA".

## Sugestões (IA ou regras)

- **Com chave de IA**, a sugestão usa a cadeia que já existe (Claude e, se falhar, DeepSeek). O contexto leva só campos pedagógicos do planejamento e, no apoio individual, os itens do perfil que o profissional escolheu.
- **Antes do envio**, os nomes conhecidos viram papéis ([ESTUDANTE], [FAMILIAR]...) e o texto é conferido de novo (`prepareContext`). Se sobrar um identificador, nada é enviado e a sugestão fica "bloqueada".
- **Sem chave**, as sugestões vêm das regras da plataforma (barreira → opção conhecida) e passam pela mesma revisão.
- **Verificações** (`checkBlocks`): estrutura, barreira inexistente (vira hipótese a verificar), identificadores, diagnóstico ou redução por deficiência, observação ou frequência apresentada como evidência, mudança de objetivo e critério novo. Blocos barrados só podem ser recusados.
- **Decisão bloco a bloco**: aceitar, aceitar com edição ou recusar. A mudança de objetivo nunca entra sozinha. O critério novo só entra com a escolha explícita do profissional. Se objetivo, critérios ou barreiras mudarem depois do pedido, a sugestão volta para conferência.
- **O que fica registrado**: versão e revisão consideradas, hash da base, campos do perfil usados, versão das instruções, provedor e modelo, verificações e cada decisão. A cópia do contexto enviado não fica guardada.

## Requisitos e critérios de aceite

Testes: `npm run test:unit` (unitários, `src/lib/**/*.test.mjs`) e `npm run test:e2e` (seção 8 de `e2e-test.mjs`).

| Requisito | Onde | Como é conferido |
|---|---|---|
| RF01 Entrada "Planejar atividade com DUA", pelo planejamento e pelo estudante, no mesmo planejamento | `/planejamento` (`new-planning-form.tsx`); aba "Atividades com DUA" (`startStudentParticipation`) | E2E 8a (criação pelo planejamento). Entrada pelo estudante: conferência na tela |
| RF02 Formulário em quatro etapas, rascunho incompleto e validação | `editor.tsx`, `step-*.tsx`; `validationProblems`, `saveDraft`, `validateVersion` | `domain.test.mjs` (validação); E2E 8b–8e |
| RF03 Opções ligadas a barreira, princípio, recursos e critério | `step-options.tsx`; `validationProblems` | `domain.test.mjs` (referência a barreira ou critério removido); E2E 8d |
| RF04 Apoios individuais com acesso restrito | `/planejamento/[id]/apoios`; `supports.ts`, `supportProblems` | `domain.test.mjs` (objetivo individual exige justificativa e vínculo); recorte: conferência na tela |
| RF05 Sugestões para revisão e validação para aplicação | `suggestion-review.tsx`; `suggestions.ts`, `checks.ts`, `validateVersion` | `checks.test.mjs`; `domain.test.mjs` (`suggestionStateAfter`); E2E 8e (validação) |
| RF06 Materiais a partir da versão | `/planejamento/[id]/materiais`; `materials.ts`, `buildActivityScript`, `buildSupportScript` | `domain.test.mjs` (formatos); impressão como RASCUNHO: conferência na tela |
| RF07 Aplicação e evidências | `/planejamento/[id]/aplicacao`; `applications.ts`, `resultFromCriteria`, `observationOf` | `domain.test.mjs`; um registro por estudante e aplicação: `@@unique` em `DuaEvidence` |
| RF08 Próximos passos com base e pendência | aba "Atividades com DUA"; ferramenta `proximos_passos_dua`; `followUpSuggestions`, `studentFollowUp` | `domain.test.mjs` (sugestões e limite de 6); `garden-scenes.test.mjs` (rótulos da ferramenta) |
| CA01 Planejar sem estudo de caso, diagnóstico, laudo, PAEE ou PEI | `/planejamento` | E2E 8a–8e: o professor cria e valida sem estudante vinculado |
| CA02 Plano de ensino só com estudo de caso concluído, inclusive a proposta | `records.ts`, `actions/plan.ts`, `actions/plan-ai.ts`, `agents/generate.ts`, `/estudantes/[id]/ppi` | E2E 8f (veja a nota abaixo); conferência na tela |
| CA03 Sem pedir IA, o professor planeja, revisa, valida, aplica e registra evidências | editor; aplicação e evidências; sugestões pelas regras (opcionais) | E2E 8 roda só com os exemplos da tela; jornada no navegador (abaixo); `checks.test.mjs` (regras para todo tipo de barreira) |
| CA04 Mudança de objetivo e critério novo só com decisão explícita | `checkBlocks`, `decideBlock` | `checks.test.mjs` (apontados, sem barrar) |
| CA05 Identificadores fora do contexto enviado à IA | `prepareContext`, `remainingIdentifiers` | `checks.test.mjs` |
| CA06 Aceitar sugestão não valida o planejamento | `decideBlock` (só o rascunho), `validateVersion` | Revisão de código: `decideBlock` grava só no rascunho; conferência na tela |
| CA07 Versão validada não muda; aplicações presas à versão | `saveDraft`, `transition`, `openNewVersion` | E2E 8e (validada); gravação condicional: conferência na tela |
| CA08 Reaproveitar copia só o conteúdo coletivo | `collectiveCopy`, `createPlanning` | `domain.test.mjs` (origens preservadas, cópia profunda) |
| CA09 Quem está fora do recorte não recebe nada | `planningAccess`, `readablePlanningsWhere`, `canWorkWithStudent` | `access.test.mjs`; E2E 8g (família fora de `/planejamento`) |
| CA10 Aplicação não cria presença nem atendimento; frequência separada | `applications.ts`, `aee-sessions.ts`, `/estudantes/[id]/atendimentos-aee` | Revisão de código: aplicação e evidência não gravam diário nem `AeeSession`; conferência na tela |
| CA11 Teclado e tecnologia assistiva: completar as tarefas, entender campos, erros e estados de revisão | campos com rótulo visível, `fieldset`/`legend`, alvos de 44 px, foco no título da etapa e na decisão registrada, salvamento e erros anunciados (`role="status"`/`alert`), sem arrastar | axe-core (WCAG 2.2 AA) e 320 px nas 14 telas novas (abaixo); revisão com leitor de tela ainda pendente |
| CA12 Validar não altera matrícula, classificação nem Censo | `validateVersion` grava só na versão | Revisão de código: o DUA não grava no cadastro do estudante |

**Nota sobre o E2E 8f.** No seed, só Dante tem estudo de caso concluído, mas Lívia e Ravi já têm plano ativo. O aviso "Conclua o estudo de caso" só aparece para quem ainda não tem plano. Com o seed atual, a etapa é pulada (SKIP). Ela falha se o formulário do plano aparecer sem estudo de caso concluído.

**Verificação no navegador (17/10/2026).** Feita num build de produção com banco de teste e IA desligada; os roteiros não fazem parte do repositório.
- **Jornada completa, 15 de 15 verificações:**
  - planejar e validar sem estudo de caso (CA01, CA03);
  - apoio individual com perfil e objetivo do plano, validado, com participação do estudante (RF04, 3.4);
  - aplicação e evidência com "não houve oportunidade" (RF07, CA10);
  - material como RASCUNHO até validar (RF06);
  - histórico;
  - entrada pelo estudante e próximos passos (RF01, RF08);
  - linha do tempo;
  - professor sem acesso a estudante de outra escola, nem por `?estudante=` (CA09);
  - plano de ensino bloqueado sem estudo de caso (CA02);
  - reaproveitamento sem apoios (CA08);
  - falta no AEE com motivo (CA10);
  - indicadores da coordenação;
  - família fora do planejamento.
- **axe-core (WCAG 2A, 2AA, 2.1AA e 2.2AA) com os `<details>` abertos, sem violações nas 14 telas novas:**
  - planejamento, nas quatro etapas;
  - apoios;
  - aplicação;
  - materiais e impressão;
  - histórico;
  - abas "Atividades com DUA" e "Atendimentos AEE";
  - linha do tempo;
  - plano de ensino.
- **320 px:** nenhuma dessas telas tem rolagem horizontal.
- **Fora do DUA:** no `/painel`, o axe aponta uma região rolável sem foco (`#jornada`, `overflow-x-auto`). Ela já existia antes do DUA.

## Banco de dados

Modelos novos em `prisma/schema.prisma`:
- `DuaPlanning` e `DuaPlanningVersion`;
- `DuaApplication` e `DuaEvidence`;
- `DuaSupport`, `DuaMaterial`, `DuaSuggestion` e `DuaAuditEvent`;
- `AeeSession`.

A mudança é aditiva (só tabelas novas). Num banco que já existe, rode:

```bash
npx prisma db push
```

Depois reinicie o `npm run dev`: em desenvolvimento, o cliente do Prisma fica guardado na memória do servidor e não enxerga as tabelas novas até reiniciar.

O `node prisma/seed.mjs` apaga e recria os dados de demonstração, incluindo os do DUA e a frequência do AEE.

## Fora desta entrega

- **Atualizar o perfil funcional a partir de uma observação.** A observação fica no apoio e na evidência. O perfil e o plano são atualizados pelo fluxo próprio deles.
- **Indicadores por professor, turma ou estudante.** Só há agregados por escola ou rede.
- **Sugestões em segundo plano.** O pedido à IA é síncrono, e a permissão é conferida no pedido e a cada leitura.
- **Imagens geradas para os materiais do DUA.** Os materiais são roteiros em texto.
- **Testes de integração com banco.** Os testes automáticos cobrem as regras puras e a jornada no navegador.
- **PostgreSQL.** O projeto segue em SQLite. Para produção, troque o datasource.
