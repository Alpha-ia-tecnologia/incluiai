# Personagens IncluiEdu

Ilustrações adaptadas da referência fornecida pelo usuário com a ferramenta integrada `image_gen` (sem CLI). Paleta lilás, linhas pretas e fundo transparente. A referência contém cinco personagens distintos; o personagem com a lista se repete na imagem original.

## Arquivos e uso

- `public/illustrations/characters/planning.png`: Pessoa segurando uma lista de acompanhamento; planejamento de turmas.
- `public/illustrations/characters/care.png`: Pessoa acolhendo um coração; área editorial do login.
- `public/illustrations/characters/learning.png`: Pessoa com um lápis; boas-vindas no painel.
- `public/illustrations/characters/ideas.png`: Pessoa com uma lâmpada; banco de recursos.
- `public/illustrations/characters/resources.png`: Pessoa segurando uma janela de conteúdo; atalho para recursos e estados vazios.

Renderização em `src/components/character.tsx` com `next/image`, carregamento adaptado ao tamanho, espaço reservado para evitar mudanças de layout e texto alternativo vazio por serem imagens decorativas. As imagens não entram na versão impressa.

## Prompts utilizados

### planning

```text
Use case: background-extraction and palette adaptation.
Asset type: a single transparent PNG illustration for an inclusive-education web app.
Input image 1: the user's supplied sheet is the edit target. Isolate ONLY the specified existing character from the sheet, accurately preserving its black line drawing, face, hair, pose, proportions and prop. Preserve the existing circular backdrop behind that character, but recolor its original saturated accent to soft lilac and lavender (#d6bde9, #b798d4, #7952a3). Keep the solid black hair and thin crisp black outlines; keep the white areas of paper/props white. Maintain the original warm friendly flat editorial illustration style.
Composition: square canvas, one centered complete bust character and its circle, artwork occupies 85% of the square, generous clean transparent margin, all arms, hair, and props fully in frame.
Background: actual transparent alpha outside the person and its circular backdrop, no white rectangle, no checkerboard drawing.
Constraints: no extra people, no lettering, no captions, no logo, no watermark, no mockup, no realistic rendering, no shadows, no gradients. Do not include any of the other characters from the sheet.
Selected character: The TOP LEFT man with black hair and a checklist held in front of his chest, originally turquoise. Keep his visible checked boxes and both hands holding the checklist.
```

### care

```text
Use case: background-extraction and palette adaptation.
Asset type: a single transparent PNG illustration for an inclusive-education web app.
Input image 1: the user's supplied sheet is the edit target. Isolate ONLY the specified existing character from the sheet, accurately preserving its black line drawing, face, hair, pose, proportions and prop. Preserve the existing circular backdrop behind that character, but recolor its original saturated accent to soft lilac and lavender (#d6bde9, #b798d4, #7952a3). Keep the solid black hair and thin crisp black outlines; keep the white areas of paper/props white. Maintain the original warm friendly flat editorial illustration style.
Composition: square canvas, one centered complete bust character and its circle, artwork occupies 85% of the square, generous clean transparent margin, all arms, hair, and props fully in frame.
Background: actual transparent alpha outside the person and its circular backdrop, no white rectangle, no checkerboard drawing.
Constraints: no extra people, no lettering, no captions, no logo, no watermark, no mockup, no realistic rendering, no shadows, no gradients. Do not include any of the other characters from the sheet.
Selected character: The TOP CENTER woman with a black ponytail, holding a large white heart close to her chest, originally pink. Preserve her original face and thoughtful caring gesture.
```

### learning

```text
Use case: background-extraction and palette adaptation.
Asset type: a single transparent PNG illustration for an inclusive-education web app.
Input image 1: the user's supplied sheet is the edit target. Isolate ONLY the specified existing character from the sheet, accurately preserving its black line drawing, face, hair, pose, proportions and prop. Preserve the existing circular backdrop behind that character, but recolor its original saturated accent to soft lilac and lavender (#d6bde9, #b798d4, #7952a3). Keep the solid black hair and thin crisp black outlines; keep the white areas of paper/props white. Maintain the original warm friendly flat editorial illustration style.
Composition: square canvas, one centered complete bust character and its circle, artwork occupies 85% of the square, generous clean transparent margin, all arms, hair, and props fully in frame.
Background: actual transparent alpha outside the person and its circular backdrop, no white rectangle, no checkerboard drawing.
Constraints: no extra people, no lettering, no captions, no logo, no watermark, no mockup, no realistic rendering, no shadows, no gradients. Do not include any of the other characters from the sheet.
Selected character: The TOP RIGHT curly-haired man embracing a giant white pencil, originally orange. Preserve the oversized pencil and friendly pose.
```

### ideas

```text
Use case: background-extraction and palette adaptation.
Asset type: a single transparent PNG illustration for an inclusive-education web app.
Input image 1: the user's supplied sheet is the edit target. Isolate ONLY the specified existing character from the sheet, accurately preserving its black line drawing, face, hair, pose, proportions and prop. Preserve the existing circular backdrop behind that character, but recolor its original saturated accent to soft lilac and lavender (#d6bde9, #b798d4, #7952a3). Keep the solid black hair and thin crisp black outlines; keep the white areas of paper/props white. Maintain the original warm friendly flat editorial illustration style.
Composition: square canvas, one centered complete bust character and its circle, artwork occupies 85% of the square, generous clean transparent margin, all arms, hair, and props fully in frame.
Background: actual transparent alpha outside the person and its circular backdrop, no white rectangle, no checkerboard drawing.
Constraints: no extra people, no lettering, no captions, no logo, no watermark, no mockup, no realistic rendering, no shadows, no gradients. Do not include any of the other characters from the sheet.
Selected character: The BOTTOM LEFT curly-haired woman with a large white lightbulb and one index finger raised, originally yellow. Preserve the bulb and raised finger.
```

### resources

```text
Use case: background-extraction and palette adaptation.
Asset type: a single transparent PNG illustration for an inclusive-education web app.
Input image 1: the user's supplied sheet is the edit target. Isolate ONLY the specified existing character from the sheet, accurately preserving its black line drawing, face, hair, pose, proportions and prop. Preserve the existing circular backdrop behind that character, but recolor its original saturated accent to soft lilac and lavender (#d6bde9, #b798d4, #7952a3). Keep the solid black hair and thin crisp black outlines; keep the white areas of paper/props white. Maintain the original warm friendly flat editorial illustration style.
Composition: square canvas, one centered complete bust character and its circle, artwork occupies 85% of the square, generous clean transparent margin, all arms, hair, and props fully in frame.
Background: actual transparent alpha outside the person and its circular backdrop, no white rectangle, no checkerboard drawing.
Constraints: no extra people, no lettering, no captions, no logo, no watermark, no mockup, no realistic rendering, no shadows, no gradients. Do not include any of the other characters from the sheet.
Selected character: The BOTTOM CENTER woman with her hair in a bun holding a simplified browser window, originally mint green. Preserve the browser window prop and original body pose.
```
