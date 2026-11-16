export type PrintableCard = {
  label: string;
  image?: string;
  alt?: string;
  quantity?: number;
  shape?: "circle" | "square" | "triangle" | "rectangle";
  tone?: "blue" | "red" | "yellow" | "green";
  blank?: string;
};

type SheetBase = { title: string; instruction: string };

export type PrintableSheet = SheetBase & (
  // choices: alternativas de uma pergunta. Ficam na folha inteira, numeradas e
  // com borda contínua (o tracejado é só para cartões de recortar).
  | { kind: "cards"; cards: PrintableCard[]; columns?: 2 | 3 | 4; choices?: boolean }
  | { kind: "worksheet"; fields: { label: string; lines?: 1 | 2 | 3 }[] }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "text"; paragraphs: string[] }
  | { kind: "map"; places: [string, string, string]; route: string[] }
);

export type ActivityPrintPack = {
  resourceTitle: string;
  activityTitle: string;
  sheets: PrintableSheet[];
};
