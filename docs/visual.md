# Padrão visual do IncluiEdu

Regras para manter a aplicação com a mesma cara em todas as telas. A identidade
(lilás, neutros quentes, personagens e a fonte Inter) não muda; o que estas
regras organizam é o uso dela.

## Cores

- Só os tokens de `src/app/globals.css`. Nada de hex novo nos componentes.
- **Lilás** (`brand`, `brand-strong`, `brand-soft`, `lilac`): marca e ações, em
  toda a aplicação, inclusive no Painel.
- **Verde, âmbar e coral**: estado (alcançado, atenção, alerta).
- **Lima, amarelo e laranja** (`signal-*`): só em dados (bom, intermediário,
  atenção), sempre com o valor também em texto.
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
| `text-2xl` | 24 | título de aba, número em anel |
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

- **`src/components/form-styles.ts`:** `inputCls`, `textareaCls`, `labelCls`,
  `hintCls`, `choiceCls`, `linkCls` e os botões:
  - `primaryButtonCls`: a ação da tela;
  - `secondaryButtonCls`: lilás claro;
  - `quietButtonCls`: com borda, para cancelar, filtrar e navegar;
  - `dangerButtonCls`: excluir.

  Não crie estilo local de campo ou botão.
- **`src/components/ui.tsx`:**
  - `PageHeader`: `level={2}` para o título de uma aba dentro da ficha do
    estudante, que já tem o h1 com o nome;
  - `PageHero`: faixa lilás com o personagem, nas telas principais;
  - `HeroStat`;
  - `EmptyState`: com `character` e `action`;
  - `Button` e `ButtonLink`;
  - `Card`, `Badge`, `SectionTitle`.
- **Lista de seleção:** o `<select>` nativo ganha a seta e o espaço da
  plataforma por uma regra global; basta usar `inputCls`.
- **Carregando:**
  - **Barra lilás no topo** (`src/components/navigation-progress.tsx`): aparece
    a cada clique em qualquer tela.
  - **Esqueleto no formato da tela** (`src/components/skeleton.tsx`, via
    `loading.tsx`): só no Painel, nos Recursos, no Calendário e no Assistente.
  - **Cuidado:** não ponha `loading.tsx` acima de páginas com formulário de ação
    de servidor (`<form action={…}>` que revalida ou redireciona). No Next 16.2,
    a atualização depois da ação às vezes não chega à tela e o botão fica preso
    em "Preparando…".
- **Avisos:** `src/components/status-page.tsx`, usado pelas páginas de erro e
  de "não encontrado".

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
  - `viz-grow-y` e `viz-grow-x` nas barras;
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
