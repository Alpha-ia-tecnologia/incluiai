---
name: IncluiEdu
description: Mural da sala dos professores para o acompanhamento do AEE na rede municipal.
colors:
  ink: "#1d1b1a"
  ink-hover: "#3b3531"
  ink-soft: "#57504a"
  placeholder: "#6e6660"
  pen: "#2b4a9b"
  tack: "#c8362f"
  cork: "#b88a5c"
  paper: "#fdfcfa"
  paper-raised: "#ffffff"
  surface-muted: "#f3efe8"
  brand-soft: "#efe8dd"
  brand-soft-hover: "#e6ddcf"
  line: "#e3dcd1"
  paper-yellow: "#f3cf45"
  paper-yellow-soft: "#fbeeb0"
  paper-blue: "#9ccbe8"
  paper-green: "#a9d8a2"
  paper-pink: "#f2b6c6"
  paper-lilac: "#cdb8ea"
  state-green: "#2b6651"
  state-green-soft: "#e4f2e1"
  state-amber: "#81551e"
  state-amber-soft: "#fae7ca"
  state-coral: "#923f48"
  state-coral-soft: "#f7dee0"
  chart-mid: "#96651f"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 82"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 82"
  section:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.33
    fontVariation: "'wdth' 82"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.375
    fontVariation: "'wdth' 82"
  numeral:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.2
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 82"
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.625
  body-small:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  tab: "3px"
  notice: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  2xl: "12px"
  full: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "28px"
  xl: "34px"
  page-x: "36px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-raised}"
    typography: "{typography.body-small}"
    rounded: "{rounded.full}"
    padding: "12px 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-secondary:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.pen}"
    rounded: "{rounded.full}"
    padding: "12px 22px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.brand-soft-hover}"
  today-notice:
    backgroundColor: "{colors.paper-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.notice}"
    padding: "36px 32px 32px"
  mural-sheet:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px"
  card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "22px"
  student-card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  task-link:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "56px"
  nav-rail:
    backgroundColor: "{colors.cork}"
    textColor: "{colors.ink}"
    padding: "28px 16px 18px"
    width: "248px"
  nav-link-current:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 30px 12px 12px"
    height: "48px"
  input:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "48px"
  text-link:
    textColor: "{colors.pen}"
    typography: "{typography.body-small}"
    height: "44px"
  chapter-mark:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "28px"
  chapter-mark-done:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-yellow}"
    rounded: "{rounded.full}"
    size: "28px"
---

# Design System: IncluiEdu

## Overview

**Creative North Star: "O mural da sala dos professores"**

O IncluiEdu é o mural da equipe: a barra lateral é a cortiça, as superfícies de trabalho são folhas de papel branco presas nela, e o recado de hoje fica fixado no topo em papel amarelo-ofício, com uma tachinha vermelha. Cada estudante é um cartão com a aba de cor da sua etapa; o que a professora fixa sobe ao topo e ganha a mesma tachinha. O sistema fala a língua material de uma sala de professores de escola pública, não a de um software clínico nem a de um portal de governo.

A densidade é de ferramenta de trabalho: poucas cores fortes, muita folha branca, borda fina, cantos pequenos de papel. A cor tem emprego fixo. Os papéis coloridos dizem a família da tarefa, a tachinha diz "agora" ou "fixado", a caneta azul diz "link ou dado", e verde, âmbar e coral só aparecem onde existe estado. Tudo o mais é tinta preta quente sobre papel. Títulos e números usam a Archivo condensada; o texto corrido e a interface usam a Atkinson Hyperlegible Next, desenhada para baixa visão. O único movimento da tela é a tachinha assentando o recado ao carregar.

Rejeições confirmadas pelo dono: visual clínico; cara de site do governo (azul institucional de sistema); cortiça como textura; notas tortas; tachinhas espalhadas; visual infantil; o SaaS pastel anterior, de lilás e personagem por toda parte. O padrão de acessibilidade é eMAG + WCAG 2.1 AA.

