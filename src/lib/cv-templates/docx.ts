/**
 * Server-side DOCX renderer (`docx`). Hebrew exports set `bidirectional` on every paragraph and
 * split text into script runs: Hebrew runs `rightToLeft`, Latin runs (emails, URLs, tech terms,
 * dates) LTR, so Word lays out mixed lines correctly. The OFL font is embedded in the file.
 */
import { readFileSync } from "node:fs";
import {
  AlignmentType,
  BorderStyle,
  CharacterSet,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";
import { CV_LABELS, type CvLang } from "@/lib/i18n/cv-templates";
import { paraDir, period, segments, shortUrl } from "./bidi";
import type { CvContent, CvEntry } from "./content";
import { DOCX_FONT, FONT_FILES, fontPath } from "./fonts";
import { levelLabel, resolveBlocks, tint, type Block } from "./resolve";
import type { LayoutEntry } from "./sections";
import type { CvTemplate } from "./templates";

interface Ctx {
  rtl: boolean;
  lang: CvLang;
  tpl: CvTemplate;
  font: string;
}
interface RunStyle {
  bold?: boolean;
  color?: string;
  size?: number; // pt
  allCaps?: boolean;
  characterSpacing?: number;
}

const hex = (c: string) => c.replace("#", "");
const halfPt = (pt: number) => Math.round(pt * 2);
// A4 with 0.5in (720 twips) margins.
const PAGE_W = 11906;
const MARGIN = 720;
const BODY_W = PAGE_W - MARGIN * 2;

/** Runs for one string, split by script so Word gets correct bidi. */
function runs(ctx: Ctx, text: string, style: RunStyle = {}, paraRtl = ctx.rtl): TextRun[] {
  return segments(text, paraRtl).map(
    (s) =>
      new TextRun({
        text: s.text,
        rightToLeft: s.rtl,
        bold: style.bold,
        boldComplexScript: style.bold,
        color: style.color ? hex(style.color) : undefined,
        size: halfPt(style.size ?? ctx.tpl.size),
        sizeComplexScript: halfPt(style.size ?? ctx.tpl.size),
        allCaps: style.allCaps,
        characterSpacing: style.characterSpacing,
        font: { ascii: ctx.font, hAnsi: ctx.font, cs: ctx.font, eastAsia: ctx.font },
      }),
  );
}

function para(
  ctx: Ctx,
  children: ParagraphChild[],
  opts: Partial<IParagraphOptions> = {},
  dir?: "rtl" | "ltr",
): Paragraph {
  const rtl = (dir ?? (ctx.rtl ? "rtl" : "ltr")) === "rtl";
  return new Paragraph({
    bidirectional: rtl,
    // With bidirectional on, START is the right edge — the CV language decides alignment.
    alignment:
      opts.alignment ?? (ctx.rtl === rtl ? AlignmentType.START : ctx.rtl ? AlignmentType.END : AlignmentType.START),
    spacing: { after: 40, line: 264, ...(opts.spacing ?? {}) },
    ...opts,
    children,
  });
}

const text = (ctx: Ctx, s: string, style?: RunStyle, opts?: Partial<IParagraphOptions>) => {
  const d = paraDir(s, ctx.rtl ? "rtl" : "ltr");
  return para(ctx, runs(ctx, s, style, d === "rtl"), opts, d);
};

function sectionTitle(ctx: Ctx, title: string): Paragraph {
  const { tpl } = ctx;
  const caps = tpl.titleStyle === "caps";
  const color = tpl.titleStyle === "rule" || caps ? tpl.accent : tpl.ink;
  const border =
    tpl.titleStyle === "bar"
      ? undefined
      : {
          bottom: {
            style: BorderStyle.SINGLE,
            size: tpl.titleStyle === "underline" ? 8 : 6,
            color: tpl.titleStyle === "underline" ? "111111" : hex(tpl.accent),
            space: 1,
          },
        };
  const barBorder =
    tpl.titleStyle === "bar"
      ? ctx.rtl
        ? { right: { style: BorderStyle.SINGLE, size: 24, color: hex(tpl.accent), space: 6 } }
        : { left: { style: BorderStyle.SINGLE, size: 24, color: hex(tpl.accent), space: 6 } }
      : undefined;
  return para(
    ctx,
    runs(ctx, title, {
      bold: true,
      color,
      size: tpl.size + (caps ? 1.5 : 2.5),
      allCaps: caps && ctx.lang === "en",
      characterSpacing: caps ? 20 : undefined,
    }),
    {
      spacing: { before: 170, after: 70 },
      border: border ?? barBorder,
      keepNext: true,
    },
  );
}

function bullets(ctx: Ctx, items: string[], width: number): Paragraph[] {
  return items.map((b) => {
    const d = paraDir(b, ctx.rtl ? "rtl" : "ltr");
    return para(
      ctx,
      [
        new TextRun({
          text: "•\t",
          color: hex(ctx.tpl.accent),
          size: halfPt(ctx.tpl.size),
          font: ctx.font,
          rightToLeft: d === "rtl",
        }),
        ...runs(ctx, b, {}, d === "rtl"),
      ],
      {
        indent: { start: 260, hanging: 200 },
        tabStops: [{ type: TabStopType.LEFT, position: 260 }],
        spacing: { after: 30 },
      },
      d,
    );
  });
  void width;
}

function entry(ctx: Ctx, e: CvEntry, width: number): Paragraph[] {
  const L = CV_LABELS[ctx.lang];
  // LRMs keep "2016 – 2020" in reading order inside RTL paragraphs (EN–ON–EN would flip).
  const when = period(e.start, e.end, L.present).replace(/(\d) – (\d)/, "$1\u200E – \u200E$2");
  const title = e.title || e.org;
  const tdir = ctx.rtl ? "rtl" : "ltr";
  // Title … dates on the far side via a right/left tab at the column edge.
  const head = para(
    ctx,
    [
      ...runs(ctx, title, { bold: true, size: ctx.tpl.size + 0.5 }),
      ...(when
        ? [
            new TextRun({ text: "\t", font: ctx.font }),
            ...runs(ctx, when, { color: "#4b5563", size: ctx.tpl.size - 0.5 }),
          ]
        : []),
    ],
    { tabStops: [{ type: TabStopType.END, position: width }], keepNext: true, spacing: { before: 60, after: 10 } },
    tdir,
  );
  const out: Paragraph[] = [head];
  if (e.title && e.org)
    out.push(text(ctx, e.org, { bold: true, color: ctx.tpl.accent }, { keepNext: true, spacing: { after: 20 } }));
  if (e.url)
    out.push(
      para(
        ctx,
        [
          new ExternalHyperlink({
            link: e.url,
            children: runs(ctx, shortUrl(e.url), { color: ctx.tpl.accent, size: ctx.tpl.size - 0.5 }, false),
          }),
        ],
        {},
        "ltr",
      ),
    );
  out.push(...bullets(ctx, e.bullets, width));
  if (e.tech?.length)
    out.push(text(ctx, `${L.tech}: ${e.tech.join(", ")}`, { color: "#4b5563", size: ctx.tpl.size - 0.5 }));
  return out;
}

function section(ctx: Ctx, c: CvContent, b: Block, width: number): Paragraph[] {
  const L = CV_LABELS[ctx.lang];
  const side = b.column === "side";
  const out: Paragraph[] = [sectionTitle(ctx, b.title)];
  const docDir = ctx.rtl ? "rtl" : "ltr";
  switch (b.id) {
    case "summary":
      out.push(text(ctx, c.summary, {}, { spacing: { after: 40, line: 290 } }));
      break;
    case "experience":
    case "projects":
    case "education":
    case "military":
    case "volunteering":
      for (const e of c[b.id]) out.push(...entry(ctx, e, width));
      break;
    case "skills":
      if (side) for (const s of c.skills) out.push(text(ctx, s));
      else out.push(para(ctx, runs(ctx, c.skills.join("  ·  ")), {}, docDir));
      break;
    case "languages":
      for (const l of c.languages) {
        const lv = levelLabel(ctx.lang, l.level);
        out.push(para(ctx, runs(ctx, lv ? `${l.name} — ${lv}` : l.name), {}, docDir));
      }
      break;
    case "links":
      for (const l of c.links)
        out.push(
          para(
            ctx,
            [
              ...runs(ctx, `${L.links[l.kind]}: `),
              new ExternalHyperlink({
                link: l.url,
                children: runs(ctx, shortUrl(l.url), { color: ctx.tpl.accent }, false),
              }),
            ],
            {},
            docDir,
          ),
        );
      break;
    default: {
      const x = c.custom.find((s) => `custom:${s.id}` === b.id);
      if (x) out.push(...bullets(ctx, x.bullets, width));
    }
  }
  return out;
}

function header(ctx: Ctx, c: CvContent): (Paragraph | Table)[] {
  const { tpl } = ctx;
  const band = tpl.header === "band";
  const center = tpl.header === "center";
  const fg = band ? "#ffffff" : tpl.ink;
  const align = center ? AlignmentType.CENTER : undefined;
  const docDir = ctx.rtl ? "rtl" : "ltr";
  const paras: Paragraph[] = [
    para(
      ctx,
      runs(ctx, c.name, { bold: true, size: tpl.size + 13, color: fg }),
      { alignment: align, spacing: { after: 20 } },
      docDir,
    ),
  ];
  if (c.headline)
    paras.push(
      para(
        ctx,
        runs(ctx, c.headline, { bold: true, size: tpl.size + 2, color: band ? "#ffffff" : tpl.accent }),
        { alignment: align, spacing: { after: 40 } },
        docDir,
      ),
    );
  const contact = c.contact.map((x) => x.value).join("   |   ");
  if (contact)
    paras.push(
      para(
        ctx,
        runs(ctx, contact, { size: tpl.size - 0.5, color: band ? "#ffffff" : "#374151" }),
        {
          alignment: align,
          spacing: { after: band ? 0 : 120 },
          border:
            tpl.header === "start" || (center && tpl.font === "serif")
              ? {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: tpl.header === "start" ? 12 : 8,
                    color: tpl.font === "serif" ? "111111" : hex(tpl.accent),
                    space: 4,
                  },
                }
              : undefined,
        },
        docDir,
      ),
    );
  if (!band) return paras;
  // Coloured band: a one-cell full-width table with accent shading.
  return [
    new Table({
      width: { size: BODY_W, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [BODY_W],
      borders: noBorders(),
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: BODY_W, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: hex(tpl.accent) },
              margins: { top: 200, bottom: 200, left: 240, right: 240 },
              borders: noBorders(),
              children: paras,
            }),
          ],
        }),
      ],
    }),
    para(ctx, [], { spacing: { after: 60 } }),
  ];
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}

