# Padrão visual do IncluiEdu

Regras para manter a aplicação com a mesma cara em todas as telas. A identidade
segue a apresentação da plataforma (outubro de 2026): azul-marinho e azul, a
faixa azul-claro, amarelo e verde, personagens em azul-claro e a fonte Noto
Sans, com títulos e números em negrito. Desde novembro de 2026, o marinho
também é superfície: ele ancora cada tela (menu e herói) e o conteúdo fica em
cartões brancos sobre um fundo cinza-azulado. Estas regras organizam o uso.

## Cores

- Só os tokens de `src/app/globals.css`. Nada de hex novo nos componentes.
- **Azul** (`brand`, `brand-strong`, `brand-soft`, `lilac`, nome que ficou dos
  tokens antigos): marca e ações, em toda a aplicação, inclusive no Painel.
  Texto e títulos em azul-marinho (`ink`).
- **Marinho como superfície** (`navy`, com a classe `surface-navy`): o menu
  lateral, a barra do celular, o herói das telas principais, o destaque do
  Painel, as boas-vindas do início, as páginas de aviso e o painel do login.
  Um bloco marinho por tela, além do menu: dois empilhados pesam.
  - Texto: `on-navy` (títulos, 12,8:1) e `on-navy-soft` (apoio, 8,6:1). Nunca
    `ink`, `ink-soft` nem `brand` sobre o marinho.
  - Ação e item ativo: azul-claro (`accent-sky`) com texto `ink-strong` (6,7:1).
  - Linhas e realce: `navy-line` e `navy-hover`.
  - A classe `surface-navy` troca os papéis de cor (`surface-ink`,
    `surface-ink-soft`, `surface-raised`, `surface-line`, `surface-good`,
    `action`, `action-hover`, `on-action`, `action-soft`, `action-ink`), e os
    componentes leem os papéis: `BUTTON_CLS.primary` e `.secondary`,
    `task-action`, `pill-action`, `Assurances`, `HowToRead`, `PillLink` e
    `TextSizeControl` ficam certos dentro do marinho sem nenhuma opção. O botão
    discreto (`quiet`) e os selos continuam claros.
  - Foco do teclado em azul-claro (o azul da marca some no marinho).
  - No papel, a superfície vira fundo claro com texto escuro (regra de
    impressão em `globals.css`): não use cor fixa dentro dela.
- **Superfícies claras:** cartões em branco (`paper-raised`) com borda `line`
  sobre `paper`; quadros em `surface-muted`. O azul-claro (`brand-soft`,
  `lilac-*`) fica para destaque pontual (aviso, item escolhido, passo atual),
  não para o fundo de uma faixa inteira.
- **Azul-claro, amarelo e verde da apresentação** (`accent-sky`, `signal-yellow`,
  `signal-lime`): só preenchimento (faixas, gráficos, selos), com texto marinho
  por cima. Sobre branco, não chegam a 4.5:1.
- **Verde, âmbar e coral**: estado (alcançado, atenção, alerta).
- **Verde, amarelo e laranja** (`signal-*`): só em dados e só para estado
  (bom, intermediário, atenção), sempre com o valor também em texto e com
  `ink-strong` por cima.
- **Nível de apoio é neutro.** Precisar de apoio físico não é alerta: selos
  (`SupportPill`), medidores (`SupportMeter`, `SupportCells`), a escala do plano
  (`SupportScale`) e os degraus ficam em azul e marinho. A cor de estado do
  apoio vem só da **tendência**, no selo `TrendChip`, sempre com palavra e
  ícone (veja "Assinatura: degraus de apoio").
