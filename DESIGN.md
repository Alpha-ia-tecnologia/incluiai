---
name: IncluiEdu
description: Plataforma municipal de educação inclusiva; menos apoio, mais autonomia.
colors:
  navy: "#0b3550"
  ink: "#0b3550"
  ink-strong: "#06243a"
  ink-soft: "#4a6577"
  on-navy: "#ffffff"
  on-navy-soft: "#c3d7e3"
  navy-line: "rgb(255 255 255 / 0.16)"
  navy-hover: "rgb(255 255 255 / 0.1)"
  brand: "#0a6a9a"
  brand-strong: "#08547a"
  brand-soft: "#e2f1f8"
  lilac: "#cfe5f1"
  accent-sky: "#4fb3e3"
  canvas: "#dce6eb"
  paper: "#f3f6f8"
  paper-raised: "#ffffff"
  surface-muted: "#e6eef1"
  line: "#cddbe2"
  green: "#23703f"
  green-soft: "#e4f2d8"
  amber: "#7a4d00"
  amber-soft: "#fff4cc"
  coral: "#923f48"
  coral-soft: "#f7dee0"
  signal-lime: "#7cb93a"
  signal-yellow: "#f5be0b"
  signal-orange: "#f4693a"
  signal-track: "#e3ecef"
  sky-soft: "#e2f1f8"
  sky-ink: "#0a6a9a"
  teal-soft: "#d3ede8"
  teal-ink: "#1a6159"
  peach-soft: "#fbe3d3"
  peach-ink: "#8a4418"
  sage-soft: "#e2edd6"
  sage-ink: "#3e5d28"
  rose-soft: "#f5e0eb"
  rose-ink: "#8a3363"
typography:
  display:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  headline-mobile:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
  body-reading:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  md: "12px"
  card: "22px"
  frame: "30px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "20px"
  card: "22px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.paper-raised}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
  button-primary-on-navy:
    backgroundColor: "{colors.accent-sky}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-strong}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.lilac}"
  button-quiet:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "44px"
  card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  board:
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.frame}"
    padding: "14px"
  hero-navy:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    rounded: "{rounded.frame}"
    padding: "32px"
  nav-link:
    textColor: "{colors.on-navy-soft}"
    rounded: "{rounded.md}"
    padding: "13px 14px"
    height: "52px"
  nav-link-active:
    backgroundColor: "{colors.accent-sky}"
    textColor: "{colors.ink-strong}"
  status-pill-good:
    backgroundColor: "{colors.signal-lime}"
    textColor: "{colors.ink-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-pill-info:
    backgroundColor: "{colors.accent-sky}"
    textColor: "{colors.ink-strong}"
  status-pill-alert:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.ink-strong}"
  status-pill-neutral:
    backgroundColor: "{colors.signal-track}"
    textColor: "{colors.ink-soft}"
  support-steps-square:
    backgroundColor: "{colors.ink-strong}"
    rounded: "2px"
    size: "14px"
  support-steps-square-goal:
    backgroundColor: "{colors.green}"
---

# Design System: IncluiEdu

## Overview

**Creative North Star: "Menos apoio, mais autonomia"**

O IncluiEdu gira em torno da trajetória do estudante. A linha do apoio liga o registro de aula, a ficha, o Painel e o portal da família: cada tela responde, de um jeito ou de outro, se o estudante está precisando de menos ajuda do que antes. O sistema visual existe para tornar essa resposta legível num relance, no intervalo entre aulas e no celular. A assinatura do produto, os **Degraus de apoio**, é a forma gráfica dessa ideia: quadrados que sobem conforme o estudante ganha autonomia.

O tom é **calmo e preciso**. O marinho e o azul seguram a tela; o conteúdo fica em cartões brancos sobre um papel cinza-azulado, com um único bloco marinho por tela (além do menu) ancorando a leitura. A cor de estado (verde, âmbar, laranja, coral) só aparece quando um limite é cruzado, e sempre acompanhada de palavras. Os personagens em azul-claro aparecem só nas boas-vindas, nos estados vazios e nos momentos de conclusão. Nada de decoração nova. A densidade é de ferramenta de trabalho (modo Operate): varredura e consistência valem mais que expressão. O tom é pedagógico, nunca clínico.

`docs/visual.md` é o caderno de regras detalhado do projeto (tokens, escala, cantos, kit de formulário, "Menos texto", personagens, movimento); este DESIGN.md é o resumo legível por máquina e não o contradiz. A única regra em que os dois divergem é a cor dos níveis de apoio: aqui vale a regra nova (cor pela tendência, níveis neutros), decidida nesta rodada; `docs/visual.md` será alinhado a ela.

