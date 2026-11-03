import { cvStandardStatus } from "@/lib/cv-standard/server";
import { cvStandardStrings, fillS } from "@/lib/i18n/cv-standard";
import { BannerShell } from "./BannerShell";

/** Site-wide reminder until the CV meets the mandatory standard (#94). Never breaks the layout. */
export async function CvStandardBanner({ userId, locale }: { userId: string; locale: "he" | "en" }) {
  let status: Awaited<ReturnType<typeof cvStandardStatus>>;
  try {
    status = await cvStandardStatus(userId);
  } catch {
    return null;
  }
  if (status.passed) return null;
  const t = cvStandardStrings(locale);
  const text = status.blocking > 0 ? fillS(t.banner.text, { n: status.blocking }) : t.banner.unknown;
  return <BannerShell text={text} cta={t.banner.cta} />;
}
