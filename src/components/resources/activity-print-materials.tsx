import Image from "next/image";
import type { PrintableCard, PrintableSheet } from "@/lib/resource-print-types";
import { ResourcePrintButton } from "./resource-print-button";
import styles from "./resource-print.module.css";

function CardVisual({ card }: { card: PrintableCard }) {
  if (card.image) return <Image src={card.image} alt={card.alt ?? card.label} width={640} height={640} loading="eager" unoptimized className={styles.photo} data-resource-card-image />;
  if (card.quantity !== undefined) return <div className={styles.quantity} role="img" aria-label={`${card.quantity} ${card.quantity === 1 ? "ponto" : "pontos"}`}>
    {card.quantity === 0 ? <span className={styles.zero}>0</span> : Array.from({ length: card.quantity }, (_, index) => <span key={index} className={styles.dot} />)}
  </div>;
  if (card.shape) return <svg className={styles.shape} viewBox="0 0 100 100" aria-hidden="true" data-tone={card.tone ?? "blue"}>
    {card.shape === "circle" ? <circle cx="50" cy="50" r="37" /> : card.shape === "triangle" ? <path d="M50 10 94 88H6Z" /> : <rect x="12" y={card.shape === "rectangle" ? 27 : 12} width="76" height={card.shape === "rectangle" ? 46 : 76} rx="2" />}
  </svg>;
  if (card.blank) return <div className={styles.personalize}>{card.blank}</div>;
  return null;
}

function SheetContent({ sheet }: { sheet: PrintableSheet }) {
  if (sheet.kind === "cards") return <ul className={styles.cards} style={{ "--card-columns": sheet.columns ?? 3 } as React.CSSProperties}>
    {sheet.cards.map((card, index) => <li key={`${card.label}-${index}`} className={styles.cutCard} data-print-card>
      <CardVisual card={card} /><span className={styles.cardLabel}>{card.label}</span>
    </li>)}
  </ul>;

  if (sheet.kind === "worksheet") return <div className={styles.fields}>
    {sheet.fields.map((field, index) => <div key={`${field.label}-${index}`} className={styles.field}>
      <p>{field.label}</p><div aria-label="Espaço para responder ou desenhar" className={styles.answerSpace}>
        {Array.from({ length: field.lines ?? 2 }, (_, line) => <span key={line} className={styles.answerLine} />)}
      </div>
    </div>)}
  </div>;

  if (sheet.kind === "table") return <table className={styles.table}>
    <caption className="sr-only">{sheet.title}</caption>
    <thead><tr>{sheet.columns.map((column, index) => <th key={`${column}-${index}`} scope="col">{column}</th>)}</tr></thead>
    <tbody>{sheet.rows.map((row, index) => <tr key={index}>{sheet.columns.map((_, column) => <td key={column}>{row[column] || <span className="sr-only">Espaço para preencher</span>}</td>)}</tr>)}</tbody>
  </table>;

  if (sheet.kind === "text") return <div className={styles.reading}>{sheet.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;

  return <figure className={styles.map}>
    <svg viewBox="0 0 600 250" role="img" aria-label={`Mapa fictício: ${sheet.places.join(", ")}, ligados por um corredor.`}>
      <path d="M100 125v60h400v-60M300 125v60" fill="none" stroke="currentColor" strokeWidth="5" />
      {sheet.places.map((place, index) => <g key={`${place}-${index}`}>
        <rect x={20 + index * 200} y="20" width="160" height="105" rx="3" fill="white" stroke="currentColor" strokeWidth="3" />
        <text x={100 + index * 200} y="78" textAnchor="middle" fontSize="18" fill="currentColor">{place}</text>
      </g>)}
      <text x="300" y="220" textAnchor="middle" fontSize="18" fill="currentColor">Corredor</text>
    </svg>
    <figcaption><strong>Percurso do exemplo</strong><ol>{sheet.route.map((step, index) => <li key={index}>{step}</li>)}</ol></figcaption>
  </figure>;
}

export function ActivityPrintMaterials({ activityId, activityTitle, resourceTitle, sheets }: {
  activityId: string;
  activityTitle: string;
  resourceTitle: string;
  sheets: PrintableSheet[];
}) {
  return <section className={styles.materials} aria-labelledby={`material-${activityId}`} data-resource-materials>
    <div className={styles.materialsHeading} data-resource-screen>
      <div><h3 id={`material-${activityId}`}>Material para imprimir e usar</h3><p>Os cartões e as fichas abaixo acompanham esta atividade. As bordas tracejadas orientam o recorte.</p></div>
      <ResourcePrintButton activityId={activityId} materialsOnly label="Imprimir só o material" />
    </div>
    {sheets.map((sheet, index) => <section key={`${sheet.title}-${index}`} className={styles.sheet} aria-label={sheet.title} data-resource-sheet>
      <header className={styles.sheetHeader}>
        <p className={styles.printContext}>{resourceTitle} · {activityTitle}</p>
        <h4>{sheet.title}</h4><p>{sheet.instruction}</p>
      </header>
      <SheetContent sheet={sheet} />
    </section>)}
  </section>;
}