**Key Characteristics:**
- Cortiça como cor plana só na navegação; papel branco em toda superfície de trabalho.
- Papéis coloridos só em abas e quadradinhos de categoria, com mapa fixo de significado.
- Uma cor só para o agora: o vermelho-tachinha.
- Texto sempre em tinta sobre cortiça e sobre papel colorido; links e dados em caneta azul.
- Borda fina de 1px, cantos de papel de 3 a 8px, sem sombra decorativa.
- Situações como marcas (visto, contorno, tracejado, aro vermelho), nunca como selos coloridos.
- Personagens ilustrados como ativos de marca, recortados, com moderação.

## Colors

Paleta de mural: tinta preta quente sobre papel quase branco, cortiça plana, quatro papéis de categoria, um amarelo de recado, uma tachinha e uma caneta.

### Primary
- **Tinta preta quente** (ink): cor do texto, dos títulos, dos ícones e do botão principal. É também a cor do anel de foco. O botão escurece para **Tinta de hover** (ink-hover) sob o cursor.
- **Caneta azul** (pen): links de texto sublinhados, números do resumo, dados de gráfico (`--chart-data`) e o texto do botão secundário. No código também responde por `brand-strong`.

### Secondary
- **Cortiça plana** (cork): fundo da barra lateral no computador e da barra de navegação flutuante no celular. Cor sólida, nunca imagem.
- **Amarelo-ofício** (paper-yellow): só o recado de hoje (e o recado de boas-vindas no primeiro acesso, que ocupa o mesmo lugar). Também é o visto dentro da marca de capítulo feito. A versão suave (paper-yellow-soft) é a cor da seleção de texto.
- **Papéis de categoria**: azul (paper-blue) = registrar; verde (paper-green) = preparar; rosa (paper-pink) = conhecer e ouvir; lilás (paper-lilac) = planejar. Aparecem como faixa de 6px no topo do cartão de estudante e como quadradinho de 14px nas outras tarefas.

### Tertiary
- **Vermelho-tachinha** (tack): o pino do recado de hoje, o pino do cartão fixado, o ícone de "Fixado", o ponto da página atual na navegação e o aro da marca "agora".
- **Cores de estado**: verde (state-green), âmbar (state-amber) e coral (state-coral), com seus fundos suaves, só em selos de nível de apoio, indicadores do painel, avisos e gráficos (bom, intermediário em chart-mid, baixo). O texto ao lado sempre dá o valor.

### Neutral
- **Papel** (paper): fundo do corpo da página e do painel do assistente.
- **Papel de cima** (paper-raised): cartões, folhas da lateral, item atual da navegação, campos.
- **Papel gasto** (surface-muted) e **papel creme** (brand-soft): hover de botões sem fundo, botão de fixar pressionado, cabeçalho do estudante, avisos neutros, botão secundário.
- **Borda de papel** (line): borda de 1px de todo cartão, divisórias e trilho de gráfico.
- **Tinta suave** (ink-soft): texto de apoio, metadados, legendas (7,9:1 sobre branco).
- **Placeholder** (placeholder): exemplo dentro do campo, com 4,5:1 ou mais.

### Named Rules
**The Paper Map Rule.** Azul = registrar, verde = preparar, rosa = conhecer e ouvir, lilás = planejar. Amarelo-ofício só no recado de hoje. Nenhuma outra cor faz papel de categoria, e nenhum papel de categoria vira fundo de área grande.

**The One Tack Rule.** O vermelho-tachinha é reservado ao agora e ao que está fixado. Nunca é cor de categoria, de texto, de erro ou de destaque decorativo.

**The Ink On Paper Rule.** Sobre cortiça e sobre papel colorido, todo texto é tinta (ink). Cinza e caneta não chegam a 4,5:1 nesses fundos.

