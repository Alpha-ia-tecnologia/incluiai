# Imagens do banco de atividades

As 12 capas em `public/images/activities/` foram geradas com a ferramenta integrada `image_gen`, em 6 de novembro de 2026, para o banco de atividades da plataforma. São imagens fotorrealistas de materiais pedagógicos preparados sobre uma mesa. Não são registros de estudantes, de atendimentos ou de aplicação das propostas.

Cada arquivo usa WebP opaco, 1000 × 750 pixels (proporção 4:3), qualidade 84, convertido com `sharp`. As imagens são locais: a interface não depende de fornecedores externos para exibi-las.

| Arquivo | Conteúdo da capa | Prompt exato |
| --- | --- | --- |
| `communication.webp` | Prancha com fotografias de água, ajuda e pausa; copo e envelope. | [communication.webp.prompt.txt](../public/images/activities/communication.webp.prompt.txt) |
| `routine.webp` | Mochila, caderno, estojo e sequência visual da chegada. | [routine.webp.prompt.txt](../public/images/activities/routine.webp.prompt.txt) |
| `literacy.webp` | Letras móveis formando BOLA, bola real e livro ilustrado. | [literacy.webp.prompt.txt](../public/images/activities/literacy.webp.prompt.txt) |
| `counting.webp` | Cartões de 1 a 5 com as quantidades correspondentes de contadores. | [counting.webp.prompt.txt](../public/images/activities/counting.webp.prompt.txt) |
| `patterns.webp` | Sequência alternada de círculos vermelhos e quadrados azuis. | [patterns.webp.prompt.txt](../public/images/activities/patterns.webp.prompt.txt) |
| `nature.webp` | Folhas, sementes, pedras, lupa e folha de registro. | [nature.webp.prompt.txt](../public/images/activities/nature.webp.prompt.txt) |
| `art.webp` | Colagem com formas grandes, tesoura de ponta arredondada e cola. | [art.webp.prompt.txt](../public/images/activities/art.webp.prompt.txt) |
| `tactile.webp` | Bandeja com feltro, tecido, madeira e papelão ondulado. | [tactile.webp.prompt.txt](../public/images/activities/tactile.webp.prompt.txt) |
| `access.webp` | Notebook com escolhas fotográficas e acionador grande conectado. | [access.webp.prompt.txt](../public/images/activities/access.webp.prompt.txt) |
| `stories.webp` | Livro e cartões com a sequência de plantar, regar e observar o crescimento. | [stories.webp.prompt.txt](../public/images/activities/stories.webp.prompt.txt) |
| `daily-life.webp` | Lista fotográfica, alimentos, sacola e materiais para simular compras. | [daily-life.webp.prompt.txt](../public/images/activities/daily-life.webp.prompt.txt) |
| `collaboration.webp` | Dois pares de mãos adultas compartilhando uma construção com blocos. | [collaboration.webp.prompt.txt](../public/images/activities/collaboration.webp.prompt.txt) |

## Uso na plataforma

As capas apresentam exemplos de organização dos materiais. O preparo, a condução, os apoios e o registro de observações de cada proposta estão na página da atividade. Uma capa pode atender a mais de uma proposta com materiais semelhantes; ela não representa uma folha de atividade disponível para download.

Os textos alternativos e a associação entre recursos e capas ficam em `src/lib/resource-bank.ts`. Ao criar novas propostas, prefira a imagem cujo material esteja mais próximo da experiência descrita e mantenha o texto alternativo concreto.

## Cartões e fichas para impressão

As 72 propostas possuem materiais próprios em `src/lib/resource-print-catalog-a.ts` e `src/lib/resource-print-catalog-b.ts`: cartões recortáveis, sequências, letras, quantidades, mapas, textos e fichas de registro. As fotografias unitárias dos jogos são reutilizadas nos cartões; as capas continuam sendo apenas a apresentação do recurso.

Na página de cada recurso, **Imprimir atividade completa** reúne as orientações e os materiais da proposta escolhida. **Imprimir só o material** inclui apenas suas folhas, em A4 com margens de 12 mm e bordas tracejadas para recortar. O botão do cabeçalho imprime o conjunto. A impressão aguarda o carregamento das fotografias, inclusive das folhas abaixo da área visível.

Sete fotos adicionais foram geradas com o `image_gen` integrado para esses cartões. Os WebP opacos de 640 × 640 pixels ficam em `public/images/activities/cards/`, junto aos prompts exatos:

| Arquivo | Conteúdo | Prompt |
| --- | --- | --- |
| `agua.webp` | Copo com água | [agua.webp.prompt.txt](../public/images/activities/cards/agua.webp.prompt.txt) |
| `copo.webp` | Copo vazio | [copo.webp.prompt.txt](../public/images/activities/cards/copo.webp.prompt.txt) |
| `prato.webp` | Prato vazio | [prato.webp.prompt.txt](../public/images/activities/cards/prato.webp.prompt.txt) |
| `guardanapo.webp` | Guardanapo dobrado | [guardanapo.webp.prompt.txt](../public/images/activities/cards/guardanapo.webp.prompt.txt) |
| `plantar.webp` | Colocar uma semente na terra | [plantar.webp.prompt.txt](../public/images/activities/cards/plantar.webp.prompt.txt) |
| `regar.webp` | Regar um vaso | [regar.webp.prompt.txt](../public/images/activities/cards/regar.webp.prompt.txt) |
| `brotar.webp` | Broto com duas folhas | [brotar.webp.prompt.txt](../public/images/activities/cards/brotar.webp.prompt.txt) |

As cenas de plantio são exemplos ilustrativos, não registros datados do crescimento de uma planta real. Fotos de professores, nomes, percursos da escola e observações reais permanecem em molduras ou campos identificados para personalização. Valores de compras são marcados como fictícios. Formas, pontos e mapas são gráficos vetoriais para manter a nitidez na impressão.

## Verificação

- Os 12 arquivos foram abertos e inspecionados visualmente em uma folha de contato.
- A palavra BOLA e a relação entre os numerais de 1 a 5 e as quantidades foram conferidas.
- As capas mantêm a mesma proporção e não contêm marcas, dados pessoais ou rostos reais.
- Os prompts enviados à ferramenta foram preservados integralmente nos arquivos `.webp.prompt.txt` ao lado de cada imagem.

Para uma nova geração, use o prompt correspondente como ponto de partida, gere uma imagem por arquivo e inspecione a saída antes de substituir a capa. Preserve os originais gerados fora do diretório público; a aplicação usa somente as versões WebP otimizadas.
