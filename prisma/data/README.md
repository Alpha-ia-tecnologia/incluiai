# Dados de referência

## `bncc.json`: Base Nacional Comum Curricular

1.580 códigos da BNCC, com componente, anos e texto oficial:

| Etapa | Itens |
| --- | --- |
| Educação infantil (objetivos de aprendizagem) | 93 |
| Ensino fundamental (habilidades) | 1.304 |
| Ensino médio (habilidades) | 183 |

- **Texto:** o do PDF homologado pelo MEC, conferido código a código: https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf
- **Estrutura dos dados:** projeto bncc-dados (https://github.com/bncc-dev/bncc-dados), commit `9c268978efa2aa250834c6a9edb6074432752838`, licença CC BY 4.0. A plataforma dá o crédito no README.
- **Ajustes:** `bncc-correcoes-pdf.json` registra os 29 ajustes de pontuação e espaço feitos para o texto ficar igual ao do PDF (de, para e motivo).
- **Uso:** `src/lib/bncc.ts` carrega a base no servidor, e `src/lib/bncc-core.ts` reúne as regras de busca e sugestão, com testes.
