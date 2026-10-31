/**
 * HTML preview of a CV template — mirrors src/lib/cv-templates/pdf.tsx from the same tokens.
 * Rendered at A4 width (794px) and scaled by the parent. No hooks: usable on server and client.
 */
import type { CSSProperties, ReactNode } from "react";
import { CV_LABELS, type CvLang } from "@/lib/i18n/cv-templates";
import { paraDir, period, shortUrl } from "@/lib/cv-templates/bidi";
import type { CvContent, CvEntry } from "@/lib/cv-templates/content";
import { levelLabel, resolveBlocks, tint, type Block } from "@/lib/cv-templates/resolve";
import type { LayoutEntry } from "@/lib/cv-templates/sections";
import type { CvTemplate } from "@/lib/cv-templates/templates";
import { cvSans, cvSerif } from "./fonts";

export const SHEET_W = 794;
export const SHEET_H = 1123;
const PT = 96 / 72;

interface Ctx {
  rtl: boolean;
  lang: CvLang;
  tpl: CvTemplate;
}
const px = (pt: number) => `${(pt * PT).toFixed(2)}px`;

function P({ ctx, children, style, dir }: { ctx: Ctx; children: string; style?: CSSProperties; dir?: "rtl" | "ltr" }) {
  return (
    <p
      dir={dir ?? paraDir(children, ctx.rtl ? "rtl" : "ltr")}
      style={{ margin: 0, textAlign: ctx.rtl ? "right" : "left", ...style }}
    >
      {children}
    </p>
  );
}

function Title({ ctx, title }: { ctx: Ctx; title: string }) {
  const { tpl } = ctx;
  const caps = tpl.titleStyle === "caps";
  const style: CSSProperties = {
    margin: `${px(9)} 0 ${px(3)}`,
    fontWeight: 700,
    fontSize: px(tpl.size + (caps ? 1.5 : 2.5)),
    color: tpl.titleStyle === "rule" || caps ? tpl.accent : tpl.ink,
    letterSpacing: caps ? "0.08em" : undefined,
    textTransform: caps && ctx.lang === "en" ? "uppercase" : undefined,
    paddingBottom: tpl.titleStyle === "bar" ? 0 : px(2),
    borderBottom:
      tpl.titleStyle === "bar"
        ? undefined
        : `${px(tpl.titleStyle === "underline" ? 0.9 : 0.7)} solid ${tpl.titleStyle === "underline" ? "#111" : tpl.accent}`,
    borderInlineStart: tpl.titleStyle === "bar" ? `${px(4)} solid ${tpl.accent}` : undefined,
    paddingInlineStart: tpl.titleStyle === "bar" ? px(6) : undefined,
    lineHeight: 1.3,
  };
  return <h3 style={style}>{title}</h3>;
}

function Bullets({ ctx, items }: { ctx: Ctx; items: string[] }) {
  return (
    <ul style={{ margin: `${px(2)} 0 0`, padding: 0, listStyle: "none" }}>
      {items.map((b, i) => (
        <li key={i} style={{ display: "flex", gap: px(3), marginBottom: px(1.5) }}>
          <span style={{ color: ctx.tpl.accent, width: px(7), flexShrink: 0, textAlign: "center" }}>•</span>
          <P ctx={ctx} style={{ flex: 1 }}>
            {b}
          </P>
        </li>
      ))}
    </ul>
  );
}

function Entry({ ctx, e }: { ctx: Ctx; e: CvEntry }) {
  const when = period(e.start, e.end, CV_LABELS[ctx.lang].present);
  return (
    <div style={{ marginBottom: px(5) }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: px(8) }}>
        <div style={{ flex: 1 }}>
          <P ctx={ctx} style={{ fontWeight: 700, fontSize: px(ctx.tpl.size + 0.5) }}>
            {e.title || e.org}
          </P>
          {e.title && e.org ? (
            <P ctx={ctx} style={{ fontWeight: 600, color: ctx.tpl.accent }}>
              {e.org}
            </P>
          ) : null}
        </div>
        {when ? (
          <span dir="ltr" style={{ color: "#4b5563", fontSize: px(ctx.tpl.size - 0.5), whiteSpace: "nowrap" }}>
            {when}
          </span>
        ) : null}
      </div>
      {e.url ? (
        <P ctx={ctx} dir="ltr" style={{ color: ctx.tpl.accent, fontSize: px(ctx.tpl.size - 0.5) }}>
          {shortUrl(e.url)}
        </P>
      ) : null}
      {e.bullets.length ? <Bullets ctx={ctx} items={e.bullets} /> : null}
      {e.tech?.length ? (
        <P ctx={ctx} style={{ color: "#4b5563", fontSize: px(ctx.tpl.size - 0.5) }}>
          {`${CV_LABELS[ctx.lang].tech}: ${e.tech.join(", ")}`}
        </P>
      ) : null}
    </div>
  );
}

