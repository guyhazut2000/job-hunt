import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getLocale, isRtl } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "job-hunt — משרות הייטק בישראל", template: "%s · job-hunt" },
  description: "Tech jobs in Israel with an explainable match score and AI CV suggestions.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