export async function renderCvDocx(input: {
  content: CvContent;
  layout: LayoutEntry[];
  tpl: CvTemplate;
  lang: CvLang;
}): Promise<Buffer> {
  const { content: c, layout, tpl, lang } = input;
  const ctx: Ctx = { rtl: lang === "he", lang, tpl, font: DOCX_FONT[tpl.font] };
  const blocks = resolveBlocks(c, layout, tpl, lang);
  const main = blocks.filter((b) => b.column === "main");
  const side = blocks.filter((b) => b.column === "side");
  const body: (Paragraph | Table)[] = [...header(ctx, c)];
  if (tpl.columns === 2) {
    const sideW = Math.round(BODY_W * 0.31);
    const gap = 280;
    const mainW = BODY_W - sideW - gap;
    const cell = (w: number, children: Paragraph[], fill?: string) =>
      new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders: noBorders(),
        shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
        margins: fill ? { left: 160, right: 160, bottom: 160 } : undefined,
        children: children.length ? children : [new Paragraph({})],
      });
    body.push(
      new Table({
        width: { size: BODY_W, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: [mainW, gap, sideW],
        borders: noBorders(),
        // Hebrew: the first column (main) is on the right, sidebar on the left.
        visuallyRightToLeft: ctx.rtl,
        rows: [
          new TableRow({
            children: [
              cell(
                mainW,
                main.flatMap((b) => section(ctx, c, b, mainW)),
              ),
              cell(gap, []),
              cell(
                sideW,
                side.flatMap((b) => section(ctx, c, b, sideW - 320)),
                hex(tint(tpl.accent, 0.92)),
              ),
            ],
          }),
        ],
      }),
    );
  } else {
    for (const b of main) body.push(...section(ctx, c, b, BODY_W));
  }

  const f = FONT_FILES[tpl.font];
  const doc = new Document({
    creator: "Job Hunt",
    title: `${c.name} – CV`,
    // Embed the OFL font (regular + bold) so the CV looks the same without it installed.
    fonts: [{ name: DOCX_FONT[tpl.font], data: readFileSync(fontPath(f.regular)), characterSet: CharacterSet.ANSI }],
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: ctx.font, hAnsi: ctx.font, cs: ctx.font, eastAsia: ctx.font },
            size: halfPt(tpl.size),
            sizeComplexScript: halfPt(tpl.size),
            rightToLeft: ctx.rtl,
          },
          paragraph: { spacing: { after: 40 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: 16838 },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        children: body,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
