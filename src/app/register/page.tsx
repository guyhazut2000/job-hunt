import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { getDictionary } from "@/lib/i18n";

export const metadata = { title: "Sign up" };

export default async function RegisterPage() {
  const { t } = await getDictionary();
  return (
    <div className="card mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{t.auth.registerTitle}</h1>
      <AuthForm
        mode="register"
        labels={{ email: t.auth.email, password: t.auth.password, name: t.auth.name, submit: t.auth.submitRegister }}
      />
      <p className="text-xs text-slate-500">
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
      <p className="text-sm text-slate-600">
        {t.auth.hasAccount}{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          {t.nav.login}
        </Link>
      </p>
    </div>
  );
}
