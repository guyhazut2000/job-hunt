import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/titles";
import { safeNextPath } from "@/lib/safe-next";

export const generateMetadata = localizedTitle("login");

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getDictionary();
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  return (
    <AuthShell title={t.auth.loginTitle} aside={t.home.title}>
      <AuthForm
        mode="login"
        next={safeNext}
        labels={{ email: t.auth.email, password: t.auth.password, name: t.auth.name, submit: t.auth.submitLogin }}
      />
      <p className="text-muted-foreground text-sm">
        {t.auth.noAccount}{" "}
        <Link
          href="/register"
          className="text-primary inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
        >
          {t.nav.register}
        </Link>
      </p>
    </AuthShell>
  );
}
