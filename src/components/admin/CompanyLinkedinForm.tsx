import { adminSetCompanyLinkedin } from "@/app/admin/linkedin-actions";
import type { LinkedinStrings } from "@/lib/i18n/linkedin";

/** Admin card: attach a LinkedIn company page to a company (empty clears it → search fallback). */
export function CompanyLinkedinForm({
  companies,
  s,
}: {
  companies: { id: string; name: string; linkedinUrl: string | null }[];
  s: LinkedinStrings;
}) {
  return (
    <form action={adminSetCompanyLinkedin} className="card flex min-w-0 flex-col gap-3">
      <h2 className="font-semibold">{s.adminTitle}</h2>
      <select name="companyId" required className="select-native" aria-label={s.adminCompany}>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.linkedinUrl ? `✓ ${c.name}` : c.name}
          </option>
        ))}
      </select>
      <input
        name="linkedinUrl"
        placeholder="https://www.linkedin.com/company/…"
        aria-label={s.adminTitle}
        className="input"
        dir="ltr"
      />
      <p className="text-muted-foreground text-xs">{s.adminHint}</p>
      <button className="btn-primary" type="submit">
        {s.adminSave}
      </button>
    </form>
  );
}
