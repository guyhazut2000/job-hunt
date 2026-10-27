import { extractTech } from "../taxonomy";

export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const ALLOWED_CV_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export interface ParsedCv {
  text: string;
  skills: string[];
  email?: string;
  phone?: string;
  yearsExperience?: number;
}

export async function extractText(buf: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: true });
    return text;
  }
  if (mime === ALLOWED_CV_TYPES[1]) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  return buf.toString("utf8");
}

/** Structured fields we can pull from CV text without an LLM. */
export function parseCvText(text: string): ParsedCv {
  const clean = text.replace(/\u0000/g, "").trim();
  const email = clean.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  const phone = clean.match(/(?:\+972[-\s]?|0)(?:5\d|[2-9])[-\s]?\d{3}[-\s]?\d{4}/)?.[0];
  const years = [...clean.matchAll(/(\d{1,2})\+?\s*(?:years|yrs|שנות|שנים)/gi)]
    .map((m) => Number(m[1]))
    .filter((y) => y > 0 && y < 45);
  return {
    text: clean,
    skills: extractTech(clean),
    email,
    phone,
    yearsExperience: years.length ? Math.max(...years) : undefined,
  };
}