**The Pen Means Link Rule.** Caneta azul marca links e dados. Texto corrido e títulos não usam caneta.

**The Meaningful State Rule.** Verde, âmbar e coral só aparecem onde carregam um estado real, sempre acompanhados de texto.

## Typography

**Display Font:** Archivo, eixo de largura em 82% (com system-ui, sans-serif)
**Body Font:** Atkinson Hyperlegible Next (com system-ui, sans-serif)
**Label/Mono Font:** ui-monospace só no número do anel de progresso

**Character:** a Archivo condensada e pesada dá aos títulos e números a voz de letreiro de recado, firme e econômica; a Atkinson Hyperlegible garante que o texto de trabalho seja lido por quem tem baixa visão. A condensação vem da classe de display (`font-stretch: 82%`, `letter-spacing: -0.005em`, `word-spacing: 0.1em`).

### Hierarchy
- **Display** (800, 38px no celular e 46px a partir de 640px, 1,05): a pergunta do Início ("O que vamos fazer hoje, Marcos?"). Uma por tela.
- **Headline** (800, 28px / 34px, 1,1): título do recado de hoje. Títulos de página internos usam 30px / 40px em 700 com 1,15.
- **Section** (800, 24px): títulos de seção no corpo ("Próximo passo por estudante").
- **Title** (700, 18px, 1,375): títulos das folhas da lateral e de cartões de resumo.
- **Numeral** (800, 30px, algarismos tabulares, caneta azul): números do resumo. KPIs do painel sobem para 36px em 700.
- **Body** (400, 16px, 1,625, até cerca de 42rem): texto do recado e parágrafos. Nome do estudante em 16px 700.
- **Body small** (400 ou 700, 14px): metadados, links, rótulos de seção pequenos ("Outras tarefas" em 700), botões.
- **Label** (400, 12px): o piso. Legendas de gráfico, datas, texto da cortiça no rodapé. Nada abaixo de 12px.

### Named Rules
**The Two Voices Rule.** Archivo condensada só em títulos e números; tudo que se lê em frase é Atkinson.

**The 12px Floor Rule.** Nenhum texto abaixo de 12px, inclusive legendas de gráfico e rótulos da navegação do celular.

## Layout

No computador, a moldura é uma barra de cortiça fixa de 248px à esquerda e o conteúdo em papel à direita, com respiro de 24px no topo, 36px nas laterais e 96px no fim. O Início usa duas colunas: o mural principal e uma lateral de 296px separada por uma linha fina vertical e 34px de vão (260px e 22px abaixo de 1200px). Abaixo de 1280px a lateral desce para baixo do mural, em duas colunas, separada por linha horizontal; abaixo de 768px vira uma coluna só.

Abaixo de 1024px a barra de cortiça some e vira uma barra de navegação flutuante, também em cortiça, presa a 12px das bordas e 10px do fim da tela, com cantos de 12px e itens de 56px de altura. O conteúdo ganha folga no fim para não ficar sob ela. Abaixo de 768px o respiro do conteúdo cai para 18px.

O ritmo é curto e regular: 8px entre itens de grade de tarefas, 12px entre cartões de estudante, 20 a 22px dentro dos cartões, 28 a 32px entre seções. Cartões de estudante em duas colunas a partir de 640px; tarefas em três colunas.

**The 44px Target Rule.** Todo alvo de toque tem no mínimo 44px de altura (links de texto incluídos, com `min-height`); ações principais e itens de navegação, 48px.

## Elevation & Depth

O sistema é plano: profundidade vem de papel branco sobre papel, borda de 1px e a cortiça ao lado. A única peça que realmente "está presa no mural" é o recado de hoje, com uma sombra curta de papel, e as tachinhas, com uma sombra mínima de pino. Superfícies flutuantes (menu do celular, navegação flutuante, botão do assistente, menu da conta) usam a sombra de elevação 2. Nada mais tem sombra em repouso.

