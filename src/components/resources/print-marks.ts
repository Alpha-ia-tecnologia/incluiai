const ATTRIBUTE = {
  root: "data-resource-print-root",
  mode: "data-resource-print-mode",
  busy: "data-resource-print-busy",
  screen: "data-resource-screen",
  introduction: "data-resource-introduction",
  instructions: "data-resource-instructions",
  activity: "data-resource-activity",
  selected: "data-print-selected",
  cardImage: "data-resource-card-image",
  plan: "data-resource-plan",
  sheet: "data-resource-sheet",
  documentHeader: "data-print-document-header",
} as const;

export type PrintMark = keyof typeof ATTRIBUTE;
export const PRINT_ATTRIBUTE = ATTRIBUTE;
export const printMark = <M extends PrintMark>(mark: M, value = "") => ({ [ATTRIBUTE[mark]]: value }) as Record<(typeof ATTRIBUTE)[M], string>;
export const printSelector = (mark: PrintMark, value?: string) => `[${ATTRIBUTE[mark]}${value === undefined ? "" : `="${value}"`}]`;
