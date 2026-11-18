import type { PrintableSheet } from "@/lib/resource-print-types";
import { PrintDocumentHeader } from "./print-document-header";
import styles from "./resource-print.module.css";
import { printMark } from "./print-marks";

const lines = (count: number) => Array.from({ length: count }, (_, index) => <span key={index} className={styles.answerLine} />);

export function ActivityPrintPlan({ network, resourceTitle, resourceType, activityTitle, context, durationMinutes, objective, materials, adaptations, steps, evidenceCriterion, sheets }: {
  network: string | null;
  resourceTitle: string;
  resourceType: string;
  activityTitle: string;
  context: string;
  durationMinutes: number;
  objective: string;
  materials: string[];
  adaptations: string[];
  steps: string[];
  evidenceCriterion: string;
  sheets: PrintableSheet[];
}) {
  const questions = sheets.filter((sheet) => sheet.kind === "cards" && sheet.choices);
  const roomy = questions.length === 0;
  return <>
    <section className={`${styles.plan} ${styles.printOnly}`} {...printMark("plan")}>
      <PrintDocumentHeader network={network} kind="Plano de atividade" />
      <h2 className={styles.docTitle}>{activityTitle}</h2>
      <dl className={styles.docMeta}>
        <div><dt>Recurso:</dt><dd>{resourceTitle}</dd></div>
        <div><dt>Tipo:</dt><dd>{resourceType}</dd></div>
        <div><dt>Contexto:</dt><dd>{context}</dd></div>
        <div><dt>Duração:</dt><dd>{durationMinutes} minutos</dd></div>
      </dl>
      <div className={styles.planBlock}><h3>Objetivo</h3><p>{objective}</p></div>
      <div className={styles.planColumns}>
        {materials.length ? <div className={styles.planBlock}><h3>Materiais</h3><ul>{materials.map((material) => <li key={material}>{material}</li>)}</ul></div> : null}
        {adaptations.length ? <div className={styles.planBlock}><h3>Adaptações de acesso</h3><ul>{adaptations.map((adaptation) => <li key={adaptation}>{adaptation}</li>)}</ul></div> : null}
      </div>
      {steps.length ? <div className={styles.planBlock}><h3>Como aplicar</h3><ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol></div> : null}
      <div className={styles.planBlock}><h3>Evidência a observar</h3><p>{evidenceCriterion}</p></div>
    </section>

    <section className={`${styles.plan} ${styles.recordPage} ${styles.printOnly}`} {...printMark("plan")}>
      <PrintDocumentHeader network={network} kind="Registro da aplicação" />
      <h2 className={styles.docTitle}>Registro da aplicação</h2>
      <dl className={styles.docMeta}>
        <div><dt>Atividade:</dt><dd>{activityTitle}</dd></div>
        <div><dt>Recurso:</dt><dd>{resourceTitle}</dd></div>
      </dl>
      <div className={styles.planBlock}><h3>Evidência a observar</h3><p>{evidenceCriterion}</p></div>
      {questions.length ? <div className={styles.planBlock}>
        <h3>Respostas</h3>
        <table className={styles.table}>
          <thead><tr><th scope="col">Pergunta</th><th scope="col">Alternativa escolhida</th><th scope="col">Apoio oferecido</th></tr></thead>
          <tbody>{questions.map((sheet, index) => <tr key={`${sheet.title}-${index}`}><td>{sheet.title}</td><td /><td /></tr>)}</tbody>
        </table>
      </div> : null}
      <div className={styles.planBlock}><h3>Apoios oferecidos</h3>{lines(roomy ? 4 : 2)}</div>
      <div className={styles.planBlock}><h3>O que foi observado</h3>{lines(roomy ? 8 : 4)}</div>
      <div className={styles.planBlock}><h3>Próximos passos</h3>{lines(roomy ? 4 : 2)}</div>
    </section>
  </>;
}
