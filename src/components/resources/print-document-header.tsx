import styles from "./resource-print.module.css";

export function PrintDocumentHeader({ network, kind }: { network: string | null; kind: string }) {
  return <div className={styles.docHeader} data-print-document-header>
    <div className={styles.docHeaderTop}>
      {network
        ? <p className={styles.docNetwork}>{network}</p>
        : <p className={styles.docField}><span>Rede de ensino:</span><span className={styles.docBlank} /></p>}
      <p className={styles.docKind}>{kind}</p>
    </div>
    <div className={styles.docFields}>
      <p className={styles.docField} data-size="wide"><span>Escola:</span><span className={styles.docBlank} /></p>
      <p className={styles.docField}><span>Turma:</span><span className={styles.docBlank} /></p>
      <p className={styles.docField}><span>Data:</span><span className={styles.docDate}>____/____/______</span></p>
      <p className={styles.docField} data-size="wide"><span>Estudante:</span><span className={styles.docBlank} /></p>
      <p className={styles.docField} data-size="wide"><span>Professor(a):</span><span className={styles.docBlank} /></p>
    </div>
  </div>;
}
