import { PRINT_CATALOG_A } from "./resource-print-catalog-a.ts";
import { PRINT_CATALOG_B } from "./resource-print-catalog-b.ts";
import type { PrintableSheet } from "./resource-print-types";

export const RESOURCE_PRINT_CATALOG = [...PRINT_CATALOG_A, ...PRINT_CATALOG_B];

export function activityPrintMaterials(resourceTitle: string, activityTitle: string): PrintableSheet[] {
  const pack = RESOURCE_PRINT_CATALOG.find((entry) => entry.resourceTitle === resourceTitle && entry.activityTitle === activityTitle);
  return pack?.sheets ?? [{
    kind: "worksheet",
    title: activityTitle,
    instruction: "Complete o modelo com os materiais e as escolhas desta proposta.",
    fields: [{ label: "Materiais e imagens que vamos usar", lines: 3 }, { label: "O que vamos fazer", lines: 3 }, { label: "O que observamos", lines: 3 }],
  }];
}