function Section({ ctx, c, b }: { ctx: Ctx; c: CvContent; b: Block }) {
  const docDir = ctx.rtl ? "rtl" : "ltr";
  let body: ReactNode = null;
  switch (b.id) {
    case "summary":
      body = <P ctx={ctx}>{c.summary}</P>;
      break;
    case "experience":
    case "projects":
    case "education":
    case "military":
    case "volunteering":
      body = c[b.id].map((e, i) => <Entry key={i} ctx={ctx} e={e} />);
      break;
    case "skills":
      body =
        b.column === "side" ? (
          c.skills.map((s, i) => (
            <P key={i} ctx={ctx}>
              {s}
            </P>
          ))
        ) : (
          <P ctx={ctx} dir={docDir}>
            {c.skills.join("  ·  ")}
          </P>
        );
      break;
    case "languages":
      body = c.languages.map((l, i) => {
        const lv = levelLabel(ctx.lang, l.level);
        return (
          <P key={i} ctx={ctx} dir={docDir}>
            {lv ? `${l.name} — ${lv}` : l.name}
          </P>
        );
      });
      break;
    case "links":
      body = c.links.map((l, i) => (
        <P key={i} ctx={ctx} dir={docDir}>
          {`${CV_LABELS[ctx.lang].links[l.kind]}: ${shortUrl(l.url)}`}
        </P>
      ));
      break;
    default: {
      const x = c.custom.find((s) => `custom:${s.id}` === b.id);
      body = x ? <Bullets ctx={ctx} items={x.bullets} /> : null;
    }
  }
  return (
    <section data-section={b.id}>
      <Title ctx={ctx} title={b.title} />
      {body}
    </section>
  );
}

export function CvPreview({
  content: c,
  layout,
  tpl,
  lang,
}: {
  content: CvContent;
  layout: LayoutEntry[];
  tpl: CvTemplate;
  lang: CvLang;
}) {
  const ctx: Ctx = { rtl: lang === "he", lang, tpl };
  const blocks = resolveBlocks(c, layout, tpl, lang);
  const main = blocks.filter((b) => b.column === "main");
  const side = blocks.filter((b) => b.column === "side");
  const band = tpl.header === "band";
  const center = tpl.header === "center";
  const align = center ? "center" : ctx.rtl ? "right" : "left";
  const font = tpl.font === "serif" ? cvSerif : cvSans;
  return (
    <div
      dir={ctx.rtl ? "rtl" : "ltr"}
      lang={lang}
      className={font.className}
      data-testid="cv-preview"
      style={{
        width: SHEET_W,
        minHeight: SHEET_H,
        background: "#fff",
        color: "#111827",
        fontSize: px(tpl.size),
        lineHeight: 1.35,
        paddingTop: band ? 0 : px(32),
        paddingBottom: px(34),
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          background: band ? tpl.accent : undefined,
          color: band ? "#fff" : tpl.ink,
          padding: band ? `${px(16)} ${px(36)} ${px(14)}` : `0 0 ${px(6)}`,
          margin: band ? `0 0 ${px(6)}` : `0 ${px(36)} ${px(6)}`,
          textAlign: align,
          borderBottom:
            tpl.header === "start"
              ? `${px(1.6)} solid ${tpl.accent}`
              : center && tpl.font === "serif"
                ? `${px(0.9)} solid #111`
                : undefined,
        }}
      >
        <div dir="auto" style={{ fontSize: px(tpl.size + 13), fontWeight: 700, lineHeight: 1.2 }}>
          {c.name}
        </div>
        {c.headline ? (
          <div
            dir="auto"
            style={{ fontSize: px(tpl.size + 2), fontWeight: 600, color: band ? "#fff" : tpl.accent, marginTop: px(2) }}
          >
            {c.headline}
          </div>
        ) : null}
        {c.contact.length ? (
          <div style={{ fontSize: px(tpl.size - 0.5), color: band ? "#fff" : "#374151", marginTop: px(4) }}>
            {c.contact.map((x) => x.value).join("   |   ")}
          </div>
        ) : null}
      </header>
      <div style={{ padding: `0 ${px(36)}` }}>
        {tpl.columns === 2 ? (
          <div style={{ display: "flex", gap: px(14), alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {main.map((b) => (
                <Section key={b.id} ctx={ctx} c={c} b={b} />
              ))}
            </div>
            <aside
              style={{
                width: "31%",
                background: tint(tpl.accent, 0.92),
                padding: `0 ${px(10)} ${px(10)}`,
                borderRadius: px(3),
              }}
            >
              {side.map((b) => (
                <Section key={b.id} ctx={ctx} c={c} b={b} />
              ))}
            </aside>
          </div>
        ) : (
          main.map((b) => <Section key={b.id} ctx={ctx} c={c} b={b} />)
        )}
      </div>
    </div>
  );
}
