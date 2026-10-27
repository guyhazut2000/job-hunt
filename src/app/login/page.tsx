import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { getDictionary } from "@/lib/i18n";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getDictionary();
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <div className="card mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{t.auth.loginTitle}</h1>
      <AuthForm
        mode="login"
        next={safeNext}
        labels={{ email: t.auth.email, password: t.auth.password, name: t.auth.name, submit: t.auth.submitLogin }}
      />
      <p className="text-sm text-slate-600">
        {t.auth.noAccount}{" "}
        <Link href="/register" className="text-brand-600 hover:underline">
          {t.nav.register}
        </Link>
      </p>
    </div>
  );
}
