import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary } from "@/lib/i18n";

export const metadata = { title: "Sign up" };

export default async function RegisterPage() {
  const { t } = await getDictionary();
  return (
    <AuthShell title={t.auth.registerTitle} aside={t.home.subtitle}>
      <AuthForm
        mode="register"
        labels={{ email: t.auth.email, password: t.auth.password, name: t.auth.name, submit: t.auth.submitRegister }}
      />
      <p className="text-muted-foreground text-xs">
        {t.auth.terms} (
        <Link href="/terms" className="underline">
          {t.footer.terms}
        </Link>
        ,{" "}
        <Link href="/privacy" className="underline">
          {t.footer.privacy}
        </Link>
        )
      </p>
      <p className="text-muted-foreground text-sm">
        {t.auth.hasAccount}{" "}
        <Link
          href="/login"
          className="text-primary inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
        >
          {t.nav.login}
        </Link>
      </p>
    </AuthShell>
  );
}
