/**
 * What to tell the user after a CV export (#95). A plain `<a download>` hid two failures:
 * a 401/500 saved an error page as the "CV", and a translation that hit the AI limit or failed
 * produced a file still in the source language with no word about it.
 */
export type ExportOutcome = "done" | "translateLimited" | "translateFailed" | "exportFailed" | "exportSignedOut";

export function exportOutcome(httpStatus: number, translation: string | null): ExportOutcome {
  if (httpStatus === 401 || httpStatus === 403) return "exportSignedOut";
  if (httpStatus < 200 || httpStatus >= 300) return "exportFailed";
  if (translation === "limited") return "translateLimited";
  if (translation === "error") return "translateFailed";
  return "done";
}

/** Filename from Content-Disposition, preferring the UTF-8 `filename*` (Hebrew names). */
export function dispositionFilename(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // fall through to the ASCII name
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain?.[1] ?? fallback;
}

/**
 * Translate an export into `lang`? Into English: always check (any Hebrew string in an English CV is wrong;
 * per-string detection sends only those). Into Hebrew: only when the CV is written in English, since
 * short English terms inside a Hebrew CV are normal.
 */
export function shouldTranslate(written: "he" | "en", lang: "he" | "en", demo: boolean): boolean {
  if (demo) return false;
  return lang === "en" || written !== lang;
}