- **Gráficos** (`src/components/viz/charts.tsx`, objeto `SIGNAL`, que lê os tokens
  por nome):
  - quantidade sem juízo (contagens, usos, partes de um todo, etapas
    cumpridas, nível de apoio): azul da marca (`SIGNAL.brand`), o padrão de
    barras, colunas, anéis e medidores; a área sob a linha (`Sparkline`) em
    `brand-soft`;
  - estado: lima, amarelo e laranja;
  - estado informativo (estável, aceita, realizado): azul-claro (`SIGNAL.cyan`).
  As cinco situações das pílulas (`StatusPill`) têm o mesmo peso: cor cheia e
  texto escuro. O degradê (`rampColor`) é só do medidor de percentual do
  Painel; a escala de apoio não usa degradê.
- **Eixos que se explicam.** Num gráfico de apoio, os rótulos dizem a direção
  ("Independente" no alto, "mais autonomia" / "mais apoio" nas bordas); nada
  de legenda do tipo "subir é precisar de menos apoio".
- **Âmbar:** só o token (`text-amber`, `border-amber`). Nada de `amber-800`
  nem de outra cor da paleta padrão do Tailwind.
- **Céu, verde-água, pêssego, sálvia e rosa**: categorias (tipos de tarefa,
  temas do calendário).

## Tipografia

Uma escala só, nada abaixo de 12 px:

| Classe | Tamanho | Uso |
| --- | --- | --- |
| `text-xs` | 12 | selos, legendas de gráfico |
| `text-sm` | 14 | texto de interface |
| `text-base` | 16 | leitura, títulos de cartão |
| `text-xl` | 20 | títulos de seção |
| `text-2xl` | 24 | título de aba, número em anel, título de página no celular (em negrito, palavras longas como "Acompanhamento" não cabem a 32 px) |
| `text-3xl` | 32 | número de cartão, título no celular |
| `text-4xl` | 40 | título de página |
| `text-5xl` | 56 | número em destaque (medidor do Painel) |

- Sem `text-lg` e sem tamanhos arbitrários (`text-[15px]`).
- Números com `tabular-nums`. A fonte mono só aparece em código.

## Cantos

| Classe | Raio | Uso |
| --- | --- | --- |
| `rounded-xl` | 12 | campos, botões quadrados, blocos dentro de cartões |
| `rounded-2xl` | 22 | cartões |
| `rounded-3xl` | 30 | quadros (`dash-board`) e heróis |
| `rounded-full` | pílula | botões, selos, abas em pílula |

As marcas de gráfico (barras, quadradinhos de legenda) ficam fora da regra.

## Kit de componentes

- **`src/components/form-styles.ts`:** `inputCls` (`inputBoxCls` é o mesmo
  campo sem largura), `textareaCls`, `labelCls`, `hintCls`, `choiceCls`,
  `linkCls` e os botões em `BUTTON_CLS`:
  - `primary`: a ação da tela;
  - `secondary`: azul-claro;
  - `quiet`: com borda, para cancelar, filtrar e navegar;
  - `danger`: excluir; `dangerOutline`: excluir dentro de uma lista.

  Não crie estilo local de campo ou botão.
- **`src/components/form-kit.tsx`:** `Field` (rótulo, dica, erro e
  `aria-describedby` ligados pelo `id`) e `FormResult` (o resultado da ação:
  alerta com os problemas ou confirmação). `useActionResult`
  (`src/components/use-action-result.ts`) envia por transição.
  **Erros juntos:** em formulário longo, `noValidate` e todos os problemas de
  uma vez: `FormResult` no topo com `fields` (cada problema vira link para o
  campo) e `ref` (o foco vai para ele), e a mensagem também no campo
  (`error` em `Field` e `ChoiceField`, `FieldError` num grupo de opções).
- **`src/components/ui.tsx`:**
  - `PageHeader`: `level={2}` para o título de uma aba dentro da ficha do
    estudante, que já tem o h1 com o nome;
  - `PageHero`: faixa em marinho com o personagem, nas telas principais;
    `standalone` quando ela é a página inteira (erro, "não encontrado", aviso);
  - `EmptyState`: com `character` e `action`;
  - `ButtonLink`;
  - `Card`, `Badge`, `SectionTitle`.