**Key Characteristics:**
- Marinho como âncora: menu lateral, barra do celular e um herói por tela, com troca de papéis de cor (`surface-navy`).
- Cartões brancos com borda fina sobre papel cinza-azulado; profundidade por tom, não por sombra.
- Uma família tipográfica (Noto Sans), títulos e números em negrito, nada abaixo de 12 px.
- Quatro cantos: 12, 22, 30 e pílula.
- Cor de estado só quando um limite é cruzado, sempre com texto; o nível de apoio em si é neutro.
- Menos texto: dizer uma vez, rótulo no lugar de frase, seção vazia some.

## Colors

Uma paleta fria e contida: marinho e azul estruturam tudo, o azul-claro marca ação e item ativo sobre o marinho, e os sinais quentes ficam guardados para quando os dados pedem.

### Primary
- **Marinho Âncora** (`navy`): superfície do menu lateral, da barra do celular, do herói das telas principais, do destaque do Painel, das boas-vindas, dos avisos e do login. Também é a cor do texto (`ink`, mesmo valor) em todo o papel claro.
- **Marinho Profundo** (`ink-strong`): texto sobre os preenchimentos claros (azul-claro, lima, amarelo, laranja) e cor dos quadrados dos Degraus de apoio.
- **Azul Ação** (`brand`): botões primários, links, foco do teclado, barra de carregamento e toda quantidade sem juízo nos gráficos (barras, colunas, anéis, medidores).
- **Azul Ação Firme** (`brand-strong`): hover do botão primário, texto de link e de aba ativa, texto do botão secundário.

### Secondary
- **Azul Brisa** (`brand-soft`, com `lilac` no hover): fundo do botão secundário, item escolhido, passo atual; destaque pontual, nunca o fundo de uma faixa inteira. Os nomes `lilac-*` ficaram dos tokens antigos e hoje são tons de azul-claro.
- **Azul-Céu da Apresentação** (`accent-sky`): ação e item ativo sobre o marinho (com texto `ink-strong`), foco do teclado dentro do marinho, estado informativo nos gráficos e pílulas. Só preenchimento: sobre branco não chega a 4.5:1.

### Tertiary (estado)
- **Verde Alcançado** (`green` / `green-soft`): objetivo alcançado, confirmação, meta atingida nos Degraus de apoio (≥ 3:1 sobre branco).
- **Âmbar Atenção** (`amber` / `amber-soft`): aviso em texto e selo; também a faixa de "sugestão da IA para análise".
- **Coral Alerta** (`coral` / `coral-soft`): erro, exclusão, alerta em texto.
- **Sinais do Painel** (`signal-lime`, `signal-yellow`, `signal-orange`, trilho `signal-track`): estado nos dados (bom, intermediário, atenção), sempre como preenchimento com texto `ink-strong` por cima e o valor também em texto. As três cores da apresentação também formam a faixa de 6 px na base da moldura e da carteirinha.
- **Categorias** (pares `sky`, `teal`, `peach`, `sage`, `rose`, cada um `*-soft` de fundo com `*-ink` de texto, ≥ 4.5:1): tipos de tarefa, temas do calendário, atalhos do início. Nunca estado.

### Neutral
- **Papel** (`paper`): fundo da área de conteúdo dentro da moldura e dos campos de formulário.
- **Branco Cartão** (`paper-raised`): cartões e painéis flutuantes.
- **Névoa** (`canvas`): fundo da página atrás da moldura.
- **Quadro Cinza** (`surface-muted`): quadros que agrupam cartões (Painel, coluna lateral do início), chips de etapa.
- **Linha** (`line`): bordas de cartão, campo e divisórias; pontos vazios da grade dos Degraus de apoio.
- **Texto de Apoio** (`ink-soft`): dicas, metadados, legendas.
- **Sobre o Marinho** (`on-navy` títulos, 12,8:1; `on-navy-soft` apoio, 8,6:1; `navy-line` linhas; `navy-hover` realce).

### Named Rules
**The Cor pela Tendência Rule.** A cor fala da tendência, não do rótulo. O nível de apoio é neutro (marinho e azul); só o selo de tendência carrega cor de estado ("Avançando" verde, "Estável" azul-céu, "Pede atenção" laranja/coral, "Poucos registros" neutro), sempre com palavra e seta ou ícone. "Pede atenção" só quando um limite é cruzado (o apoio subiu nas aulas recentes, ou recusas repetidas); "sem avanço por algumas aulas" é Estável, com uma dica pedagógica. Precisar de apoio físico não é alerta: nada de âmbar, laranja ou coral para nível de apoio.

