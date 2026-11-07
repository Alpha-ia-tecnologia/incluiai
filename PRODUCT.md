# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Professor(a) do AEE:** faz o estudo de caso, o perfil "Como aprende", o plano de ensino, os atendimentos e os registros; usa a plataforma entre aulas e durante o atendimento, no computador ou no tablet.
- **Professor(a) da sala comum:** registra aulas, prepara e adapta atividades para a turma e para o estudante.
- **Coordenação e gestão da escola:** acompanham planos, revisões e registros, e cuidam de cadastros e acessos.
- **Secretaria de Educação:** vê a rede em números; abre a ficha de um estudante só com motivo registrado.
- **Família:** acompanha o que a escola trabalha, faz atividades em casa, conta conquistas e decide as autorizações (IA, terapeuta, carteirinha), quase sempre pelo celular.
- **Terapeuta (rede de saúde):** vê o perfil funcional e envia orientações para a escola, com a autorização da família.

## Product Purpose

IncluiEdu é a plataforma municipal de educação inclusiva: organiza o acompanhamento pedagógico de cada estudante da educação especial, do estudo de caso ao plano, às atividades, aos registros de aula, à evolução e à devolutiva para a família. Sucesso é a equipe saber, em poucos toques, o que fazer na próxima aula e o que está funcionando, e a família acompanhar e participar.

## Positioning

Pedagógica, não clínica: o AEE não depende de laudo e nenhuma etapa pede diagnóstico. A IA propõe e a equipe decide, sempre com revisão humana. Os dados seguem a LGPD por desenho: o que vai para a IA sai sem nomes, a família decide as autorizações e vê quem acessou os dados.

## Operating Context

- Escolas públicas municipais; uso na sala do AEE, na sala comum e entre aulas, em computador, tablet e celular.
- Normas que a plataforma documenta: Nota Técnica MEC/SECADI/DPEE nº 04/2014, Decreto nº 12.686/2025, Portaria MEC nº 421/2026 e o Censo Escolar (Educacenso).
- Produção em PostgreSQL (EasyPanel); desenvolvimento em SQLite com contas de demonstração (`demo123`).

## Capabilities and Constraints

- Estudo de caso, laudos opcionais (só AEE e coordenação), "Como aprende", sondagem, plano de ensino, atividades e adaptações, planejamento com DUA, materiais de apoio, registros de aula, atendimentos do AEE, evolução, relatórios do período, dossiê de evidências, censo, carteirinha digital, assistente.
- Necessidade de saber: cada perfil vê só o que precisa; dados clínicos só com o AEE e a coordenação.
- Tudo o que a IA sugere nasce como proposta para a decisão da equipe.

## Evidence on Hand

Só dados de demonstração (seed) e documentação no repositório (`README.md`, `docs/`). Não há depoimentos, clientes, números de uso nem resultados reais: nada disso deve ser inventado.

## Product Principles

1. Pedagógico, não clínico: barreiras e apoios, nunca diagnóstico.
2. A IA propõe, a equipe decide.
3. Dados mínimos e transparência: a família decide e vê quem acessou.
4. Menos texto: cada tela diz uma vez o que precisa e mostra o resto com elementos visuais (`docs/visual.md`).
5. Feita para quem tem pouco tempo: o próximo passo sempre à vista.

## Accessibility & Inclusion

WCAG 2.2 AA (axe sem violações), nenhuma rolagem lateral a 320 px, alvos de 44 px, leitura em voz alta, tamanho do texto ajustável e VLibras em todas as telas. Estudantes com deficiência, TEA ou altas habilidades usam algumas telas diretamente (com o professor ao lado): instrução falada, alvos grandes, sem tempo limite e sem estímulo piscando.
