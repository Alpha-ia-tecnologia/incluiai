import "server-only";
import { Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } from "docx";
import { ANSWER_FORMAT_LABEL, highlightParts, printPages, type AdaptedContent } from "./task-adaptation";

// Word (.docx) da atividade adaptada, para o professor ajustar no editor de
// texto da escola. Sem o apoio do professor (só o que vai para o estudante).

export async function adaptedDocx(content: AdaptedContent, settings: { largeText: boolean; itemsPerPage: number | null; highlight: boolean; icons: boolean }): Promise<Buffer> {
  const size = settings.largeText ? 36 : 28; // meios-pontos: 18 pt ou 14 pt
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: content.title, size: size + 12, bold: true })] }),
    ...content.instructions.map((line) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: line, size })] })),
  ];
  printPages(content.items, settings.itemsPerPage).forEach((page, pageIndex) => {
    if (pageIndex > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    for (const item of page) {
      const lines = item.prompt.split("\n");
      lines.forEach((line, lineIndex) => {
        const runs = (settings.highlight ? highlightParts(line) : [{ text: line, command: false }]).map((part) => new TextRun({ text: part.text, size, bold: part.command, underline: part.command ? {} : undefined }));
        children.push(new Paragraph({ spacing: { before: lineIndex === 0 ? 360 : 0, after: 80 }, children: [...(lineIndex === 0 ? [new TextRun({ text: `${item.number}. `, size, bold: true })] : []), ...runs] }));
      });
      if (settings.icons) children.push(new Paragraph({ children: [new TextRun({ text: `Como responder: ${ANSWER_FORMAT_LABEL[item.answerFormat]}`, size: size - 4, italics: true })] }));
      for (const option of item.options) children.push(new Paragraph({ indent: { left: 360 }, spacing: { after: 80 }, children: [new TextRun({ text: `☐  ${option}`, size })] }));
      if (!item.options.length && (item.answerFormat === "escrever" || item.answerFormat === "completar")) {
        for (let line = 0; line < 2; line++) children.push(new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "_".repeat(48), size })] }));
      }
      if (item.answerFormat === "desenhar") for (let line = 0; line < 6; line++) children.push(new Paragraph({ children: [new TextRun({ text: " ", size })] }));
    }
  });
  const document = new Document({ creator: "IncluiEdu", title: content.title, sections: [{ children }] });
  return Packer.toBuffer(document);
}