**The Um Marinho Rule.** Um bloco marinho por tela, além do menu. Dentro dele, texto só em `on-navy`/`on-navy-soft` e ação em azul-céu; nunca `ink`, `ink-soft` ou `brand` sobre o marinho. Os componentes leem os papéis (`action`, `surface-ink`…) que `surface-navy` troca, e não fixam cor dentro dele (na impressão, o marinho vira papel claro).

**The Nenhum Hex Novo Rule.** Só os tokens de `src/app/globals.css`; nada de hex novo nem de cor da paleta padrão do Tailwind nos componentes. O tema do município troca os tokens, não os componentes.

## Typography

**Display Font:** Noto Sans (com system-ui, sans-serif)
**Body Font:** Noto Sans (com system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono, só em código

**Character:** Uma família só, humanista e legível em qualquer tamanho; a hierarquia vem do peso (títulos e números em negrito, com leve aperto de -0,015em) e do tamanho, nunca de uma segunda fonte.

### Hierarchy
- **Display** (700, 56 px, 1): número em destaque, como o medidor do Painel.
- **Headline** (700, 40 px, 1,12): título de página (h1) no computador; 24 a 32 px no celular, onde palavras longas como "Acompanhamento" não cabem a 40 px.
- **Title** (500, 20 px): títulos de seção; 24 px para título de aba e número em anel, 32 px para número de cartão.
- **Body Reading** (400, 16 px, 1,5): leitura corrida, títulos de cartão, menu lateral; até ~65ch.
- **Body** (400, 14 px, 1,5): texto de interface, campos, botões (500).
- **Label** (500, 12 px): selos, legendas de gráfico. Nada abaixo de 12 px.

### Named Rules
**The Escala Única Rule.** Só os oito degraus 12, 14, 16, 20, 24, 32, 40, 56. Sem `text-lg` (18) e sem tamanhos arbitrários. Números sempre com algarismos tabulares.

**The Texto Que Cresce Rule.** Todo tamanho em rem: o controle de tamanho do texto e a impressão escalam a interface inteira; com o texto ampliado, palavra longa quebra em vez de empurrar a tela para o lado.

## Layout

No computador, a tela é uma moldura arredondada (32 px de canto, máx. 1680 px) sobre a névoa, com o menu marinho preso à esquerda (268 px) e o conteúdo à direita (32 px de respiro lateral, 96 px no fim para o botão do Assistente). O início usa uma coluna principal e uma lateral de 296 px em quadro cinza, que desce para baixo abaixo de 1280 px. Abaixo de 1024 px o menu vira a barra marinha flutuante no pé da tela (itens de 56 px) e, abaixo de 768 px, a moldura encosta nas bordas (8 px) e os cartões apertam o respiro (18 px). Nenhuma tela rola de lado a 320 px.

O ritmo é de ferramenta: cartões de 20 a 22 px de respiro interno, grades com 22 a 34 px de intervalo, um próximo passo por tela. Na ficha do estudante, o cabeçalho fica preso no topo e encolhe para nome e abas ao rolar; as abas são fixas e seguem a trilha (Resumo | Estudo de caso · Plano · Como aprende · Atividade · Registro · Evolução | Mais), numa linha quando cabem e em grade de quatro (três no celular estreito) quando não, sem rolar de lado; no celular, com a página rolada, a grade vira a seção atual, que abre a lista.

**The Um Próximo Passo Rule.** Cada tela da ficha tem uma só ação principal visível: o cartão de etapas no Resumo, o botão do cabeçalho nas outras abas.

## Elevation & Depth

O sistema é plano e por tons: profundidade vem do contraste entre névoa, papel, quadro cinza e cartão branco com borda fina, e do marinho como plano de ancoragem. Sombras são sopros de marinho, quase invisíveis, e servem a três casos: o realce de um cartão-link no hover, o que flutua (barra do celular, Assistente, menu do celular) e a moldura das telas de entrada. O foco dos campos é um halo azul-céu.

### Shadow Vocabulary
- **Repouso** (`box-shadow: 0 2px 8px rgb(11 53 80 / 0.03)`): marcas pequenas sobre gráficos e trilhas, itens soltos sem borda (sugestões, materiais).
- **Flutuante** (`box-shadow: 0 8px 24px rgb(11 53 80 / 0.08)`): cartão-link no hover (subindo 3 px), barra do celular, botão do Assistente, menu do celular.
- **Halo de Foco** (`box-shadow: 0 0 0 4px rgb(79 179 227 / 0.35)`): campo com foco, junto da borda azul.
- **Moldura** (`box-shadow: 0 24px 80px -36px rgb(11 53 80 / 0.24)`): telas de entrada e painel do Assistente.

### Named Rules
**The Plano em Repouso Rule.** Cartões ficam planos e com borda em repouso; a sombra Flutuante é só para o que flutua ou responde ao hover. Nenhuma sombra dura deslocada.

## Shapes

Quatro cantos, macios e consistentes: 12 px para campos, botões quadrados e blocos dentro de cartões; 22 px para cartões (19 px no celular); 30 px para quadros e heróis; pílula para botões, selos e abas em pílula. Bordas de 1 px na cor `line`; tracejado só para estado vazio e para a linha de meta. Marcas de gráfico (barras, quadrados, legendas) ficam fora da regra de cantos. As texturas listradas (`hatch`, 120°) marcam preenchimentos de gráfico e medidores, para a leitura não depender só da cor.

## Components

### Buttons
Pílulas firmes e calmas, sempre com 44 px de altura mínima (`BUTTON_CLS` em `src/components/form-styles.ts`; não crie estilo local).
- **Shape:** pílula, texto 14 px peso 500, ícone de 16 px com 8 px de intervalo.
- **Primary:** Azul Ação com texto branco (20 px de respiro lateral); a ação da tela. Dentro do marinho, vira azul-céu com texto Marinho Profundo, sem nenhuma opção.
- **Hover / Focus:** hover escurece para Azul Ação Firme (160 ms); foco com contorno de 2 px em `brand` a 4 px de distância (azul-céu dentro do marinho). Desabilitado: 60% de opacidade.
- **Secondary:** Azul Brisa com texto Azul Ação Firme. **Quiet:** branco com borda `line`, para cancelar, filtrar e navegar. **Danger:** texto coral, fundo coral suave no hover.

### Chips
- **Selo de estado** (`StatusPill`): pílula de 12 px, cor cheia dos sinais com texto Marinho Profundo; as cinco situações têm o mesmo peso. Sempre com a palavra.
- **Selo suave** (`Badge`): fundo `*-soft` com texto do mesmo tom, para rótulos e contagens.
- **Etapas e garantias** (`Steps`, `Assurances`): chips de 36 px com ícone e 2 a 6 palavras, no lugar de parágrafos.

### Cards / Containers
- **Corner Style:** 22 px (19 px no celular); quadros em 30 px.
- **Background:** Branco Cartão sobre Papel; quadros em Quadro Cinza agrupando cartões brancos.
- **Shadow Strategy:** plano em repouso; ver Elevation & Depth.
- **Border:** 1 px `line` (o cartão do Painel dispensa a borda dentro do quadro).
- **Internal Padding:** 22 px (20 px no Painel, 16 a 18 px no celular). Entram subindo 8 px em 260 ms, sem opacidade.

### Inputs / Fields
- **Style:** fundo Papel, borda 1 px `line`, canto 12 px, 44 px de altura, texto 14 px; rótulo 14 px peso 500 acima, dica 12 px em `ink-soft`, ligados por `Field`.
- **Focus:** borda azul mais o Halo de Foco (160 ms).
- **Select:** o `<select>` nativo, com a seta azul da plataforma (`--select-arrow`). **Escolhas** (rádio e caixa): linhas de 48 px que ficam azul-brisa com borda azul quando marcadas.
- **Error / Disabled:** o resultado da ação aparece em `FormResult` (alerta com os problemas); desabilitado a 60%.

### Navigation
- **Menu lateral:** marinho, canto 22 px, itens de 52 px com ícone, texto 16 px em `on-navy-soft`; hover com `navy-hover`; ativo em azul-céu com texto Marinho Profundo e peso 500.
- **Celular:** a mesma linguagem numa barra marinha flutuante no pé (itens de 56 px, texto 12 px).
- **Abas da ficha:** texto 14 px, 44 px de altura (48 px na grade, onde o rótulo pode ir em duas linhas); ativa em Azul Ação Firme, em peso 500, com um traço de 3 px em azul embaixo; numa seção do Mais, o próprio Mais fica marcado.
- **Carregando:** barra azul de 3 px no topo a cada clique.

### Degraus de apoio (Signature Component)
A assinatura do produto e a direção assumida que está sendo implementada nesta rodada (componente `SupportSteps`, `src/components/viz/support-steps.tsx`). Cada aula é um quadrado: a altura mostra o nível de apoio, o preenchimento mostra a participação. Uma marca carrega as duas informações, cabe pequena num cabeçalho e não parece um gráfico genérico.
- **Grade:** colunas = aulas em ordem de data (a mais recente à direita); linhas = os seis níveis, **Independente no topo, Físico total embaixo**, então a figura sobe quando o estudante precisa de menos apoio. Pontos vazios da grade são pontinhos na cor `line`.
- **Preenchimento sem depender da cor:** participou de toda a atividade = cheio; em parte = metade preenchida; recusou = só contorno.
- **Cor:** quadrados em Marinho Profundo (o nível é neutro); quadrados na linha da meta ou acima dela ficam em Verde Alcançado: a marca "acende" quando a meta é atingida. Nada de âmbar, laranja ou coral.
- **Meta:** linha tracejada na altura da meta, com a palavra "meta" (equipe) ou "objetivo" (família).
- **Tamanhos:** `mini` (células de ~8 px, 8 últimas aulas, sem rótulos: cabeçalho da ficha, cartões de lista, fila do Início); `regular` (~14 px, 12 aulas, rótulo da meta e legenda curta: cartão depois de salvar, cartões de objetivo); `full` (rótulos das linhas em palavras, primeira e última data, legenda: Evolução). Cabe a 320 px sem rolagem lateral.
- **Palavras, não códigos:** "Independente", "Supervisão", "Instrução verbal", "Modelo", "Físico parcial", "Físico total". Códigos como VERB ou FIS-T nunca aparecem na assinatura.
- **Família** (`audience="familia"`): sem rótulos de linha; "mais autonomia" no alto e "mais ajuda" embaixo; "objetivo" no lugar de "meta".
- **Acessível:** `role="img"` com uma frase gerada por função pura testada (por exemplo, "8 aulas: de Modelo para Supervisão; meta Supervisão alcançada nas 2 últimas; …") e uma tabela só para leitor de tela (data, nível, participação).
- **Movimento:** no máximo uma entrada curta (quadrados da esquerda para a direita, ≤ 300 ms no total), desligada com `prefers-reduced-motion`. Nada em laço.
- **Vazio:** sem aulas, a grade pontilhada com "Ainda sem registro"; com 1 ou 2 aulas, os quadrados sem tendência.

**The Subir É Autonomia Rule.** Em toda marca de apoio, para cima é menos apoio, e os rótulos dos eixos dizem isso sozinhos; nenhuma legenda precisa explicar ("Subir é precisar de menos apoio" deixa de ser necessária).

## Do's and Don'ts

### Do:
- **Do** usar só os tokens de `src/app/globals.css` e os papéis de cor (`action`, `surface-ink`…), para que o marinho e o tema do município funcionem sem opção.
- **Do** mostrar o nível de apoio em marinho e azul, e dar cor de estado só ao selo de tendência, sempre com palavra e seta ou ícone (The Cor pela Tendência Rule).
- **Do** usar os Degraus de apoio onde houver nível de apoio por aula: cabeçalho da ficha, cartão depois de salvar, Evolução, portal da família, Painel.
- **Do** manter um bloco marinho por tela, além do menu, com ação em azul-céu dentro dele.
- **Do** usar o azul da marca para quantidade sem juízo nos gráficos e os sinais (lima, amarelo, laranja) só para estado, sempre com o valor também em texto.
- **Do** garantir 44 px nos alvos de toque, contraste de 4.5:1 no texto (3:1 em gráficos), foco visível e nenhuma rolagem lateral a 320 px.
- **Do** dizer uma vez: rótulo no lugar de frase, seção vazia some, explicação de leitura atrás de "Como ler".
- **Do** usar personagens só nas boas-vindas, nos estados vazios e nos momentos de conclusão, sempre decorativos (`aria-hidden`).

### Don't:
- **Don't** pintar nível de apoio de âmbar, laranja ou coral: precisar de apoio físico não é alerta.
- **Don't** chamar de "Pede atenção" a falta de avanço por algumas aulas; isso é Estável, com uma dica pedagógica.
- **Don't** criar hex novo, fonte nova, `text-lg` ou tamanho arbitrário, nem texto abaixo de 12 px.
- **Don't** pôr `ink`, `ink-soft` ou `brand` sobre o marinho, nem empilhar dois blocos marinhos.
- **Don't** usar azul-céu, amarelo ou lima como cor de texto sobre branco.
- **Don't** pôr rótulo pequeno acima de título nem introdução que repete o título.
- **Don't** mostrar códigos (VERB, FIS-T) na assinatura nem informar estado só pela cor.
- **Don't** animar com opacidade na entrada, em laço ou piscando; com `prefers-reduced-motion`, nada se move.
