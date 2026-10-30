import type { Metadata, Viewport } from "next";
import { Assistant, Frank_Ruhl_Libre, IBM_Plex_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/MobileNav";
import { ChatFab } from "@/components/chat/ChatFab";
import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDictionary, isRtl } from "@/lib/i18n";
import { documentStrings } from "@/lib/i18n/documents";
import { statsStrings } from "@/lib/i18n/stats";
import { reminderStrings } from "@/lib/i18n/reminders";
import { learningStrings } from "@/lib/i18n/learning";
import { learningHubStrings } from "@/lib/i18n/learning-hub";
import { auth } from "@/auth";
import { cn } from "@/lib/utils";
import { siteUrl } from "@/lib/notifications/config";
import "./globals.css";

const body = Assistant({ subsets: ["hebrew", "latin"], variable: "--font-body", display: "swap" });
const display = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["500", "700", "900"],
  variable: "--font-display",
  display: "swap",
});
const data = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-data", display: "swap" });

const DESCRIPTION = "משרות הייטק בישראל עם ציון התאמה מוסבר, מעקב מועמדויות והצעות AI לקורות החיים.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "job-hunt — משרות הייטק בישראל", template: "%s · job-hunt" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "job-hunt",
    locale: "he_IL",
    title: "job-hunt — משרות הייטק בישראל",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f3ec",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, session] = await Promise.all([getDictionary(), auth()]);
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const user = session?.user;
  return (
    <html lang={locale} dir={dir} className={cn(body.variable, display.variable, data.variable)}>
      <body className="flex min-h-dvh flex-col overflow-x-clip">
        <DirectionProvider dir={dir}>
          <TooltipProvider delayDuration={300}>
            <a
              href="#main"
              className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-3 focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
            >
              {t.ui.skip}
            </a>
            <Header />
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10 outline-none md:px-6 md:pt-10 md:pb-16"
            >
              {children}
            </main>
            <Footer />
            {user && <ChatFab locale={locale} />}
            <MobileNav
              locale={locale}
              user={user ? { role: user.role } : null}
              labels={{
                jobs: t.nav.jobs,
                companies: t.nav.companies,
                tracker: t.ui.tracker,
                profile: t.ui.profile,
                more: t.ui.more,
                login: t.nav.login,
                register: t.nav.register,
                logout: t.nav.logout,
                learn: learningStrings(locale).nav,
                documents: documentStrings(locale).nav,
                learnMine: learningHubStrings(locale).navMine,
                digest: reminderStrings(locale).nav,
                stats: statsStrings(locale).nav,
                admin: t.nav.admin,
                features: t.nav.features,
                language: t.nav.language,
                account: t.ui.account,
              }}
            />
          </TooltipProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
