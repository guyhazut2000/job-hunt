/**
 * Server-side PDF renderer (@react-pdf/renderer). RTL notes (docs/cv-templates.md):
 * - every Text gets `direction` from its first strong character and `textAlign` from the CV language,
 *   so an English line inside a Hebrew CV keeps its period on the right side and Hebrew wraps RTL;
 * - rows are explicitly `row-reverse` in Hebrew, and RTL text inside a row must have flex:1/width
 *   or react-pdf drops it.
 */
import { Document, Font, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Styles } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { CV_LABELS, type CvLang } from "@/lib/i18n/cv-templates";
import { paraDir, period, shortUrl } from "./bidi";
import type { CvContent, CvEntry } from "./content";
import { FONT_FILES, fontPath } from "./fonts";
import { levelLabel, resolveBlocks, tint, type Block } from "./resolve";
import type { LayoutEntry } from "./sections";
import type { CvTemplate } from "./templates";

let registered = false;
function registerFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: "CvSans",
    fonts: [
      { src: fontPath(FONT_FILES.sans.regular), fontWeight: 400 },
      { src: fontPath(FONT_FILES.sans.semibold), fontWeight: 600 },
      { src: fontPath(FONT_FILES.sans.bold), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "CvSerif",
    fonts: [
      { src: fontPath(FONT_FILES.serif.regular), fontWeight: 400 },
      // One registration per file: registering the same file for two weights breaks subsetting.
      { src: fontPath(FONT_FILES.serif.bold), fontWeight: 700 },
    ],
  });
  // Never hyphenate (Hebrew has no hyphenation; English names/terms must not split).
  Font.registerHyphenationCallback((w) => [w]);
}

interface Ctx {
  rtl: boolean;
  lang: CvLang;
  tpl: CvTemplate;
}

function P({
  ctx,
  children,
  style,
  forceDir,
}: {
  ctx: Ctx;
  children: string;
  style?: Styles[string];
  forceDir?: "rtl" | "ltr";
}) {
  const dir = forceDir ?? paraDir(children, ctx.rtl ? "rtl" : "ltr");
  return <Text style={[{ direction: dir, textAlign: ctx.rtl ? "right" : "left" }, style ?? {}]}>{children}</Text>;
}

const row = (ctx: Ctx) => ({ flexDirection: (ctx.rtl ? "row-reverse" : "row") as "row" | "row-reverse" });

function SectionTitle({ ctx, title }: { ctx: Ctx; title: string }) {
  const { tpl } = ctx;
  const text = tpl.titleStyle === "caps" && ctx.lang === "en" ? title.toUpperCase() : title;
  const base = { fontWeight: 700, fontSize: tpl.size + 2.5, color: tpl.ink };
  if (tpl.titleStyle === "bar")
    return (
      <View style={[row(ctx), { alignItems: "center", marginTop: 9, marginBottom: 3 }]} wrap={false}>
        <View style={{ width: 4, height: tpl.size + 3, backgroundColor: tpl.accent, borderRadius: 1 }} />
        <View style={{ width: 6 }} />
        <View style={{ flex: 1 }}>
          <P ctx={ctx} style={base}>
            {text}
          </P>
        </View>
      </View>
    );
  return (
    <View
      style={{
        marginTop: 9,
        marginBottom: 3,
        paddingBottom: 2,
        borderBottomWidth: tpl.titleStyle === "caps" ? 0.6 : tpl.titleStyle === "underline" ? 0.9 : 0.8,
        borderBottomColor: tpl.titleStyle === "underline" ? "#111111" : tpl.accent,
      }}
      wrap={false}
    >
      <P
        ctx={ctx}
        style={{
          ...base,
          color: tpl.titleStyle === "rule" || tpl.titleStyle === "caps" ? tpl.accent : tpl.ink,
          letterSpacing: tpl.titleStyle === "caps" ? 1 : 0,
          fontSize: tpl.titleStyle === "caps" ? tpl.size + 1.5 : base.fontSize,
        }}
      >
        {text}
      </P>
    </View>
  );
}

function Bullets({ ctx, items }: { ctx: Ctx; items: string[] }) {
  return (
    <View style={{ marginTop: 2 }}>
      {items.map((b, i) => (
        <View key={i} style={[row(ctx), { marginBottom: 1.5 }]}>
          <Text style={{ width: 10, textAlign: "center", color: ctx.tpl.accent }}>•</Text>
          <View style={{ flex: 1 }}>
            <P ctx={ctx}>{b}</P>
          </View>
        </View>
      ))}
    </View>
  );
}