- **Lista de seleção:** o `<select>` nativo ganha a seta e o espaço da
  plataforma por uma regra global; basta usar `inputCls`.
- **Carregando:**
  - **Barra azul no topo** (`src/components/navigation-progress.tsx`): aparece
    a cada clique em qualquer tela.
  - **Esqueleto no formato da tela** (`src/components/skeleton.tsx`, via
    `loading.tsx`): só no Painel, nos Recursos, no Calendário e no Assistente.
  - **Cuidado:** não ponha `loading.tsx` acima de páginas com formulário de ação
    de servidor (`<form action={…}>` que revalida ou redireciona). No Next 16.2,
    a atualização depois da ação às vezes não chega à tela e o botão fica preso
    em "Preparando…".
- **Avisos:** `PageHero standalone`, nas páginas de erro e de "não encontrado".

## Menos texto

A equipe e as famílias leem a plataforma no intervalo entre aulas e no celular.
Cada tela diz uma vez o que precisa e mostra o resto com elementos visuais:

- **Uma vez só.** Sem introdução que repete o título, sem frase que repete o
  botão, sem atalho que já está no menu.
- **Rótulo no lugar de frase.** Se o título ou o botão já diz o que é, a linha
  de apoio sai.
- **Vazio some.** Seção sem conteúdo não aparece; quando importa, uma linha.
- **Sem rótulo pequeno acima de título.** O título fala sozinho.
- **Elementos de `src/components/explain.tsx`:**
  - `Steps`: o "como funciona" em etapas com ícone (2 a 5 palavras cada), no
    lugar do parágrafo;
  - `Assurances`: garantias (privacidade, revisão humana, o que não é
    guardado) em selos de até 6 palavras. Aviso de privacidade ou de
    consentimento nunca some: vira selo ou fica mais curto;
  - `HowToRead`: definição de indicador, leitura de gráfico ou norma, a um
    toque ("Como ler"), fechada por padrão.

## Assinatura: degraus de apoio

A marca própria do IncluiEdu ("Menos apoio, mais autonomia"):
`SupportSteps` (`src/components/viz/support-steps.tsx`).

- **O desenho:** cada aula é um quadrado, da mais antiga (à esquerda) à mais
  recente. A **altura** é o nível de apoio: Independente no alto, Físico total
  embaixo, então o desenho sobe quando o estudante precisa de menos apoio. O
  **preenchimento** é a participação, legível sem cor: cheio (toda a
  atividade), metade de baixo (parte), só o contorno (recusou). Os quadrados
  são marinho (`ink-strong`); ficam verdes (`green`) na meta ou acima dela.
  Os lugares vazios são pontos em `line`, e as colunas sem aula ainda (à
  direita) mostram onde entram as próximas. A meta é uma linha tracejada com a
  palavra "meta".
- **Tamanhos:**
  - `mini`: 8 aulas, sem rótulo, tamanho fixo. Cabeçalho da ficha (objetivo em
    foco: o da aula mais recente; some ao rolar), listas, fila do Início.
  - `regular`: 12 aulas, "meta", bordas "mais autonomia" e "mais apoio" e
    legenda só do que aparece. Cartões do Resumo, Registrar aula, cartão
    depois de salvar.
  - `full`: 24 aulas, níveis por extenso e datas da primeira e da última aula
    à vista. Evolução, um por objetivo do plano.
  `regular` e `full` ocupam a largura do pai e tiram as aulas mais antigas
  quando falta espaço (consulta de contêiner): cabem a 320 px.
- **Família** (`audience="familia"`): sem nome de nível; "mais autonomia" no
  alto, "mais ajuda" embaixo e "objetivo" no lugar de "meta".
- **Palavras, não códigos:** IND, SUP, VERB, MOD e FIS-P/T nunca aparecem nos
  degraus.
