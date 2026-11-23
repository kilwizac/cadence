import {
  Document, ExternalHyperlink, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun,
  type INumberingOptions, type IParagraphOptions, type IRunOptions, type ParagraphChild,
} from "docx";
import { DomUtils, ElementType, parseDocument } from "htmlparser2";

type ContentNode = ReturnType<typeof parseDocument>["children"][number];

const headings: Record<string, IParagraphOptions["heading"]> = {
  h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6,
};

function inline(nodes: ContentNode[], style: IRunOptions = {}): ParagraphChild[] {
  return nodes.flatMap((node): ParagraphChild[] => {
    if (node.type === ElementType.Text) return [new TextRun({ ...style, text: node.data })];
    if (node.type !== ElementType.Tag) return [];
    switch (node.name) {
      case "br": return [new TextRun({ break: 1 })];
      case "strong": case "b": return inline(node.children, { ...style, bold: true });
      case "em": case "i": return inline(node.children, { ...style, italics: true });
      case "s": case "strike": case "del": return inline(node.children, { ...style, strike: true });
      case "u": return inline(node.children, { ...style, underline: {} });
      case "code": return inline(node.children, { ...style, font: "Courier New" });
      case "a": {
        const link = node.attribs.href;
        if (!link || !/^(https?:\/\/|mailto:)/i.test(link)) return inline(node.children, style);
        return [new ExternalHyperlink({ link, children: inline(node.children, { ...style, style: "Hyperlink" }) })];
      }
      default: return inline(node.children, style);
    }
  });
}

export function sopDocx(title: string, metadata: string, html: string) {
  const paragraphs: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: "CADENCE", bold: true, color: "173E72", characterSpacing: 22 })] }),
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({ spacing: { after: 280 }, children: [new TextRun({ text: metadata, color: "4A5669" })] }),
  ];
  const numbering: INumberingOptions["config"][number][] = [];

  function blocks(nodes: ContentNode[], depth = 0, item?: string, quote = false) {
    let pending: ContentNode[] = [];
    const paragraph = (options: IParagraphOptions) => {
      paragraphs.push(new Paragraph({
        indent: item ? undefined : { left: (depth + Number(quote)) * 360 },
        numbering: item ? { reference: item, level: 0 } : undefined,
        ...options,
      }));
      item = undefined;
    };
    const flush = () => {
      if (pending.some((node) => node.type !== ElementType.Text || node.data.trim())) {
        paragraph({ children: inline(pending, { italics: quote }) });
      }
      pending = [];
    };

    for (const node of nodes) {
      if (node.type !== ElementType.Tag) {
        pending.push(node);
        continue;
      }
      const name = node.name;
      if (name === "p" || Object.hasOwn(headings, name)) {
        flush();
        paragraph({ heading: headings[name], children: inline(node.children, { italics: quote }) });
      } else if (name === "ol" || name === "ul") {
        flush();
        if (item) paragraph({});
        const reference = `list-${numbering.length}`;
        const start = Number(node.attribs.start);
        numbering.push({
          reference,
          levels: [{
            level: 0, format: name === "ol" ? LevelFormat.DECIMAL : LevelFormat.BULLET,
            text: name === "ol" ? "%1." : "•", start: Number.isSafeInteger(start) && start > 0 ? start : 1,
            style: { paragraph: { indent: { left: (depth + 1 + Number(quote)) * 360, hanging: 240 } } },
          }],
        });
        for (const child of node.children) {
          if (child.type === ElementType.Tag && child.name === "li") blocks(child.children, depth + 1, reference, quote);
        }
      } else if (name === "blockquote") {
        flush();
        if (item) paragraph({});
        blocks(node.children, depth, undefined, true);
      } else if (name === "pre") {
        flush();
        const children = DomUtils.textContent(node).split("\n").map((text, i) => new TextRun({ text, break: i ? 1 : undefined, font: "Courier New" }));
        paragraph({ children });
      } else if (name === "hr") {
        flush();
        paragraph({ thematicBreak: true });
      } else if (name === "table" || name === "thead" || name === "tbody") {
        flush();
        blocks(node.children, depth, undefined, quote);
      } else if (name === "tr") {
        flush();
        paragraph({ text: node.children.filter((cell) => cell.type === ElementType.Tag).map((cell) => DomUtils.textContent(cell)).join("  |  ") });
      } else {
        pending.push(node);
      }
    }
    flush();
    if (item) paragraph({});
  }

  blocks(parseDocument(html).children);
  return Packer.toBuffer(new Document({
    title,
    creator: "Cadence",
    numbering: { config: numbering },
    sections: [{ children: paragraphs }],
  }));
}
