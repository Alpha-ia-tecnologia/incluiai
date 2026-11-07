# Imagens dos jogos

Além das sete imagens iniciais abaixo, o conjunto foi ampliado para os temas, rotinas e emoções usados em `/jogar/`. O mapa de fotografias está em `src/lib/games/game-photos.ts`. Todos os jogos, os quinze de fotografias e os quatro de tela cheia, ficam juntos em `/jogos`.

Prompts das novas fotografias: [animais, transportes e escola](game-photo-themes.md), [alimentos e rotinas](game-photo-daily.md), [natureza, situações e emoções](game-photo-nature-emotions.md).

Imagens fotorealistas criadas em 6 de novembro de 2026 com a ferramenta integrada `image_gen.imagegen` (modo de geração, sem imagens de referência). São imagens sintéticas de objetos, sem fotografias de estudantes ou dados pessoais. Não exigem uma chamada de geração durante o uso dos jogos.

Os arquivos usados pela interface ficam em `public/images/games/`, em WebP. As imagens individuais têm 640 × 640 px, fundo claro e objeto completo, para facilitar a identificação. A capa `hero.webp` tem 1400 × 788 px. O conjunto inicial de sete imagens ocupa aproximadamente 235 KB. Os prompts exatos de geração acompanham cada arquivo em um sidecar `*.webp.json`, criado por `impeccable embed-prompt`.

| Arquivo | Conteúdo | Uso sugerido |
| --- | --- | --- |
| `apple.webp` | Uma maçã vermelha | Memória, frutas, cores, contagem |
| `banana.webp` | Uma banana amarela | Memória, frutas, cores, contagem |
| `orange.webp` | Uma laranja inteira | Memória, frutas, cores, contagem |
| `ball.webp` | Uma bola azul | Vocabulário, objetos, cores |
| `backpack.webp` | Uma mochila verde | Vocabulário, rotina, autonomia |
| `book.webp` | Um livro vermelho fechado | Vocabulário, rotina, autonomia |
| `hero.webp` | Mesa com cartões de pares, bola, livro e mochila | Capa da biblioteca |

## Prompts

Base comum das imagens individuais:

> Use case: photorealistic-natural. Asset type: a single object photograph for an accessible educational matching game for children. Composition: square image, the object occupying about 65 percent of frame, entire object visible with generous clean space on all sides, isolated centered on a seamless very pale warm beige studio backdrop. Style: real studio product photograph with realistic material textures, gentle natural daylight and subtle ground shadow. Constraints: exactly one object, no other objects, no hands, no face, no decorations, no text, no logo, no watermark. Use a simple uncluttered background with good object contrast.

Pedido principal de cada objeto:

- `apple`: one whole red apple, with a short natural stem, clearly recognizable.
- `banana`: exactly one whole ripe yellow banana with natural peel, no dark patches, no bunch.
- `orange`: exactly one whole round orange fruit, with natural textured orange peel, no slices, no leaves.
- `ball`: exactly one simple solid blue rubber playground ball, spherical with realistic matte rubber texture, no printed designs.
- `backpack`: exactly one small plain green school backpack, standing upright with shoulder straps, realistic fabric, single main compartment and front pocket, no logos.
- `book`: exactly one closed plain red hardcover book, slightly angled so its white page edges and cover are visible, no writing or illustrations on the cover.

Prompt da capa:

> Use case: photorealistic-natural. Asset type: wide photographic banner for an inclusive educational game library. Primary request: realistic educational play materials on a light wooden classroom table: a small collection of square picture matching cards showing everyday fruit and school objects, a simple blue rubber ball, a red book and a plain green school backpack standing softly out of focus in the background. Style: thoughtful editorial classroom photography, warm natural side daylight, realistic paper, wood and fabric textures. Composition: landscape 16:9, tabletop seen at a gentle overhead angle, all important materials arranged toward the center-right, uncluttered warm ivory background with calm space on the left. Mood: welcoming, tactile, calm and easy to understand. Constraints: no people, no hands, no text or labels on cards, no lettering on book or backpack, no logos, no watermark, no UI, no icons, no confetti, no busy classroom decorations.

## Preparação e revisão

Os arquivos originais gerados foram mantidos no diretório de saída da ferramenta. Cópias foram redimensionadas e comprimidas com `sharp`, sem mudanças no conteúdo. As seis imagens individuais e a capa foram inspecionadas visualmente: objetos reconhecíveis, sem palavras, marcas ou detalhes distrativos. WebP com qualidade 85 para os objetos e 86 para a capa. A verificação `impeccable embed-prompt --scan public/images/games` confirma a rastreabilidade das sete imagens.