### Shadow Vocabulary
- **Papel preso** (`box-shadow: 0 1px 0 rgb(60 40 20 / 0.08), 0 10px 22px rgb(60 40 20 / 0.12)`): só o recado de hoje.
- **Pino** (`box-shadow: 0 3px 4px rgb(0 0 0 / 0.25)`): só a tachinha do recado e do cartão fixado.
- **Elevação 2** (`box-shadow: 0 8px 22px rgb(60 40 20 / 0.12)`): camadas que flutuam sobre o conteúdo.
- **Brilho de foco** (`box-shadow: 0 0 0 4px rgb(29 27 26 / 0.12)`): campo com foco, junto da borda em tinta.

### Named Rules
**The Pinned Not Floating Rule.** Só o que está preso no mural ganha sombra de papel; cartões comuns são planos com borda fina. Hover muda a borda (tinta a 40%), não levanta o cartão.

## Shapes

Cantos de papel, pequenos: 3px no quadradinho de categoria, 4px no recado, 6px nos cartões de estudante, folhas e tarefas, 8px em cartões genéricos, campos e item da navegação, 10 a 12px só em camadas flutuantes. Botões de ação são cápsulas (999px). Marcas de capítulo e tachinhas são círculos. Borda de 1px na cor da borda de papel em todo cartão; a faixa de categoria fica no topo do cartão, com a mesma curva dele.

A tachinha é sempre um círculo vermelho de 18 a 20px centrado na borda superior da peça, metade para fora. Na navegação, a página atual leva um ponto vermelho de 8 a 10px à direita.

## Components

### Buttons
Cápsula de tinta, firme e direta.
- **Shape:** cápsula (999px), altura mínima de 48px (44px nas versões compactas).
- **Primary:** fundo tinta, texto branco 15px em 700, padding 12px 22px, seta à direita quando leva a outra tela.
- **Hover / Focus:** fundo tinta de hover em 160ms; foco com contorno de 2px em tinta a 4px de distância.
- **Secondary:** fundo papel creme, texto caneta azul; hover em papel creme mais escuro.
- **Botão de fixar:** cápsula sem fundo, 44px, ícone de pino e texto em tinta; pressionado ganha fundo papel gasto, texto em 700 e o pino preenchido em vermelho-tachinha.

### Chips
- **Style:** selos em cápsula com fundo suave e texto da mesma família (papel creme com caneta; estados com seu fundo suave). 12px.
- **State:** usados para nível de apoio e situações do painel; nunca para categoria (categoria é aba de papel).

### Cards / Containers
- **Corner Style:** 6px (estudante, tarefa, folhas) ou 8px (cartões genéricos e do painel).
- **Background:** papel de cima.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** 1px borda de papel; hover em tinta a 40%.
- **Internal Padding:** 20 a 22px (16 a 18px no celular).

### Inputs / Fields
- **Style:** fundo papel de cima, borda de 1px, cantos de 8px, altura mínima de 48px, texto 16px.
- **Focus:** borda em tinta e brilho de foco de 4px; cursor em tinta.
- **Placeholder:** cor placeholder, opacidade total.

### Navigation
- **Barra de cortiça:** logotipo IncluiEdu em Archivo 26px 800; itens de 48px, 15px, ícone de 20px, tudo em tinta. Hover em branco a 40%. Página atual em papel de cima, texto em 700 e ponto vermelho-tachinha à direita. Rodapé com dados da conta em tinta, separado por linha de tinta a 20%.
- **Celular:** a mesma cortiça em barra flutuante; itens de 56px com rótulo de 12px; atual em papel de cima com ponto vermelho no canto.
- **Abas do estudante:** sublinhado de 2px em tinta no item atual, texto em 700; os demais em tinta suave. No celular, viram um campo de seleção com botão "Abrir".

