---
version: 1
slug: "src-app-app-page-tsx"
primary_target: "src/app/(app)/page.tsx"
related_targets: ["src/app/globals.css","src/components/journey-ui.tsx","src/components/shell.tsx"]
---

# Início — mundo visual "Mural da sala dos professores"

Modo: Operate. Primeira superfície do novo mundo visual do app inteiro; as demais telas herdam pelos tokens e componentes base.
Público: professora da escola pública municipal entre aulas (computador da sala dos professores ou celular); a Secretaria vê a mesma tela ao avaliar a adoção.
Tarefa: saber o próximo passo com um estudante e executá-lo com um toque.
Fica como está: nome, personagens, fluxos (estudo de caso por partes, cartão Hoje por perfil, confirmações e Desfazer), terminologia e regras de acesso.
Evitar: visual clínico; cara de site do governo; cortiça como textura; notas tortas; tachinhas espalhadas; visual infantil.
Mapa de papéis: azul = registrar; verde = preparar; rosa = conhecer e ouvir; lilás = planejar; amarelo-ofício só no recado de hoje.
Em aberto: círculo lilás dos personagens pode ganhar a cor do papel depois (regerar a partir da referência do dono).

## Direction contract

THESIS: O Início é o mural da equipe: o recado de hoje fixado no topo e um cartão por estudante. Recusa o SaaS pastel com lilás e personagem (o visual anterior) e o azul institucional de sistema do governo.

OWN-WORLD: Barra lateral em cortiça como cor plana; superfícies brancas como papel; papéis coloridos (azul, verde, rosa, lilás) só em abas de categoria; amarelo-ofício só no recado de hoje; tinta preta quente em texto e botões; vermelho-tachinha reservado ao agora e ao que está fixado, nunca cor de categoria nem de texto; dados em azul-caneta. Archivo condensado nos títulos e números, Atkinson Hyperlegible no texto. Cantos de papel (pequenos), borda fina, sem sombras decorativas.

STORY: A professora entende em segundos o que fazer hoje e com quem, acredita que o sistema sabe onde ela parou (os vistos vêm dos registros reais) e age: registra, prepara ou fixa um estudante no topo do seu mural.

FIRST VIEWPORT: Barra de cortiça à esquerda com a navegação; ao centro, o título "O que vamos fazer hoje, Marcos?" e logo abaixo o recado de hoje em papel amarelo com tachinha vermelha no topo, título do passo, texto, botão preto principal, link da história e a fileira de marcas dos capítulos (visto, agora, aberto, aguardando), personagem recortado à direita; abaixo, outras tarefas com aba de cor e os cartões de estudante com aba de categoria, marcas e o botão de fixar; à direita, avisos fixados (resumo, próximos passos da equipe, datas, ideias). A ação principal é o botão preto do recado.

FORM: Mural da sala dos professores, posição 6 na lista ordenada, sorteado e escolhido pelo dono. seed:244b959c889cb90f
Gesto próprio: fixar no mural — o recado de hoje fixado com tachinha; o que a professora fixa sobe ao topo com tachinha; capítulos marcados com o visto carimbado. Movimento único: a tachinha assenta o recado ao carregar, desligada com movimento reduzido.
Disciplinas herdadas: aba de categoria e borda fina em todo cartão (portal japonês); colunas fixas na lista de estudantes (painel de partidas); situações como marcas, não selos (edição de referência); uma cor só para o agora (mapa de orientação); o que a professora fixa fica marcado por ela (catálogo de evento).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