function Entry({ ctx, e, compact }: { ctx: Ctx; e: CvEntry; compact?: boolean }) {
  const when = period(e.start, e.end, CV_LABELS[ctx.lang].present);
  const muted = { color: "#4b5563" };
  return (
    <View style={{ marginBottom: compact ? 3 : 5 }}>
      <View style={[row(ctx), { alignItems: "flex-start" }]} wrap={false}>
        <View style={{ flex: 1 }}>
          <P ctx={ctx} style={{ fontWeight: 700, fontSize: ctx.tpl.size + 0.5 }}>
            {e.title || e.org}
          </P>
          {e.title && e.org ? (
            <P ctx={ctx} style={{ fontWeight: 600, color: ctx.tpl.accent === "#111111" ? "#333333" : ctx.tpl.accent }}>
              {e.org}
            </P>
          ) : null}
        </View>
        {when ? (
          <Text style={{ ...muted, fontSize: ctx.tpl.size - 0.5, direction: "ltr", marginLeft: 8, marginRight: 8 }}>
            {when}
          </Text>
        ) : null}
      </View>
      {e.url ? (
        <Link src={e.url} style={{ color: ctx.tpl.accent, textDecoration: "none" }}>
          <P ctx={ctx} forceDir="ltr" style={{ fontSize: ctx.tpl.size - 0.5, color: ctx.tpl.accent }}>
            {shortUrl(e.url)}
          </P>
        </Link>
      ) : null}
      {e.bullets.length ? <Bullets ctx={ctx} items={e.bullets} /> : null}
      {e.tech?.length ? (
        <P ctx={ctx} style={{ ...muted, fontSize: ctx.tpl.size - 0.5 }}>
          {`${CV_LABELS[ctx.lang].tech}: ${e.tech.join(", ")}`}
        </P>
      ) : null}
    </View>
  );
}

function Section({ ctx, c, b }: { ctx: Ctx; c: CvContent; b: Block }) {
  const side = b.column === "side";
  let body: ReactNode = null;
  switch (b.id) {
    case "summary":
      body = <P ctx={ctx}>{c.summary}</P>;
      break;
    case "experience":
    case "projects":
    case "education":
    case "military":
    case "volunteering": {
      // Keep the heading with the first entry so a heading never ends a page.
      const [first, ...rest] = c[b.id];
      const compact = b.id === "education" || b.id === "military";
      return (
        <View>
          <View wrap={false}>
            <SectionTitle ctx={ctx} title={b.title} />
            <Entry ctx={ctx} e={first} compact={compact} />
          </View>
          {rest.map((e, i) => (
            <Entry key={i} ctx={ctx} e={e} compact={compact} />
          ))}
        </View>
      );
    }
    case "skills":
      body = side ? (
        c.skills.map((s, i) => (
          <P key={i} ctx={ctx} style={{ marginBottom: 1.5 }}>
            {s}
          </P>
        ))
      ) : (
        <P ctx={ctx} forceDir={ctx.rtl ? "rtl" : "ltr"} style={{ lineHeight: 1.45 }}>
          {c.skills.join("  ·  ")}
        </P>
      );
      break;
    case "languages":
      body = c.languages.map((l, i) => {
        const lv = levelLabel(ctx.lang, l.level);
        return (
          <P key={i} ctx={ctx} forceDir={ctx.rtl ? "rtl" : "ltr"} style={{ marginBottom: 1.5 }}>
            {lv ? `${l.name} — ${lv}` : l.name}
          </P>
        );
      });
      break;
    case "links":
      body = c.links.map((l, i) => (
        <Link key={i} src={l.url} style={{ textDecoration: "none", color: ctx.tpl.ink }}>
          <P ctx={ctx} forceDir={ctx.rtl ? "rtl" : "ltr"} style={{ marginBottom: 1.5 }}>
            {`${CV_LABELS[ctx.lang].links[l.kind]}: ${shortUrl(l.url)}`}
          </P>
        </Link>
      ));
      break;
    default: {
      const x = c.custom.find((s) => `custom:${s.id}` === b.id);
      body = x ? <Bullets ctx={ctx} items={x.bullets} /> : null;
    }
  }
  return (
    <View wrap={b.id === "summary"}>
      <SectionTitle ctx={ctx} title={b.title} />
      {body}
    </View>
  );
}