- **Dados:** `stepsFor(objetivo, aulas)`, `stepsFrom(aulas, { target })` e
  `stepsByObjective(aulas)` em `src/lib/support-steps.ts` (puros, servem no
  servidor e no cliente). Para leitor de tela, `role="img"` com a frase de
  `stepsSentence` ("8 aulas: de Modelo para Supervisão; meta Supervisão
  alcançada nas 2 últimas; …") e a tabela `sr-only` com data, nível e
  participação.
- **Tendência (uma regra só):** `supportTrend` em `src/lib/support-trend.ts`,
  nas 8 aulas mais recentes. Com menos de 3 aulas, "Poucos registros".
  "Pede atenção" só quando um limite é cruzado: 2 recusas nas 4 últimas aulas,
  ou, com 4 aulas ou mais, um nível de apoio a mais, em média, na metade
  recente. Última aula na meta: "Meta alcançada". Meio nível a menos:
  "Avançando". Aulas sem avanço ficam "Estável", com a dica de fracionar o
  objetivo, nunca alerta. O selo é o `TrendChip` (`StatusPill` com ícone:
  sobe, desce, certo, alerta ou seta).
- **Movimento:** os quadrados aparecem da esquerda para a direita em até
  300 ms, uma vez; nada com menos movimento.

## Personagens

São decorativos (`aria-hidden`); o texto ao lado carrega o sentido. Cada um tem
um assunto:

| Personagem | Variante | Onde |
| --- | --- | --- |
| Coração | `care` | família, terapeuta, conquistas, ajuda, erro |
| Lápis | `learning` | início, estudantes, registrar aula, atividades, evolução |
| Prancheta | `planning` | estudo de caso, plano de ensino, DUA, calendário |
| Lâmpada | `ideas` | materiais, assistente, sugestões da IA, conversas guiadas |
| Tela | `resources` | recursos, painel, cadastros, "não encontrado" |

Use os personagens no herói das telas principais, nos estados vazios e nos
momentos de conclusão (planejamento validado, conquistas). Pose ou personagem
novo só com aprovação.

## Ficha do estudante

- O cabeçalho fica numa linha: identidade, selos e o botão do próximo passo.
- O cabeçalho fica preso no topo e, com a página rolada, encolhe para o nome e
  as abas. A altura dele fica em `--sticky-offset`. Use essa variável em tudo
  que também ficar preso dentro das abas: `top: calc(var(--sticky-offset) + 16px)`.
- **Um só próximo passo por tela:**
  - no Resumo, o cartão com as etapas;
  - nas outras abas, o botão do cabeçalho;
  - na própria seção do passo, o aviso "Você está no próximo passo".
- As abas ficam numa linha que rola de lado, no computador e no celular.

## Movimento

- Os cartões sobem 8 px ao entrar.
- Os gráficos crescem uma vez:
  - `viz-grow-y` e `viz-grow-x` nas barras (e nos degraus de apoio, em até
    300 ms no total);
  - `viz-ring` nos anéis;
  - `viz-draw` com `pathLength="1"` nas linhas de série.
- O broto (`sprout-mark`) confirma o que foi salvo.
- Nada pisca nem fica em laço, fora o pulso lento do carregamento.
- Sem opacidade na entrada: o texto nunca fica com pouco contraste no meio
  do caminho.
- Quem pede menos movimento no sistema (`prefers-reduced-motion`) não vê
  nenhuma animação.

## Acessibilidade (WCAG 2.2 AA)

- axe sem violações.
- Nenhuma rolagem lateral a 320 px: use `min-w-0` em filho de grid ou flex
  com texto.
- Alvos de toque de 44 px (`min-h-11`) em botões e links soltos.
- O valor sempre também em texto: nenhum gráfico depende só da cor.
- Um h1 por página.
- O foco do teclado nunca fica escondido embaixo do cabeçalho preso
  (`scroll-padding-top`).
