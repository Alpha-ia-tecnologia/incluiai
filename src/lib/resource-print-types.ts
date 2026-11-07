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
  | { kind: "cards"; cards: PrintableCard[]; columns?: 2 | 3 | 4 }
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