function Header({ ctx, c }: { ctx: Ctx; c: CvContent }) {
  const { tpl } = ctx;
  const contact = c.contact.map((x) => x.value).join("   |   ");
  const center = tpl.header === "center";
  const band = tpl.header === "band";
  const align = center ? "center" : ctx.rtl ? "right" : "left";
  const fg = band ? "#ffffff" : tpl.ink;
  return (
    <View
      style={{
        marginBottom: 6,
        paddingBottom: band ? 14 : 6,
        paddingTop: band ? 16 : 0,
        paddingHorizontal: band ? 36 : 0,
        marginHorizontal: band ? 0 : 36,
        backgroundColor: band ? tpl.accent : undefined,
        borderBottomWidth: tpl.header === "start" ? 1.6 : center && tpl.font === "serif" ? 0.9 : 0,
        borderBottomColor: tpl.font === "serif" ? "#111111" : tpl.accent,
      }}
    >
      <Text
        style={{
          fontSize: tpl.size + 13,
          fontWeight: 700,
          lineHeight: 1.2,
          color: fg,
          textAlign: align,
          direction: paraDir(c.name, ctx.rtl ? "rtl" : "ltr"),
        }}
      >
        {c.name}
      </Text>
      {c.headline ? (
        <Text
          style={{
            fontSize: tpl.size + 2,
            fontWeight: 600,
            color: band ? "#ffffff" : tpl.accent,
            textAlign: align,
            direction: paraDir(c.headline, ctx.rtl ? "rtl" : "ltr"),
            marginTop: 2,
          }}
        >
          {c.headline}
        </Text>
      ) : null}
      {contact ? (
        <Text
          style={{
            fontSize: tpl.size - 0.5,
            color: band ? "#ffffff" : "#374151",
            textAlign: align,
            direction: ctx.rtl ? "rtl" : "ltr",
            marginTop: 4,
          }}
        >
          {contact}
        </Text>
      ) : null}
    </View>
  );
}

export function CvPdfDocument({
  content,
  layout,
  tpl,
  lang,
}: {
  content: CvContent;
  layout: LayoutEntry[];
  tpl: CvTemplate;
  lang: CvLang;
}) {
  registerFonts();
  const ctx: Ctx = { rtl: lang === "he", lang, tpl };
  const blocks = resolveBlocks(content, layout, tpl, lang);
  const main = blocks.filter((b) => b.column === "main");
  const side = blocks.filter((b) => b.column === "side");
  const page = StyleSheet.create({
    page: {
      fontFamily: tpl.font === "serif" ? "CvSerif" : "CvSans",
      fontSize: tpl.size,
      color: "#111827",
      paddingTop: tpl.header === "band" ? 0 : 32,
      paddingBottom: 34,
      paddingHorizontal: 0,
      lineHeight: 1.35,
    },
  });
  return (
    <Document
      title={`${content.name} – CV`}
      author={content.name}
      language={lang}
      creator="Job Hunt"
      producer="Job Hunt"
    >
      <Page size="A4" style={page.page}>
        <Header ctx={ctx} c={content} />
        <View style={{ paddingHorizontal: 36 }}>
          {tpl.columns === 2 ? (
            <View style={[row(ctx), { alignItems: "stretch" }]}>
              <View style={{ flex: 1 }}>
                {main.map((b) => (
                  <Section key={b.id} ctx={ctx} c={content} b={b} />
                ))}
              </View>
              <View style={{ width: 14 }} />
              <View
                style={{
                  width: "31%",
                  backgroundColor: tint(tpl.accent, 0.92),
                  paddingHorizontal: 10,
                  paddingBottom: 10,
                  borderRadius: 3,
                }}
              >
                {side.map((b) => (
                  <Section key={b.id} ctx={ctx} c={content} b={b} />
                ))}
              </View>
            </View>
          ) : (
            main.map((b) => <Section key={b.id} ctx={ctx} c={content} b={b} />)
          )}
        </View>
      </Page>
    </Document>
  );
}

export async function renderCvPdf(input: {
  content: CvContent;
  layout: LayoutEntry[];
  tpl: CvTemplate;
  lang: CvLang;
}): Promise<Buffer> {
  return renderToBuffer(<CvPdfDocument {...input} />);
}