### Recado de hoje (signature)
Folha amarela-ofício com cantos de 4px, sombra de papel preso e a tachinha vermelha no centro da borda superior, que assenta uma vez ao carregar (420ms, `cubic-bezier(0.25, 1, 0.5, 1)`, desligada com movimento reduzido). Dentro: título em headline, texto em body, botão principal, link "Ver a história completa" sublinhado em tinta (sobre amarelo, link é tinta), a fileira de marcas de capítulo e, à direita, o personagem recortado a partir de 640px. Uma por tela.

### Cartão de estudante (signature)
Folha branca com faixa de 6px no topo, na cor do papel da etapa atual (rosa nas etapas 1 e 2, lilás na 3, verde na 4, azul na 5). Nome em 16px 700, metadados em 14px tinta suave, o próximo passo em uma linha, as marcas de etapa pequenas e o link de ação em caneta azul. Fixado, recebe a tachinha centrada no topo e sobe para o início da lista.

### Marcas de capítulo (signature)
Círculos de 28px (20px na versão pequena) que carregam o estado pela forma: **feito** = círculo cheio de tinta com visto amarelo; **agora** = aro vermelho-tachinha de 3px com o número; **em aberto** = contorno de tinta de 1,5px com o número; **aguardando outra pessoa** = contorno tracejado. Cada marca tem texto para leitor de tela.

### Tarefas com aba
Linha de 56px em folha branca com quadradinho de papel de 14px (canto de 3px), ícone de 19px em tinta, rótulo em 14px 700 e seta que avança 4px no hover.

## Do's and Don'ts

### Do:
- **Do** usar o mapa de papéis sem exceção: azul registrar, verde preparar, rosa conhecer e ouvir, lilás planejar; amarelo-ofício só no recado de hoje.
- **Do** reservar o vermelho-tachinha para o agora e para o que está fixado: tachinha, ponto da página atual, aro da marca "agora", pino do botão Fixado.
- **Do** escrever em tinta (#1d1b1a) todo texto sobre cortiça e sobre papel colorido.
- **Do** usar caneta azul para links sublinhados e para dados e números.
- **Do** mostrar situação por forma (visto, aro, contorno, tracejado) e sempre com texto, para funcionar em preto e branco e no leitor de tela.
- **Do** manter os alvos em 44px ou mais, o texto em 12px ou mais e o placeholder em 4,5:1 ou mais (eMAG + WCAG 2.1 AA).
- **Do** manter os personagens ilustrados (`public/illustrations/characters/`) como ativos de marca, recortados, um por bloco.
- **Do** dar borda de 1px e cantos de papel a todo cartão; mudar a borda no hover em vez de levantar o cartão.

### Don't:
- **Don't** usar textura ou foto de cortiça; a cortiça é cor plana e só na navegação.
- **Don't** inclinar notas ou cartões nem espalhar tachinhas: uma no recado, uma em cada cartão fixado, nenhuma decorativa.
- **Don't** usar o vermelho-tachinha como categoria, cor de texto, erro ou destaque.
- **Don't** usar verde, âmbar ou coral onde não houver estado.
- **Don't** pintar áreas grandes com os papéis de categoria nem com lilás; o lilás é uma aba, não o fundo do app.
- **Don't** parecer clínico (branco hospitalar, cruz, azul-saúde) nem site de governo (azul institucional, faixas de barra de governo).
- **Don't** cair no infantil: nada de arco-íris, letras arredondadas lúdicas ou personagem em toda seção.
- **Don't** pôr sombra em cartões em repouso; sombra de papel é só do recado.

## Decisões em aberto

- Os círculos lilás atrás dos personagens podem passar a usar a cor do papel da categoria; isso exige regerar as ilustrações a partir da referência do dono. Até lá, ficam como estão.
- O calendário inclusivo ainda usa seus próprios chips de tema (tintas suaves azul-céu, verde, pêssego, rosa, sálvia); ainda não migrou para o mapa de papéis.
